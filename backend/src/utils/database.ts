import { UserModel, SubscriptionModel, ImageGenerationModel } from '../models';
import { SubscriptionTier, ImageGenerationType, SUBSCRIPTION_QUOTAS } from '../types';
import { Types } from 'mongoose';

// Database utilities for common operations across models
export class DatabaseUtils {
  // Quota management utilities
  static async checkUserQuota(userId: string, creditsRequired: number = 1): Promise<{
    allowed: boolean;
    remaining: number;
    limit: number;
    resetDate: Date;
    tier: SubscriptionTier;
    reason?: string;
  }> {
    const user = await UserModel.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    const limit = SUBSCRIPTION_QUOTAS[user.subscriptionTier];
    const remaining = Math.max(0, limit - user.monthlyUsage);
    const allowed = remaining >= creditsRequired;

    return {
      allowed,
      remaining,
      limit,
      resetDate: user.quotaResetDate,
      tier: user.subscriptionTier,
      reason: allowed ? undefined : 'Insufficient quota remaining'
    };
  }

  static async consumeUserQuota(userId: string, credits: number = 1): Promise<void> {
    const user = await UserModel.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.canGenerateImages(credits)) {
      throw new Error('Insufficient quota remaining');
    }

    await user.incrementUsage(credits);
  }

  static async resetUserQuota(userId: string): Promise<void> {
    const user = await UserModel.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    await user.resetMonthlyQuota();
  }

  // Subscription validation utilities
  static async validateUserSubscription(userId: string): Promise<{
    isValid: boolean;
    subscription: any;
    needsUpgrade: boolean;
    reason?: string;
  }> {
    const subscription = await SubscriptionModel.findByUserId(userId);
    
    if (!subscription) {
      return {
        isValid: false,
        subscription: null,
        needsUpgrade: true,
        reason: 'No subscription found'
      };
    }

    const isActive = subscription.isActive() || subscription.isInTrial();
    const hasExpired = subscription.hasExpired();

    return {
      isValid: isActive && !hasExpired,
      subscription: subscription.toJSON(),
      needsUpgrade: !isActive || hasExpired,
      reason: !isActive ? 'Subscription not active' : hasExpired ? 'Subscription expired' : undefined
    };
  }

  static async upgradeUserSubscription(userId: string, newTier: SubscriptionTier, stripeData?: any): Promise<any> {
    const subscription = await SubscriptionModel.findByUserId(userId);
    
    if (!subscription) {
      throw new Error('No subscription found');
    }

    if (!subscription.canUpgrade(newTier)) {
      throw new Error(`Cannot upgrade from ${subscription.tier} to ${newTier}`);
    }

    await subscription.upgrade(newTier);
    
    // Update user's subscription tier
    const user = await UserModel.findById(userId);
    if (user) {
      await user.updateSubscription(newTier);
    }

    return subscription;
  }

  // Image generation utilities
  static async createImageGeneration(data: {
    userId: string;
    type: ImageGenerationType;
    prompt: string;
    negativePrompt?: string;
    style?: string;
    aspectRatio?: string;
    quality?: 'standard' | 'hd';
    model?: string;
    metadata?: any;
  }): Promise<any> {
    // Check user quota first
    const quotaCheck = await this.checkUserQuota(data.userId);
    
    if (!quotaCheck.allowed) {
      throw new Error('Insufficient quota remaining');
    }

    // Create the generation
    const generation = await ImageGenerationModel.createGeneration({
      userId: data.userId,
      type: data.type,
      prompt: data.prompt,
      negativePrompt: data.negativePrompt,
      style: data.style || 'realistic',
      aspectRatio: data.aspectRatio || '1:1',
      quality: data.quality || 'standard',
      model: data.model || 'dall-e-3',
      status: 'pending',
      credits: 1,
      metadata: {
        model: data.model || 'dall-e-3',
        version: '1.0',
        parameters: data.metadata || {},
        ...data.metadata
      }
    });

    return generation;
  }

  static async getImageGenerationHistory(userId: string, options: {
    limit?: number;
    status?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<any[]> {
    const {
      limit = 20,
      status,
      type,
      startDate,
      endDate
    } = options;

    const filter: any = { userId, isDeleted: false };
    
    if (status) filter.status = status;
    if (type) filter.type = type;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    return await ImageGenerationModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  // Analytics and reporting utilities
  static async getUserAnalytics(userId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [user, subscription, recentGenerations, generationStats] = await Promise.all([
      UserModel.findById(userId),
      SubscriptionModel.findByUserId(userId),
      ImageGenerationModel.findRecentByUser(userId, days),
      ImageGenerationModel.getUserStats(userId)
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate daily generation counts
    const dailyGenerations = recentGenerations.reduce((acc: any, gen: any) => {
      const date = gen.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    // Calculate generation type distribution
    const typeDistribution = recentGenerations.reduce((acc: any, gen: any) => {
      acc[gen.type] = (acc[gen.type] || 0) + 1;
      return acc;
    }, {});

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        monthlyUsage: user.monthlyUsage,
        remainingQuota: user.getRemainingQuota(),
        totalImagesGenerated: user.totalImagesGenerated,
        quotaResetDate: user.quotaResetDate
      },
      subscription: subscription ? {
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        daysUntilRenewal: subscription.getDaysUntilRenewal()
      } : null,
      analytics: {
        ...generationStats,
        dailyGenerations,
        typeDistribution,
        recentGenerationsCount: recentGenerations.length
      }
    };
  }

  static async getSystemAnalytics(days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalUsers,
      systemStats,
      subscriptionCounts,
      recentGenerations
    ] = await Promise.all([
      UserModel.getActiveUsersCount(),
      ImageGenerationModel.getSystemStats(),
      this.getSubscriptionCounts(),
      ImageGenerationModel.find({
        createdAt: { $gte: startDate },
        isDeleted: false
      }).lean()
    ]);

    // Calculate daily generation trends
    const dailyTrends = recentGenerations.reduce((acc: any, gen: any) => {
      const date = gen.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, generations: 0, uniqueUsers: new Set(), totalImages: 0 };
      }
      acc[date].generations++;
      acc[date].uniqueUsers.add(gen.userId);
      acc[date].totalImages += gen.outputImages.length;
      return acc;
    }, {});

    // Convert uniqueUsers sets to counts
    Object.values(dailyTrends).forEach((day: any) => {
      day.uniqueUsers = day.uniqueUsers.size;
    });

    return {
      overview: {
        totalUsers,
        ...systemStats,
        subscriptionCounts
      },
      trends: {
        dailyTrends: Object.values(dailyTrends).sort((a: any, b: any) => a.date.localeCompare(b.date))
      }
    };
  }

  // Bulk operations utilities
  static async bulkUpdateUserQuotas(updates: Array<{ userId: string; monthlyUsage: number }>): Promise<void> {
    const bulkOps = updates.map(({ userId, monthlyUsage }) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(userId) },
        update: { $set: { monthlyUsage } }
      }
    }));

    if (bulkOps.length > 0) {
      await UserModel.bulkWrite(bulkOps);
    }
  }

  static async bulkUpdateGenerationStatus(generationIds: string[], status: string, errorMessage?: string): Promise<void> {
    const update: any = { status };
    if (errorMessage) {
      update.errorMessage = errorMessage;
    }

    await ImageGenerationModel.updateMany(
      { _id: { $in: generationIds.map(id => new Types.ObjectId(id)) } },
      update
    );
  }

  // Maintenance utilities
  static async performMaintenanceCleanup(): Promise<{
    oldGenerationsRemoved: number;
    failedGenerationsRemoved: number;
    subscriptionsUpdated: number;
  }> {
    const results = {
      oldGenerationsRemoved: 0,
      failedGenerationsRemoved: 0,
      subscriptionsUpdated: 0
    };

    // Clean up old completed generations (older than 90 days)
    const oldGenerationsCutoff = new Date();
    oldGenerationsCutoff.setDate(oldGenerationsCutoff.getDate() - 90);
    
    const oldGenerationsResult = await ImageGenerationModel.deleteMany({
      status: 'completed',
      createdAt: { $lt: oldGenerationsCutoff }
    });
    results.oldGenerationsRemoved = oldGenerationsResult.deletedCount || 0;

    // Clean up failed generations (older than 7 days)
    const failedGenerationsCutoff = new Date();
    failedGenerationsCutoff.setDate(failedGenerationsCutoff.getDate() - 7);
    
    const failedGenerationsResult = await ImageGenerationModel.deleteMany({
      status: 'failed',
      createdAt: { $lt: failedGenerationsCutoff }
    });
    results.failedGenerationsRemoved = failedGenerationsResult.deletedCount || 0;

    // Update expired subscription statuses
    const expiredSubscriptions = await SubscriptionModel.findExpiredSubscriptions();
    for (const subscription of expiredSubscriptions) {
      subscription.status = 'past_due';
      await subscription.save();
      results.subscriptionsUpdated++;
    }

    return results;
  }

  // Helper methods
  private static async getSubscriptionCounts(): Promise<Record<SubscriptionTier, number>> {
    const [free, plus, pro] = await Promise.all([
      SubscriptionModel.findByTier('free'),
      SubscriptionModel.findByTier('plus'),
      SubscriptionModel.findByTier('pro')
    ]);

    return {
      free: free.length,
      plus: plus.length,
      pro: pro.length
    };
  }
}

// Export convenience functions
export const checkUserQuota = DatabaseUtils.checkUserQuota.bind(DatabaseUtils);
export const consumeUserQuota = DatabaseUtils.consumeUserQuota.bind(DatabaseUtils);
export const resetUserQuota = DatabaseUtils.resetUserQuota.bind(DatabaseUtils);
export const validateUserSubscription = DatabaseUtils.validateUserSubscription.bind(DatabaseUtils);
export const upgradeUserSubscription = DatabaseUtils.upgradeUserSubscription.bind(DatabaseUtils);
export const createImageGeneration = DatabaseUtils.createImageGeneration.bind(DatabaseUtils);
export const getImageGenerationHistory = DatabaseUtils.getImageGenerationHistory.bind(DatabaseUtils);
export const getUserAnalytics = DatabaseUtils.getUserAnalytics.bind(DatabaseUtils);
export const getSystemAnalytics = DatabaseUtils.getSystemAnalytics.bind(DatabaseUtils);
export const performMaintenanceCleanup = DatabaseUtils.performMaintenanceCleanup.bind(DatabaseUtils);

export default DatabaseUtils;