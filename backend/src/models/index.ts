// Export all models
export { UserModel, UserDocument } from './User';
export { SubscriptionModel, SubscriptionDocument } from './Subscription';
export { ImageGenerationModel, ImageGenerationDocument } from './ImageGeneration';

// Export base model utilities
export { BaseDocument, BaseModel, createBaseSchema, addStaticMethods, validators } from './base';

// Model initialization and registration
import { UserModel } from './User';
import { SubscriptionModel } from './Subscription';
import { ImageGenerationModel } from './ImageGeneration';

// Array of all models for initialization
export const models = [
  UserModel,
  SubscriptionModel,
  ImageGenerationModel
];

// Initialize all models and ensure indexes
export async function initializeModels(): Promise<void> {
  try {
    console.log('Initializing database models...');
    
    // Ensure indexes for all models
    const indexPromises = models.map(async (model) => {
      try {
        await model.ensureIndexes();
        console.log(`✅ Indexes created for ${model.modelName}`);
      } catch (error) {
        console.error(`❌ Error creating indexes for ${model.modelName}:`, error);
        throw error;
      }
    });
    
    await Promise.all(indexPromises);
    console.log('✅ All database models initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing models:', error);
    throw error;
  }
}

// Database seeding utilities
export async function createDefaultSubscription(userId: string): Promise<any> {
  try {
    // Check if user already has a subscription
    const existingSubscription = await SubscriptionModel.findByUserId(userId);
    
    if (existingSubscription) {
      return existingSubscription;
    }

    // Create free tier subscription for new users
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const subscription = new SubscriptionModel({
      userId,
      tier: 'free',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: endOfMonth,
      metadata: {
        source: 'auto_created',
        createdAt: now.toISOString()
      }
    });

    return await subscription.save();
  } catch (error) {
    console.error('Error creating default subscription:', error);
    throw error;
  }
}

// Utility functions for common operations
export const modelUtils = {
  // Find user with subscription details
  async findUserWithSubscription(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) return null;

    const subscription = await SubscriptionModel.findByUserId(userId);
    return {
      user: user.toJSON(),
      subscription: subscription?.toJSON() || null
    };
  },

  // Check user quota
  async checkUserQuota(userId: string, requiredCredits: number = 1) {
    const user = await UserModel.findById(userId);
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    if (!user.canGenerateImages(requiredCredits)) {
      return { 
        allowed: false, 
        reason: 'Quota exceeded',
        remaining: user.getRemainingQuota(),
        resetDate: user.quotaResetDate
      };
    }

    return { allowed: true, remaining: user.getRemainingQuota() };
  },

  // Get user generation history
  async getUserGenerationHistory(userId: string, limit: number = 20) {
    return await ImageGenerationModel.findByUserId(userId, limit);
  },

  // Get user statistics
  async getUserStats(userId: string) {
    const user = await UserModel.findById(userId);
    const generationStats = await ImageGenerationModel.getUserStats(userId);
    const subscription = await SubscriptionModel.findByUserId(userId);

    return {
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        monthlyUsage: user.monthlyUsage,
        remainingQuota: user.getRemainingQuota(),
        totalImagesGenerated: user.totalImagesGenerated,
        quotaResetDate: user.quotaResetDate
      } : null,
      subscription: subscription ? {
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        daysUntilRenewal: subscription.getDaysUntilRenewal()
      } : null,
      generations: generationStats
    };
  },

  // Reset monthly quotas for all users
  async resetMonthlyQuotas() {
    return await UserModel.resetAllQuotas();
  },

  // Find stalled image generations
  async findStalledGenerations(minutes: number = 30) {
    return await ImageGenerationModel.findStalledGenerations(minutes);
  },

  // Get system-wide statistics
  async getSystemStats() {
    const userCount = await UserModel.getActiveUsersCount();
    const generationStats = await ImageGenerationModel.getSystemStats();
    const subscriptionsByTier = await Promise.all([
      SubscriptionModel.findByTier('free'),
      SubscriptionModel.findByTier('plus'),
      SubscriptionModel.findByTier('pro')
    ]);

    return {
      users: {
        total: userCount,
        subscriptions: {
          free: subscriptionsByTier[0].length,
          plus: subscriptionsByTier[1].length,
          pro: subscriptionsByTier[2].length
        }
      },
      generations: generationStats
    };
  }
};

// Model relationship utilities
export const relationships = {
  // Populate user with subscription
  populateUserSubscription: {
    path: 'subscriptionId',
    model: 'Subscription',
    select: 'tier status currentPeriodEnd'
  },

  // Populate generation with user
  populateGenerationUser: {
    path: 'userId',
    model: 'User',
    select: 'name email subscriptionTier'
  }
};

// Database maintenance utilities
export const maintenance = {
  // Clean up old completed generations (older than 90 days)
  async cleanupOldGenerations(days: number = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const result = await ImageGenerationModel.deleteMany({
      status: 'completed',
      createdAt: { $lt: cutoff }
    });
    
    console.log(`Cleaned up ${result.deletedCount} old image generations`);
    return result.deletedCount;
  },

  // Clean up failed generations (older than 7 days)
  async cleanupFailedGenerations(days: number = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const result = await ImageGenerationModel.deleteMany({
      status: 'failed',
      createdAt: { $lt: cutoff }
    });
    
    console.log(`Cleaned up ${result.deletedCount} failed image generations`);
    return result.deletedCount;
  },

  // Update subscription statuses from Stripe
  async syncSubscriptionStatuses() {
    const activeSubscriptions = await SubscriptionModel.findActiveSubscriptions();
    let syncCount = 0;

    for (const subscription of activeSubscriptions) {
      if (subscription.hasExpired()) {
        subscription.status = 'past_due';
        await subscription.save();
        syncCount++;
      }
    }

    console.log(`Synced ${syncCount} subscription statuses`);
    return syncCount;
  }
};

export default {
  models,
  initializeModels,
  createDefaultSubscription,
  modelUtils,
  relationships,
  maintenance
};