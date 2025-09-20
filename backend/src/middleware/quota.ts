import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models';
import { DatabaseUtils } from '../utils/database';
import { SUBSCRIPTION_QUOTAS, QuotaInfo, QuotaValidationResult } from '../types';
import { logger } from '../utils/logger';

// Extend Express Request interface for quota middleware
declare global {
  namespace Express {
    interface Request {
      quotaInfo?: QuotaInfo;
      quotaValidation?: QuotaValidationResult;
    }
  }
}


export interface QuotaCheckOptions {
  credits?: number;
  generationType?: string;
  requiresPremium?: boolean;
  bypassQuota?: boolean;
}

/**
 * Middleware to check user quota before image generation
 */
export const checkQuota = (options: QuotaCheckOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { credits = 1, generationType = 'image-generation', requiresPremium = false } = options;
      
      // User should be authenticated at this point
      if (!req.auth?.userId) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
        return;
      }

      // Fetch user from database
      const user = await UserModel.findById(req.auth.userId);
      if (!user) {
        res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      // Get quota information
      const quotaInfo = await getQuotaInfo(user.id, user);

      // Check if premium features are required
      if (requiresPremium && user.subscriptionTier === 'free') {
        const validationResult: QuotaValidationResult = {
          allowed: false,
          reason: 'Premium subscription required for this feature',
          requiredCredits: credits,
          quotaInfo,
          upgradeRequired: true,
          nextTier: 'plus'
        };

        req.quotaValidation = validationResult;
        res.status(403).json({
          error: 'Premium subscription required',
          code: 'PREMIUM_REQUIRED',
          details: validationResult
        });
        return;
      }

      // Check quota availability
      const hasQuota = user.canGenerateImages(credits);
      
      if (!hasQuota) {
        const validationResult: QuotaValidationResult = {
          allowed: false,
          reason: 'Monthly quota exceeded',
          requiredCredits: credits,
          quotaInfo,
          upgradeRequired: quotaInfo.subscriptionTier !== 'pro',
          nextTier: quotaInfo.subscriptionTier === 'free' ? 'plus' : 'pro'
        };

        req.quotaValidation = validationResult;
        res.status(429).json({
          error: 'Monthly quota exceeded',
          code: 'QUOTA_EXCEEDED',
          details: validationResult
        });
        return;
      }

      // Attach quota info to request for later use
      req.quotaInfo = quotaInfo;
      req.quotaValidation = {
        allowed: true,
        requiredCredits: credits,
        quotaInfo
      };

      logger.info(`Quota check passed for user ${user.id}: ${credits} credits, ${quotaInfo.remainingQuota} remaining`);
      next();

    } catch (error) {
      logger.error('Error in quota middleware:', error as Error);
      res.status(500).json({
        error: 'Internal server error during quota check',
        code: 'QUOTA_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware to consume user quota after successful image generation
 */
export const consumeQuota = (options: { credits?: number } = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { credits = 1 } = options;
      
      if (!req.auth?.userId || !req.quotaInfo) {
        next();
        return;
      }

      // Consume the quota
      await DatabaseUtils.consumeUserQuota(req.auth.userId, credits);
      
      logger.info(`Consumed ${credits} credits for user ${req.auth.userId}`);
      next();

    } catch (error) {
      logger.error('Error consuming quota:', error as Error);
      // Don't fail the request if quota consumption fails
      // This should be handled by monitoring/alerts
      next();
    }
  };
};

/**
 * Middleware to add quota information to responses
 */
export const attachQuotaInfo = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json;

    res.json = function(body: any) {
      if (req.quotaInfo) {
        body = {
          ...body,
          quota: {
            used: req.quotaInfo.monthlyUsage,
            limit: req.quotaInfo.monthlyLimit,
            remaining: req.quotaInfo.remainingQuota,
            resetDate: req.quotaInfo.quotaResetDate,
            percentageUsed: req.quotaInfo.quotaPercentageUsed
          }
        };
      }
      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Middleware for quota status endpoint
 */
export const getQuotaStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const user = await UserModel.findById(req.auth.userId);
    if (!user) {
      res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const quotaInfo = await getQuotaInfo(user.id, user);
    
    // Get usage trends for the last 30 days
    const usageHistory = await DatabaseUtils.getImageGenerationHistory(user.id, {
      limit: 100,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    });

    // Calculate daily usage
    const dailyUsage = usageHistory.reduce((acc: Record<string, number>, generation: any) => {
      const date = generation.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + generation.credits;
      return acc;
    }, {});

    res.json({
      quota: quotaInfo,
      usage: {
        daily: dailyUsage,
        recentGenerations: usageHistory.slice(0, 10).map((gen: any) => ({
          id: gen._id,
          type: gen.type,
          credits: gen.credits,
          status: gen.status,
          createdAt: gen.createdAt
        }))
      },
      recommendations: generateQuotaRecommendations(quotaInfo)
    });

  } catch (error) {
    logger.error('Error getting quota status:', error as Error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'QUOTA_STATUS_ERROR'
    });
  }
};

