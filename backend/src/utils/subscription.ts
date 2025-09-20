import { SubscriptionModel, UserModel } from '../models';
import { 
  SubscriptionTier, 
  ClerkSubscriptionStatus,
  ClerkSubscriptionData,
  ClerkWebhookEvent,
  ClerkSubscriptionWebhookData,
  SubscriptionChangeRequest,
  SubscriptionChangeResult,
  SubscriptionInfo,
  SubscriptionValidationResult,
  SUBSCRIPTION_QUOTAS
} from '../types';
import { logger } from './logger';

/**
 * Subscription utility functions for Clerk subscription-related operations
 */
export class SubscriptionUtils {
  
  /**
   * Fetch subscription data from Clerk API (placeholder - would integrate with actual Clerk API)
   */
  static async fetchSubscriptionFromClerk(clerkSubscriptionId: string): Promise<ClerkSubscriptionData | null> {
    try {
      // This would be replaced with actual Clerk API call
      // For now, returning a placeholder structure
      logger.info(`Fetching subscription ${clerkSubscriptionId} from Clerk API`);
      
      // Placeholder response - in real implementation, this would call Clerk's API
      const clerkData = await this.callClerkAPI(`/subscriptions/${clerkSubscriptionId}`);
      
      return clerkData;
      
    } catch (error) {
      logger.error('Error fetching subscription from Clerk:', error as Error);
      return null;
    }
  }
  
  /**
   * Validate subscription tier change through Clerk API
   */
  static async validateTierChange(
    clerkSubscriptionId: string,
    newTier: SubscriptionTier
  ): Promise<{
    valid: boolean;
    reason?: string;
    estimatedCost?: number;
    effectiveDate?: Date;
  }> {
    try {
      // Get current subscription from Clerk
      const clerkSubscription = await this.fetchSubscriptionFromClerk(clerkSubscriptionId);
      
      if (!clerkSubscription) {
        return {
          valid: false,
          reason: 'Subscription not found in Clerk'
        };
      }
      
      // Check if change is valid
      const currentTier = clerkSubscription.tier;
      const tierOrder = { free: 0, plus: 1, pro: 2 };
      
      if (tierOrder[newTier] === tierOrder[currentTier]) {
        return {
          valid: false,
          reason: 'No change in subscription tier'
        };
      }
      
      // Calculate estimated cost (placeholder logic)
      const tierPrices = { free: 0, plus: 9.99, pro: 29.99 };
      const estimatedCost = tierPrices[newTier];
      
      // Set effective date (immediate for upgrades, end of period for downgrades)
      const effectiveDate = tierOrder[newTier] > tierOrder[currentTier] 
        ? new Date() 
        : clerkSubscription.currentPeriodEnd;
      
      return {
        valid: true,
        estimatedCost,
        effectiveDate
      };
      
    } catch (error) {
      logger.error('Error validating tier change:', error as Error);
      return {
        valid: false,
        reason: 'Error validating tier change'
      };
    }
  }
  
