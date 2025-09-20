import { Request, Response, NextFunction } from 'express';
import { UserModel, SubscriptionModel } from '../models';
import { logger } from '../utils/logger';
import { getAuthenticatedUserId } from './auth';
import { SubscriptionInfo, TierPermissions } from '../types';

// Extend Express Request interface for subscription middleware
declare global {
  namespace Express {
    interface Request {
      subscriptionInfo?: SubscriptionInfo;
      tierPermissions?: TierPermissions;
    }
  }
}

export interface SubscriptionValidationResult {
  valid: boolean;
  subscription: SubscriptionInfo;
  reason?: string;
  upgradeRequired?: boolean;
  recommendedTier?: 'plus' | 'pro';
}

// Map Clerk subscription status to our internal status
const mapSubscriptionStatus = (clerkStatus: any): 'active' | 'inactive' | 'trialing' | 'past_due' | 'canceled' => {
  switch (clerkStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
    case 'unpaid':
    default:
      return 'inactive';
  }
};

// Tier permission configurations
const TIER_PERMISSIONS: Record<string, TierPermissions> = {
  free: {
    maxImageGenerations: 10,
    allowsHighResolution: false,
    allowsAdvancedFeatures: false,
    allowsCommercialUse: false,
    allowsAPIAccess: false,
    allowsPriorityProcessing: false,
    maxConcurrentGenerations: 1,
    allowsCustomModels: false,
    allowsBatchProcessing: false,
    allowsImageUpscaling: false,
  },
  plus: {
    maxImageGenerations: 100,
    allowsHighResolution: true,
    allowsAdvancedFeatures: true,
    allowsCommercialUse: false,
    allowsAPIAccess: true,
    allowsPriorityProcessing: false,
    maxConcurrentGenerations: 3,
    allowsCustomModels: false,
    allowsBatchProcessing: false,
    allowsImageUpscaling: true,
  },
  pro: {
    maxImageGenerations: 1000,
    allowsHighResolution: true,
    allowsAdvancedFeatures: true,
    allowsCommercialUse: true,
    allowsAPIAccess: true,
    allowsPriorityProcessing: true,
    maxConcurrentGenerations: 10,
    allowsCustomModels: true,
    allowsBatchProcessing: true,
    allowsImageUpscaling: true,
  },
};

/**
 * Middleware to validate subscription and attach subscription info to request
 */
export const validateSubscription = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getAuthenticatedUserId(req);
      
      // Get user and subscription from database
      const [user, subscription] = await Promise.all([
        UserModel.findById(userId),
        SubscriptionModel.findByUserId(userId)
      ]);

      if (!user) {
        res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      // Build subscription info
      const subscriptionInfo: SubscriptionInfo = {
        userId: user.id,
        tier: user.subscriptionTier,
        status: mapSubscriptionStatus(subscription?.status) || 'inactive',
        isActive: subscription?.isActive() || false,
        isInTrial: subscription?.isInTrial() || false,
        hasExpired: subscription?.hasExpired() || false,
        currentPeriodEnd: subscription?.currentPeriodEnd,
        trialEnd: subscription?.trialEnd,
        clerkSubscriptionId: subscription?.clerkSubscriptionId,
        clerkPlanId: subscription?.clerkPlanId,
        features: getFeaturesByTier(user.subscriptionTier),
        permissions: TIER_PERMISSIONS[user.subscriptionTier] || TIER_PERMISSIONS.free
      };

      req.subscriptionInfo = subscriptionInfo;
      req.tierPermissions = subscriptionInfo.permissions;

      logger.debug(`Subscription validation passed for user ${userId}`, {
        tier: subscriptionInfo.tier,
        status: subscriptionInfo.status,
        isActive: subscriptionInfo.isActive
      });

      next();

    } catch (error) {
      logger.error('Error in subscription validation middleware:', error as Error);
      res.status(500).json({
        error: 'Internal server error during subscription validation',
        code: 'SUBSCRIPTION_VALIDATION_ERROR'
      });
    }
  };
};

/**
 * Middleware to require specific subscription tier
 */
