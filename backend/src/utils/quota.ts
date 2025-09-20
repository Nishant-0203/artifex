import { UserModel, SubscriptionModel, ImageGenerationModel } from '../models';
import { 
  SUBSCRIPTION_QUOTAS, 
  SubscriptionTier, 
  ImageGenerationType,
  QuotaInfo,
  QuotaValidationResult,
  QuotaCheckOptions,
  QuotaOperationResult 
} from '../types';
import { logger } from './logger';

/**
 * Quota utility functions for common quota operations across image generation endpoints
 */
export class QuotaUtils {
  
  /**
   * Calculate quota costs for different generation types
   */
  static calculateGenerationCost(type: ImageGenerationType, options: {
    quality?: 'standard' | 'hd';
    batchSize?: number;
    aspectRatio?: string;
    style?: string;
  } = {}): number {
    const { quality = 'standard', batchSize = 1, aspectRatio = '1:1', style = 'realistic' } = options;
    
    let baseCost = 1; // Default cost per generation
    
    // Cost multipliers based on type
    const typeMultipliers = {
      'text-to-image': 1.0,
      'image-to-image': 1.2,
      'multi-image': 1.5,
      'refine': 0.8
    };
    
    baseCost *= typeMultipliers[type] || 1.0;
    
    // Quality multiplier
    if (quality === 'hd') {
      baseCost *= 1.5;
    }
    
    // Aspect ratio multiplier (larger images cost more)
    const aspectRatioMultipliers: Record<string, number> = {
      '1:1': 1.0,
      '4:3': 1.1,
      '3:4': 1.1,
      '16:9': 1.2,
      '9:16': 1.2
    };
    
    baseCost *= aspectRatioMultipliers[aspectRatio] || 1.0;
    
    // Style complexity multiplier
    const styleMultipliers: Record<string, number> = {
      'realistic': 1.0,
      'artistic': 1.1,
      'cartoon': 0.9,
      'abstract': 1.2,
      'photographic': 1.3
    };
    
    baseCost *= styleMultipliers[style] || 1.0;
    
    // Batch multiplier (slight discount for bulk)
    const batchMultiplier = batchSize > 1 ? Math.max(0.9, 1 - (batchSize * 0.02)) : 1;
    
    return Math.ceil(baseCost * batchSize * batchMultiplier);
  }
  
  /**
   * Check feature availability based on subscription tier
   */
  static checkFeatureAvailability(tier: SubscriptionTier, feature: string): {
    available: boolean;
    reason?: string;
    upgradeRequired?: boolean;
    recommendedTier?: SubscriptionTier;
  } {
    const tierFeatures = {
      free: [
        'basic_generation',
        'standard_quality',
        'basic_styles'
      ],
      plus: [
        'basic_generation',
        'standard_quality',
        'basic_styles',
        'hd_quality',
        'advanced_styles',
        'image_to_image',
        'batch_generation_small'
      ],
      pro: [
        'basic_generation',
        'standard_quality',
        'basic_styles',
        'hd_quality',
        'advanced_styles',
        'image_to_image',
        'batch_generation_small',
        'batch_generation_large',
        'custom_models',
        'commercial_license',
        'priority_processing',
        'api_access'
      ]
    };
    
    const available = tierFeatures[tier]?.includes(feature) || false;
    
    if (!available) {
      // Find the minimum tier that supports this feature
      let recommendedTier: SubscriptionTier = 'plus';
      for (const [t, features] of Object.entries(tierFeatures)) {
        if (features.includes(feature)) {
          recommendedTier = t as SubscriptionTier;
          break;
        }
      }
      
      return {
        available: false,
        reason: `Feature '${feature}' not available in ${tier} tier`,
        upgradeRequired: true,
        recommendedTier
      };
    }
    
    return { available: true };
  }
  
  /**
   * Validate generation parameters against tier limits
   */
  static validateGenerationParameters(tier: SubscriptionTier, params: {
    type: ImageGenerationType;
    quality?: 'standard' | 'hd';
    batchSize?: number;
    style?: string;
    customModel?: boolean;
  }): {
    valid: boolean;
    violations: string[];
    recommendations: string[];
  } {
    const { type, quality = 'standard', batchSize = 1, style = 'realistic', customModel = false } = params;
    const violations: string[] = [];
    const recommendations: string[] = [];
    
    // Check HD quality
    if (quality === 'hd' && tier === 'free') {
      violations.push('HD quality not available in free tier');
      recommendations.push('Upgrade to Plus for HD image generation');
    }
    
    // Check batch size limits
    const batchLimits = {
      free: 1,
      plus: 5,
      pro: 20
    };
    
    if (batchSize > batchLimits[tier]) {
      violations.push(`Batch size ${batchSize} exceeds limit of ${batchLimits[tier]} for ${tier} tier`);
      if (tier === 'free') {
        recommendations.push('Upgrade to Plus for batch processing');
      } else if (tier === 'plus') {
        recommendations.push('Upgrade to Pro for larger batch sizes');
      }
    }
    
    // Check custom models
    if (customModel && tier !== 'pro') {
      violations.push('Custom models only available in Pro tier');
      recommendations.push('Upgrade to Pro for custom model access');
    }
    
    // Check generation type restrictions
    if (type === 'multi-image' && tier === 'free') {
      violations.push('Multi-image generation not available in free tier');
      recommendations.push('Upgrade to Plus for advanced generation types');
    }
    
    // Check advanced styles
    const advancedStyles = ['photographic', 'abstract', 'cinematic'];
    if (advancedStyles.includes(style) && tier === 'free') {
      violations.push(`Advanced style '${style}' not available in free tier`);
      recommendations.push('Upgrade to Plus for advanced artistic styles');
    }
    
    return {
      valid: violations.length === 0,
      violations,
      recommendations
    };
  }
  