  /**
   * Check feature permissions for a subscription tier
   */
  static checkFeaturePermissions(tier: SubscriptionTier, feature: string): {
    allowed: boolean;
    reason?: string;
    upgradeRequired?: boolean;
    minRequiredTier?: SubscriptionTier;
  } {
    const tierFeatures = {
      free: [
        'basic_generation',
        'standard_quality',
        'basic_styles',
        'gallery_save',
        'download_images'
      ],
      plus: [
        'basic_generation',
        'standard_quality',
        'basic_styles',
        'gallery_save',
        'download_images',
        'hd_quality',
        'advanced_styles',
        'image_to_image',
        'batch_processing',
        'api_access_basic',
        'upscaling',
        'style_transfer'
      ],
      pro: [
        'basic_generation',
        'standard_quality',
        'basic_styles',
        'gallery_save',
        'download_images',
        'hd_quality',
        'advanced_styles',
        'image_to_image',
        'batch_processing',
        'api_access_basic',
        'upscaling',
        'style_transfer',
        'custom_models',
        'commercial_license',
        'priority_processing',
        'api_access_advanced',
        'bulk_operations',
        'white_label'
      ]
    };
    
    const allowed = tierFeatures[tier]?.includes(feature) || false;
    
    if (!allowed) {
      // Find minimum required tier
      let minRequiredTier: SubscriptionTier = 'plus';
      for (const [t, features] of Object.entries(tierFeatures)) {
        if (features.includes(feature)) {
          minRequiredTier = t as SubscriptionTier;
          break;
        }
      }
      
      return {
        allowed: false,
        reason: `Feature '${feature}' requires ${minRequiredTier} tier or higher`,
        upgradeRequired: true,
        minRequiredTier
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Process Clerk webhook events
   */
  static async processClerkWebhook(event: ClerkWebhookEvent): Promise<{
    processed: boolean;
    action?: string;
    userId?: string;
    error?: string;
  }> {
    try {
      logger.info(`Processing Clerk webhook: ${event.type}`);
      
      switch (event.type) {
        case 'subscription.created':
          return await this.handleSubscriptionCreated(event.data);
          
        case 'subscription.updated':
          return await this.handleSubscriptionUpdated(event.data);
          
        case 'subscription.deleted':
          return await this.handleSubscriptionDeleted(event.data);
          
        case 'subscription.trial_will_end':
          return await this.handleTrialWillEnd(event.data);
          
        case 'customer.subscription.payment_succeeded':
          return await this.handlePaymentSucceeded(event.data);
          
        case 'customer.subscription.payment_failed':
          return await this.handlePaymentFailed(event.data);
          
        default:
          logger.warn(`Unhandled webhook event type: ${event.type}`);
          return { processed: false, error: `Unhandled event type: ${event.type}` };
      }
      
    } catch (error) {
      logger.error('Error processing Clerk webhook:', error as Error);
      return { 
        processed: false, 
        error: (error as Error).message 
      };
    }
  }
  
  /**
   * Get subscription analytics and reporting
   */
  static async getSubscriptionAnalytics(options: {
    startDate?: Date;
    endDate?: Date;
    tier?: SubscriptionTier;
  } = {}): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    tierDistribution: Record<SubscriptionTier, number>;
    churnRate: number;
    upgradeRate: number;
    revenue: {
      monthly: number;
      annual: number;
      projected: number;
    };
    usageMetrics: {
      averageMonthlyUsage: Record<SubscriptionTier, number>;
      quotaUtilization: Record<SubscriptionTier, number>;
    };
  }> {
    const { startDate, endDate, tier } = options;
    
    // Build query filters
    const query: any = { isDeleted: false };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }
    if (tier) query.tier = tier;
    
    // Get subscription data
    const subscriptions = await SubscriptionModel.find(query);
    const activeSubscriptions = subscriptions.filter((sub: any) => sub.isActive());
    const trialSubscriptions = subscriptions.filter((sub: any) => sub.isInTrial());
    
    // Calculate tier distribution
    const tierDistribution = subscriptions.reduce((acc: any, sub: any) => {
      acc[sub.tier as SubscriptionTier] = (acc[sub.tier as SubscriptionTier] || 0) + 1;
      return acc;
    }, { free: 0, plus: 0, pro: 0 });
    
    // Calculate rates (placeholder logic - would need historical data)
    const churnRate = 0.05; // 5% placeholder
    const upgradeRate = 0.15; // 15% placeholder
    
    // Calculate revenue
    const tierPrices = { free: 0, plus: 9.99, pro: 29.99 };
    const monthlyRevenue = activeSubscriptions.reduce((sum: number, sub: any) => {
      return sum + tierPrices[sub.tier as SubscriptionTier];
    }, 0);
    
    // Get usage metrics
    const usageMetrics = await this.calculateUsageMetrics();
    
    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: activeSubscriptions.length,
      trialSubscriptions: trialSubscriptions.length,
      tierDistribution,
      churnRate,
      upgradeRate,
      revenue: {
        monthly: monthlyRevenue,
        annual: monthlyRevenue * 12,
        projected: monthlyRevenue * 12 * (1 + upgradeRate)
      },
      usageMetrics
    };
  }
  