export const requireTier = (requiredTiers: Array<'free' | 'plus' | 'pro'>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.subscriptionInfo) {
        // Run subscription validation first if not already done
        await new Promise<void>((resolve, reject) => {
          validateSubscription()(req, res, (error?: any) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      const subscription = req.subscriptionInfo!;

      if (!requiredTiers.includes(subscription.tier)) {
        const recommendedTier = getRecommendedUpgrade(subscription.tier, requiredTiers);
        
        res.status(403).json({
          error: 'Subscription tier insufficient',
          code: 'TIER_INSUFFICIENT',
          details: {
            currentTier: subscription.tier,
            requiredTiers,
            recommendedTier,
            upgradeRequired: true
          }
        });
        return;
      }

      next();

    } catch (error) {
      logger.error('Error in tier requirement middleware:', error as Error);
      res.status(500).json({
        error: 'Internal server error during tier validation',
        code: 'TIER_VALIDATION_ERROR'
      });
    }
  };
};

/**
 * Middleware to require active subscription
 */
export const requireActiveSubscription = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.subscriptionInfo) {
        await new Promise<void>((resolve, reject) => {
          validateSubscription()(req, res, (error?: any) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      const subscription = req.subscriptionInfo!;

      // Free tier users are considered "active" for basic features
      if (subscription.tier === 'free') {
        next();
        return;
      }

      if (!subscription.isActive && !subscription.isInTrial) {
        res.status(403).json({
          error: 'Active subscription required',
          code: 'SUBSCRIPTION_INACTIVE',
          details: {
            currentStatus: subscription.status,
            tier: subscription.tier,
            hasExpired: subscription.hasExpired,
            upgradeRequired: true
          }
        });
        return;
      }

      next();

    } catch (error) {
      logger.error('Error in active subscription middleware:', error as Error);
      res.status(500).json({
        error: 'Internal server error during subscription activation check',
        code: 'SUBSCRIPTION_ACTIVATION_ERROR'
      });
    }
  };
};

/**
 * Middleware to check specific feature permissions
 */
export const requireFeature = (feature: keyof TierPermissions) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tierPermissions) {
        await new Promise<void>((resolve, reject) => {
          validateSubscription()(req, res, (error?: any) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      const permissions = req.tierPermissions!;
      const featureAllowed = permissions[feature];

      if (!featureAllowed) {
        const recommendedTier = getFeatureRecommendedTier(feature);
        
        res.status(403).json({
          error: 'Feature not available in current tier',
          code: 'FEATURE_NOT_AVAILABLE',
          details: {
            feature,
            currentTier: req.subscriptionInfo?.tier,
            recommendedTier,
            upgradeRequired: true
          }
        });
        return;
      }

      next();

    } catch (error) {
      logger.error('Error in feature requirement middleware:', error as Error);
      res.status(500).json({
        error: 'Internal server error during feature validation',
        code: 'FEATURE_VALIDATION_ERROR'
      });
    }
  };
};

/**
 * Middleware to check generation limits based on subscription tier
 */
export const checkGenerationLimits = (options: {
  quality?: 'standard' | 'hd';
  batchSize?: number;
  requiresCustomModel?: boolean;
} = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tierPermissions || !req.subscriptionInfo) {
        await new Promise<void>((resolve, reject) => {
          validateSubscription()(req, res, (error?: any) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      const permissions = req.tierPermissions!;
      const subscription = req.subscriptionInfo!;
      const { quality = 'standard', batchSize = 1, requiresCustomModel = false } = options;

      // Check high resolution permission
      if (quality === 'hd' && !permissions.allowsHighResolution) {
        res.status(403).json({
          error: 'High resolution images not available in current tier',
          code: 'HD_NOT_AVAILABLE',
          details: {
            currentTier: subscription.tier,
            recommendedTier: 'plus',
            upgradeRequired: true
          }
        });
        return;
      }

      // Check batch processing permission
      if (batchSize > 1 && !permissions.allowsBatchProcessing) {
        res.status(403).json({
          error: 'Batch processing not available in current tier',
          code: 'BATCH_NOT_AVAILABLE',
          details: {
            currentTier: subscription.tier,
            maxBatchSize: 1,
            recommendedTier: 'pro',
            upgradeRequired: true
          }
        });
        return;
      }

      // Check custom model permission
      if (requiresCustomModel && !permissions.allowsCustomModels) {
        res.status(403).json({
          error: 'Custom models not available in current tier',
          code: 'CUSTOM_MODELS_NOT_AVAILABLE',
          details: {
            currentTier: subscription.tier,
            recommendedTier: 'pro',
            upgradeRequired: true
          }
        });
        return;
      }

      next();

    } catch (error) {
      logger.error('Error in generation limits middleware:', error as Error);
      res.status(500).json({
        error: 'Internal server error during generation limits check',
        code: 'GENERATION_LIMITS_ERROR'
      });
    }
  };
};

/**
 * Get subscription status endpoint
 */
export const getSubscriptionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);
    
    const [user, subscription] = await Promise.all([
      UserModel.findById(userId),
      SubscriptionModel.findByUserId(userId)
    ]);

    if (!user) {
      res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const subscriptionInfo: SubscriptionInfo = {
      userId: user.id,
      tier: user.subscriptionTier,
      status: mapSubscriptionStatus(subscription?.status) || 'inactive',
      isActive: subscription?.isActive() || false,
      isInTrial: subscription?.isInTrial() || false,
      hasExpired: subscription?.hasExpired() || false,
      currentPeriodEnd: subscription?.currentPeriodEnd,
      trialEnd: subscription?.trialEnd,
      clerkSubscriptionId: subscription?.clerkSubscriptionId,
      clerkPlanId: subscription?.clerkPlanId,
      features: getFeaturesByTier(user.subscriptionTier),
      permissions: TIER_PERMISSIONS[user.subscriptionTier] || TIER_PERMISSIONS.free
    };

    // Get available upgrade paths
    const availableUpgrades = getAvailableUpgrades(user.subscriptionTier);
    
    // Get billing information from Clerk (placeholder)
    const billingInfo = subscription ? {
      nextBillingDate: subscription.currentPeriodEnd,
      amount: getSubscriptionAmount(user.subscriptionTier),
      currency: 'USD',
      paymentMethod: 'card' // This would come from Clerk
    } : null;

    res.json({
      subscription: subscriptionInfo,
      billing: billingInfo,
      upgrades: availableUpgrades,
      tierComparison: TIER_PERMISSIONS
    });

  } catch (error) {
    logger.error('Error getting subscription status:', error as Error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SUBSCRIPTION_STATUS_ERROR'
    });
  }
};