/**
 * Helper function to get comprehensive quota information
 */
export const getQuotaInfo = async (userId: string, user?: any): Promise<QuotaInfo> => {
  if (!user) {
    user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
  }

  const monthlyLimit = SUBSCRIPTION_QUOTAS[user.subscriptionTier as keyof typeof SUBSCRIPTION_QUOTAS];
  const remainingQuota = user.getRemainingQuota();
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
};

/**
 * Generate quota recommendations based on usage
 */
const generateQuotaRecommendations = (quotaInfo: QuotaInfo): string[] => {
  const recommendations: string[] = [];
  
  if (quotaInfo.quotaPercentageUsed >= 90) {
    recommendations.push('You\'ve used 90% of your monthly quota. Consider upgrading your plan.');
  } else if (quotaInfo.quotaPercentageUsed >= 75) {
    recommendations.push('You\'ve used 75% of your monthly quota. Monitor your usage carefully.');
  }

  if (quotaInfo.subscriptionTier === 'free' && quotaInfo.quotaPercentageUsed >= 50) {
    recommendations.push('Upgrade to Plus for 10x more images per month.');
  } else if (quotaInfo.subscriptionTier === 'plus' && quotaInfo.quotaPercentageUsed >= 80) {
    recommendations.push('Upgrade to Pro for unlimited professional features.');
  }

  const daysUntilReset = Math.ceil((quotaInfo.quotaResetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysUntilReset <= 7 && quotaInfo.quotaPercentageUsed >= 50) {
    recommendations.push(`Your quota resets in ${daysUntilReset} days.`);
  }

  return recommendations;
};

/**
 * Middleware for admin quota operations
 */
export const adminQuotaOperations = {
  async resetUserQuota(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        res.status(400).json({
          error: 'User ID required',
          code: 'MISSING_USER_ID'
        });
        return;
      }

      await DatabaseUtils.resetUserQuota(userId);
      
      res.json({
        message: 'User quota reset successfully',
        userId
      });

    } catch (error) {
      logger.error('Error resetting user quota:', error as Error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'QUOTA_RESET_ERROR'
      });
    }
  },

  async bulkQuotaOperation(req: Request, res: Response): Promise<void> {
    try {
      const { operation, userIds, credits } = req.body;
      
      if (!operation || !Array.isArray(userIds)) {
        res.status(400).json({
          error: 'Invalid bulk operation parameters',
          code: 'INVALID_BULK_PARAMS'
        });
        return;
      }

      let results = [];
      
      switch (operation) {
        case 'reset':
          for (const userId of userIds) {
            try {
              await DatabaseUtils.resetUserQuota(userId);
              results.push({ userId, success: true });
            } catch (error) {
              results.push({ userId, success: false, error: (error as Error).message });
            }
          }
          break;
          
        case 'addCredits':
          if (typeof credits !== 'number') {
            res.status(400).json({
              error: 'Credits amount required for addCredits operation',
              code: 'MISSING_CREDITS'
            });
            return;
          }
          
          for (const userId of userIds) {
            try {
              const user = await UserModel.findById(userId);
              if (user) {
                user.monthlyUsage = Math.max(0, user.monthlyUsage - credits);
                await user.save();
                results.push({ userId, success: true, creditsAdded: credits });
              }
            } catch (error) {
              results.push({ userId, success: false, error: (error as Error).message });
            }
          }
          break;
          
        default:
          res.status(400).json({
            error: 'Invalid operation',
            code: 'INVALID_OPERATION'
          });
          return;
      }

      res.json({
        operation,
        results,
        summary: {
          total: userIds.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      });

    } catch (error) {
      logger.error('Error in bulk quota operation:', error as Error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'BULK_OPERATION_ERROR'
      });
    }
  }
};

export default {
  checkQuota,
  consumeQuota,
  attachQuotaInfo,
  getQuotaStatus,
  getQuotaInfo,
  adminQuotaOperations
};