  /**
   * Get comprehensive quota status for a user
   */
  static async getQuotaStatus(userId: string): Promise<QuotaInfo> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const monthlyLimit = SUBSCRIPTION_QUOTAS[user.subscriptionTier];
    const remainingQuota = Math.max(0, monthlyLimit - user.monthlyUsage);
    const quotaPercentageUsed = Math.round((user.monthlyUsage / monthlyLimit) * 100);
    
    return {
      userId: user.id,
      subscriptionTier: user.subscriptionTier,
      monthlyUsage: user.monthlyUsage,
      monthlyLimit,
      remainingQuota,
      quotaResetDate: user.quotaResetDate,
      quotaPercentageUsed,
      canGenerate: user.canGenerateImages(1),
      // Add convenience aliases for orchestrator compatibility
      remaining: remainingQuota,
      resetDate: user.quotaResetDate
    };
  }
  
  /**
   * Check if user can perform a specific generation
   */
  static async checkGenerationEligibility(
    userId: string, 
    options: QuotaCheckOptions = {}
  ): Promise<QuotaValidationResult> {
    const { credits = 1, generationType = 'text-to-image', requiresPremium = false } = options;
    
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const quotaInfo = await this.getQuotaStatus(userId);
    
    // Check if premium is required but user is on free tier
    if (requiresPremium && user.subscriptionTier === 'free') {
      return {
        allowed: false,
        reason: 'Premium subscription required for this feature',
        requiredCredits: credits,
        quotaInfo,
        upgradeRequired: true,
        nextTier: 'plus'
      };
    }
    
    // Check quota availability
    if (!user.canGenerateImages(credits)) {
      const nextTier = user.subscriptionTier === 'free' ? 'plus' : 'pro';
      return {
        allowed: false,
        reason: 'Monthly quota exceeded',
        requiredCredits: credits,
        quotaInfo,
        upgradeRequired: user.subscriptionTier !== 'pro',
        nextTier
      };
    }
    
    return {
      allowed: true,
      requiredCredits: credits,
      quotaInfo
    };
  }
  
  /**
   * Consume user quota with validation
   */
  static async consumeQuota(userId: string, credits: number = 1): Promise<QuotaOperationResult> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        return {
          success: false,
          userId,
          error: 'User not found'
        };
      }
      
      if (!user.canGenerateImages(credits)) {
        return {
          success: false,
          userId,
          error: 'Insufficient quota remaining'
        };
      }
      
      await user.incrementUsage(credits);
      const remainingQuota = user.getRemainingQuota();
      
      return {
        success: true,
        userId,
        creditsConsumed: credits,
        remainingQuota
      };
      
    } catch (error) {
      logger.error('Error consuming quota:', error as Error);
      return {
        success: false,
        userId,
        error: (error as Error).message
      };
    }
  }
  
  /**
   * Get usage analytics for a user
   */
  static async getUserUsageAnalytics(userId: string, days: number = 30): Promise<{
    totalUsage: number;
    dailyUsage: Record<string, number>;
    typeBreakdown: Record<string, number>;
    averageDaily: number;
    projectedMonthly: number;
    efficiency: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const generations = await ImageGenerationModel.findRecentByUser(userId, days);
    const totalUsage = generations.reduce((sum: number, gen: any) => sum + gen.credits, 0);
    
    // Daily usage breakdown
    const dailyUsage = generations.reduce((acc: Record<string, number>, gen: any) => {
      const date = gen.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + gen.credits;
      return acc;
    }, {});
    
    // Type breakdown
    const typeBreakdown = generations.reduce((acc: Record<string, number>, gen: any) => {
      acc[gen.type] = (acc[gen.type] || 0) + gen.credits;
      return acc;
    }, {});
    
    // Calculate metrics
    const averageDaily = totalUsage / days;
    const projectedMonthly = averageDaily * 30;
    
    // Efficiency: successful generations / total attempts
    const successfulGens = generations.filter((gen: any) => gen.status === 'completed').length;
    const efficiency = generations.length > 0 ? (successfulGens / generations.length) * 100 : 0;
    
    return {
      totalUsage,
      dailyUsage,
      typeBreakdown,
      averageDaily,
      projectedMonthly,
      efficiency
    };
  }
  
  /**
   * Get quota recommendations for a user
   */
  static async getQuotaRecommendations(userId: string): Promise<string[]> {
    const quotaInfo = await this.getQuotaStatus(userId);
    const analytics = await this.getUserUsageAnalytics(userId, 30);
    const recommendations: string[] = [];
    
    // Usage pattern recommendations
    if (quotaInfo.quotaPercentageUsed >= 90) {
      recommendations.push('You\'ve used 90% of your monthly quota. Consider upgrading your plan.');
    } else if (quotaInfo.quotaPercentageUsed >= 75) {
      recommendations.push('You\'re approaching your monthly limit. Monitor usage carefully.');
    }
    
    // Efficiency recommendations
    if (analytics.efficiency < 70) {
      recommendations.push('Consider refining your prompts to improve generation success rate.');
    }
    
    // Usage trend recommendations
    if (analytics.projectedMonthly > quotaInfo.monthlyLimit) {
      const overage = Math.ceil(analytics.projectedMonthly - quotaInfo.monthlyLimit);
      recommendations.push(`Based on current usage, you may exceed your limit by ${overage} images.`);
    }
    
    // Tier-specific recommendations
    if (quotaInfo.subscriptionTier === 'free' && quotaInfo.quotaPercentageUsed >= 50) {
      recommendations.push('Upgrade to Plus for 10x more images per month.');
    } else if (quotaInfo.subscriptionTier === 'plus' && quotaInfo.quotaPercentageUsed >= 80) {
      recommendations.push('Upgrade to Pro for even more capacity and advanced features.');
    }
    
    // Reset timing recommendations
    const daysUntilReset = Math.ceil(
      (quotaInfo.quotaResetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilReset <= 7 && quotaInfo.quotaPercentageUsed >= 50) {
      recommendations.push(`Your quota resets in ${daysUntilReset} days.`);
    }
    
    return recommendations;
  }
  
  /**
   * Validate bulk generation request
   */
  static async validateBulkGeneration(
    userId: string,
    requests: Array<{
      type: ImageGenerationType;
      quality?: 'standard' | 'hd';
      style?: string;
    }>
  ): Promise<{
    valid: boolean;
    totalCost: number;
    violations: string[];
    allowedRequests: number;
    maxBatchSize: number;
  }> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const violations: string[] = [];
    let totalCost = 0;
    
    // Calculate total cost
    for (const request of requests) {
      const cost = this.calculateGenerationCost(request.type, {
        quality: request.quality,
        style: request.style
      });
      totalCost += cost;
    }
    
    // Check batch size limits
    const maxBatchSizes = { free: 1, plus: 5, pro: 20 };
    const maxBatchSize = maxBatchSizes[user.subscriptionTier];
    
    if (requests.length > maxBatchSize) {
      violations.push(`Batch size ${requests.length} exceeds limit of ${maxBatchSize}`);
    }
    
    // Check quota availability
    const remainingQuota = user.getRemainingQuota();
    const allowedRequests = Math.min(
      Math.floor(remainingQuota / Math.ceil(totalCost / requests.length)),
      maxBatchSize
    );
    
    if (totalCost > remainingQuota) {
      violations.push(`Total cost ${totalCost} exceeds remaining quota of ${remainingQuota}`);
    }
    
    return {
      valid: violations.length === 0,
      totalCost,
      violations,
      allowedRequests,
      maxBatchSize
    };
  }
}

// Export convenience functions
export const calculateGenerationCost = QuotaUtils.calculateGenerationCost.bind(QuotaUtils);
export const checkFeatureAvailability = QuotaUtils.checkFeatureAvailability.bind(QuotaUtils);
export const validateGenerationParameters = QuotaUtils.validateGenerationParameters.bind(QuotaUtils);
export const getQuotaStatus = QuotaUtils.getQuotaStatus.bind(QuotaUtils);
export const checkGenerationEligibility = QuotaUtils.checkGenerationEligibility.bind(QuotaUtils);
export const consumeQuota = QuotaUtils.consumeQuota.bind(QuotaUtils);
export const getUserUsageAnalytics = QuotaUtils.getUserUsageAnalytics.bind(QuotaUtils);
export const getQuotaRecommendations = QuotaUtils.getQuotaRecommendations.bind(QuotaUtils);
export const validateBulkGeneration = QuotaUtils.validateBulkGeneration.bind(QuotaUtils);

export default QuotaUtils;