// Helper functions
const getFeaturesByTier = (tier: string): string[] => {
  const permissions = TIER_PERMISSIONS[tier] || TIER_PERMISSIONS.free;
  const features: string[] = [];

  if (permissions.allowsHighResolution) features.push('High Resolution Images');
  if (permissions.allowsAdvancedFeatures) features.push('Advanced AI Features');
  if (permissions.allowsCommercialUse) features.push('Commercial Use License');
  if (permissions.allowsAPIAccess) features.push('API Access');
  if (permissions.allowsPriorityProcessing) features.push('Priority Processing');
  if (permissions.allowsCustomModels) features.push('Custom AI Models');
  if (permissions.allowsBatchProcessing) features.push('Batch Processing');
  if (permissions.allowsImageUpscaling) features.push('Image Upscaling');

  return features;
};

const getRecommendedUpgrade = (currentTier: string, requiredTiers: string[]): string => {
  const tierOrder = ['free', 'plus', 'pro'];
  const currentIndex = tierOrder.indexOf(currentTier);
  
  for (const tier of requiredTiers) {
    const tierIndex = tierOrder.indexOf(tier);
    if (tierIndex > currentIndex) {
      return tier;
    }
  }
  
  return 'plus';
};

const getFeatureRecommendedTier = (feature: keyof TierPermissions): string => {
  for (const [tier, permissions] of Object.entries(TIER_PERMISSIONS)) {
    if (permissions[feature] && tier !== 'free') {
      return tier;
    }
  }
  return 'plus';
};

const getAvailableUpgrades = (currentTier: string): Array<{tier: string, features: string[], price: number}> => {
  const tierOrder = ['free', 'plus', 'pro'];
  const currentIndex = tierOrder.indexOf(currentTier);
  
  return tierOrder.slice(currentIndex + 1).map(tier => ({
    tier,
    features: getFeaturesByTier(tier),
    price: getSubscriptionAmount(tier)
  }));
};

const getSubscriptionAmount = (tier: string): number => {
  const amounts = { free: 0, plus: 9.99, pro: 29.99 };
  return amounts[tier as keyof typeof amounts] || 0;
};

export default {
  validateSubscription,
  requireTier,
  requireActiveSubscription,
  requireFeature,
  checkGenerationLimits,
  getSubscriptionStatus,
  TIER_PERMISSIONS
};