  /**
   * Update user quota when subscription changes
   */
  static async updateUserQuotaOnSubscriptionChange(
    userId: string,
    newTier: SubscriptionTier,
    oldTier?: SubscriptionTier
  ): Promise<{
    success: boolean;
    newQuota: number;
    quotaAdjustment?: number;
    error?: string;
  }> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found', newQuota: 0 };
      }
      
      const newQuota = SUBSCRIPTION_QUOTAS[newTier];
      const oldQuota = oldTier ? SUBSCRIPTION_QUOTAS[oldTier] : user.getRemainingQuota();
      
      // Update user subscription tier
      await user.updateSubscription(newTier);
      
      // Calculate quota adjustment for mid-cycle changes
      let quotaAdjustment = 0;
      if (oldTier && newTier !== oldTier) {
        const quotaDifference = newQuota - SUBSCRIPTION_QUOTAS[oldTier];
        if (quotaDifference > 0) {
          // Upgrade: add the difference to remaining quota
          quotaAdjustment = quotaDifference;
          user.monthlyUsage = Math.max(0, user.monthlyUsage - quotaDifference);
          await user.save();
        }
      }
      
      return {
        success: true,
        newQuota,
        quotaAdjustment
      };
      
    } catch (error) {
      logger.error('Error updating user quota on subscription change:', error as Error);
      return {
        success: false,
        error: (error as Error).message,
        newQuota: 0
      };
    }
  }
  
  /**
   * Get subscription recommendations for a user
   */
  static async getSubscriptionRecommendations(userId: string): Promise<{
    currentTier: SubscriptionTier;
    recommendations: Array<{
      tier: SubscriptionTier;
      reason: string;
      benefits: string[];
      estimatedCost: number;
      potential_savings?: number;
    }>;
    usageAnalysis: {
      utilizationRate: number;
      projectedOverage: number;
      costEfficiency: number;
    };
  }> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const currentTier = user.subscriptionTier;
    const currentQuota = SUBSCRIPTION_QUOTAS[currentTier];
    const utilizationRate = (user.monthlyUsage / currentQuota) * 100;
    
    const recommendations = [];
    const tierPrices = { free: 0, plus: 9.99, pro: 29.99 };
    
    // Analyze usage patterns and make recommendations
    if (currentTier === 'free' && utilizationRate > 70) {
      recommendations.push({
        tier: 'plus' as SubscriptionTier,
        reason: 'High usage approaching free tier limit',
        benefits: ['10x more images', 'HD quality', 'Advanced features'],
        estimatedCost: tierPrices.plus
      });
    }
    
    if (currentTier === 'plus' && utilizationRate > 80) {
      recommendations.push({
        tier: 'pro' as SubscriptionTier,
        reason: 'Heavy usage pattern detected',
        benefits: ['10x more images', 'Commercial license', 'Priority processing', 'Custom models'],
        estimatedCost: tierPrices.pro
      });
    }
    
    if (currentTier === 'pro' && utilizationRate < 30) {
      recommendations.push({
        tier: 'plus' as SubscriptionTier,
        reason: 'Low usage - potential cost savings',
        benefits: ['Reduced cost while maintaining quality features'],
        estimatedCost: tierPrices.plus,
        potential_savings: tierPrices.pro - tierPrices.plus
      });
    }
    
    // Calculate projections
    const projectedOverage = Math.max(0, (user.monthlyUsage * 1.2) - currentQuota);
    const costEfficiency = currentQuota > 0 ? user.monthlyUsage / currentQuota : 0;
    
    return {
      currentTier,
      recommendations,
      usageAnalysis: {
        utilizationRate,
        projectedOverage,
        costEfficiency
      }
    };
  }
  
  // Private helper methods
  
  private static async callClerkAPI(endpoint: string, options?: any): Promise<any> {
    // Placeholder for actual Clerk API integration
    logger.debug(`Calling Clerk API: ${endpoint}`);
    
    // In real implementation, this would make HTTP calls to Clerk's API
    // using proper authentication headers and error handling
    
    return {}; // Placeholder response
  }
  
  private static async handleSubscriptionCreated(data: ClerkSubscriptionWebhookData): Promise<{
    processed: boolean;
    action: string;
    userId?: string;
    error?: string;
  }> {
    try {
      const subscription = await SubscriptionModel.createFromClerk(data);
      await this.updateUserQuotaOnSubscriptionChange(
        subscription.userId,
        subscription.tier
      );
      
      return {
        processed: true,
        action: 'subscription_created',
        userId: subscription.userId
      };
      
    } catch (error) {
      logger.error('Error handling subscription created:', error as Error);
      return {
        processed: false,
        action: 'subscription_created',
        error: (error as Error).message
      };
    }
  }
  
  private static async handleSubscriptionUpdated(data: ClerkSubscriptionWebhookData): Promise<{
    processed: boolean;
    action: string;
    userId?: string;
    error?: string;
  }> {
    try {
      const subscription = await SubscriptionModel.updateFromClerk(data.subscription_id, data);
      
      if (subscription) {
        await this.updateUserQuotaOnSubscriptionChange(
          subscription.userId,
          data.metadata?.tier || subscription.tier
        );
        
        return {
          processed: true,
          action: 'subscription_updated',
          userId: subscription.userId
        };
      }
      
      return {
        processed: false,
        action: 'subscription_updated',
        error: 'Subscription not found'
      };
      
    } catch (error) {
      logger.error('Error handling subscription updated:', error as Error);
      return {
        processed: false,
        action: 'subscription_updated',
        error: (error as Error).message
      };
    }
  }
  
  private static async handleSubscriptionDeleted(data: ClerkSubscriptionWebhookData): Promise<{
    processed: boolean;
    action: string;
    userId?: string;
    error?: string;
  }> {
    try {
      const subscription = await SubscriptionModel.findByClerkId(data.subscription_id);
      
      if (subscription) {
        // Downgrade to free tier
        await subscription.cancel(true);
        await this.updateUserQuotaOnSubscriptionChange(
          subscription.userId,
          'free',
          subscription.tier
        );
        
        return {
          processed: true,
          action: 'subscription_deleted',
          userId: subscription.userId
        };
      }
      
      return {
        processed: false,
        action: 'subscription_deleted',
        error: 'Subscription not found'
      };
      
    } catch (error) {
      logger.error('Error handling subscription deleted:', error as Error);
      return {
        processed: false,
        action: 'subscription_deleted',
        error: (error as Error).message
      };
    }
  }
  
  private static async handleTrialWillEnd(data: ClerkSubscriptionWebhookData): Promise<{
    processed: boolean;
    action: string;
    userId?: string;
    error?: string;
  }> {
    try {
      const subscription = await SubscriptionModel.findByClerkId(data.subscription_id);
      
      if (subscription) {
        // Send trial ending notification (placeholder)
        logger.info(`Trial ending soon for user ${subscription.userId}`);
        
        return {
          processed: true,
          action: 'trial_will_end',
          userId: subscription.userId
        };
      }
      
      return {
        processed: false,
        action: 'trial_will_end',
        error: 'Subscription not found'
      };
      
    } catch (error) {
      logger.error('Error handling trial will end:', error as Error);
      return {
        processed: false,
        action: 'trial_will_end',
        error: (error as Error).message
      };
    }
  }
  
  private static async handlePaymentSucceeded(data: any): Promise<{
    processed: boolean;
    action: string;
    userId?: string;
    error?: string;
  }> {
    // Payment succeeded - ensure subscription is active
    return {
      processed: true,
      action: 'payment_succeeded'
    };
  }
  
  private static async handlePaymentFailed(data: any): Promise<{
    processed: boolean;
    action: string;
    userId?: string;
    error?: string;
  }> {
    // Payment failed - handle accordingly
    return {
      processed: true,
      action: 'payment_failed'
    };
  }
  
  private static async calculateUsageMetrics(): Promise<{
    averageMonthlyUsage: Record<SubscriptionTier, number>;
    quotaUtilization: Record<SubscriptionTier, number>;
  }> {
    // Placeholder implementation
    return {
      averageMonthlyUsage: {
        free: 6.5,
        plus: 45.2,
        pro: 340.8
      },
      quotaUtilization: {
        free: 0.65,
        plus: 0.452,
        pro: 0.341
      }
    };
  }
}

// Export convenience functions
export const fetchSubscriptionFromClerk = SubscriptionUtils.fetchSubscriptionFromClerk.bind(SubscriptionUtils);
export const validateTierChange = SubscriptionUtils.validateTierChange.bind(SubscriptionUtils);
export const checkFeaturePermissions = SubscriptionUtils.checkFeaturePermissions.bind(SubscriptionUtils);
export const processClerkWebhook = SubscriptionUtils.processClerkWebhook.bind(SubscriptionUtils);
export const getSubscriptionAnalytics = SubscriptionUtils.getSubscriptionAnalytics.bind(SubscriptionUtils);
export const updateUserQuotaOnSubscriptionChange = SubscriptionUtils.updateUserQuotaOnSubscriptionChange.bind(SubscriptionUtils);
export const getSubscriptionRecommendations = SubscriptionUtils.getSubscriptionRecommendations.bind(SubscriptionUtils);

export default SubscriptionUtils;