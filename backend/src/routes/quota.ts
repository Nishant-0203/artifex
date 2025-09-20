import { Router } from 'express';
import { clerkAuth, requireAuthentication } from '../middleware/auth';
import { 
  checkQuota, 
  getQuotaStatus, 
  adminQuotaOperations 
} from '../middleware/quota';
import { asyncHandler } from '../utils/asyncHandler';
import { QuotaUtils } from '../utils/quota';
import { getAuthenticatedUserId } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(clerkAuth);
router.use(requireAuthentication);

/**
 * @route GET /api/v1/quota/status
 * @desc Get current quota status for authenticated user
 * @access Private
 */
router.get('/status', asyncHandler(getQuotaStatus));

/**
 * @route GET /api/v1/quota/usage
 * @desc Get usage history and analytics for authenticated user
 * @access Private
 */
router.get('/usage', asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const days = parseInt(req.query.days as string) || 30;
  
  const analytics = await QuotaUtils.getUserUsageAnalytics(userId, days);
  
  res.json({
    status: 'success',
    data: {
      analytics,
      period: `${days} days`,
      generatedAt: new Date().toISOString()
    }
  });
}));

/**
 * @route GET /api/v1/quota/recommendations
 * @desc Get quota recommendations for authenticated user
 * @access Private
 */
router.get('/recommendations', asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  
  const recommendations = await QuotaUtils.getQuotaRecommendations(userId);
  
  res.json({
    status: 'success',
    data: {
      recommendations,
      generatedAt: new Date().toISOString()
    }
  });
}));

/**
 * @route POST /api/v1/quota/check
 * @desc Check if user can perform a specific generation
 * @access Private
 */
router.post('/check', asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { 
    credits = 1, 
    generationType = 'text-to-image',
    requiresPremium = false 
  } = req.body;
  
  const eligibility = await QuotaUtils.checkGenerationEligibility(userId, {
    credits,
    generationType,
    requiresPremium
  });
  
  res.json({
    status: 'success',
    data: eligibility
  });
}));

/**
 * @route POST /api/v1/quota/validate-bulk
 * @desc Validate a bulk generation request
 * @access Private
 */
router.post('/validate-bulk', asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { requests } = req.body;
  
  if (!Array.isArray(requests)) {
    return res.status(400).json({
      status: 'error',
      message: 'Requests must be an array',
      code: 'INVALID_REQUESTS_FORMAT'
    });
  }
  
  const validation = await QuotaUtils.validateBulkGeneration(userId, requests);
  
  res.json({
    status: 'success',
    data: validation
  });
}));

/**
 * @route POST /api/v1/quota/calculate-cost
 * @desc Calculate cost for a generation request
 * @access Private
 */
router.post('/calculate-cost', asyncHandler(async (req, res) => {
  const { 
    type, 
    quality = 'standard', 
    batchSize = 1, 
    aspectRatio = '1:1', 
    style = 'realistic' 
  } = req.body;
  
  if (!type) {
    return res.status(400).json({
      status: 'error',
      message: 'Generation type is required',
      code: 'MISSING_GENERATION_TYPE'
    });
  }
  
  const cost = QuotaUtils.calculateGenerationCost(type, {
    quality,
    batchSize,
    aspectRatio,
    style
  });
  
  res.json({
    status: 'success',
    data: {
      cost,
      breakdown: {
        baseCost: 1,
        typeMultiplier: type === 'text-to-image' ? 1.0 : 1.2,
        qualityMultiplier: quality === 'hd' ? 1.5 : 1.0,
        batchSize,
        finalCost: cost
      }
    }
  });
}));

/**
 * @route GET /api/v1/quota/features/:feature
 * @desc Check if a specific feature is available for user's tier
 * @access Private
 */
router.get('/features/:feature', asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { feature } = req.params;
  
  // Get user's tier from database
  const { UserModel } = await import('../models');
  const user = await UserModel.findById(userId);
  
  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }
  
  const availability = QuotaUtils.checkFeatureAvailability(user.subscriptionTier, feature);
  
  res.json({
    status: 'success',
    data: {
      feature,
      currentTier: user.subscriptionTier,
      ...availability
    }
  });
}));

/**
 * @route POST /api/v1/quota/validate-params
 * @desc Validate generation parameters against tier limits
 * @access Private
 */
router.post('/validate-params', asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { type, quality, batchSize, style, customModel } = req.body;
  
  if (!type) {
    return res.status(400).json({
      status: 'error',
      message: 'Generation type is required',
      code: 'MISSING_GENERATION_TYPE'
    });
  }
  
  // Get user's tier from database
  const { UserModel } = await import('../models');
  const user = await UserModel.findById(userId);
  
  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: 'User not found',
      code: 'USER_NOT_FOUND'
    });
  }
  
  const validation = QuotaUtils.validateGenerationParameters(user.subscriptionTier, {
    type,
    quality,
    batchSize,
    style,
    customModel
  });
  
  res.json({
    status: 'success',
    data: {
      currentTier: user.subscriptionTier,
      ...validation
    }
  });
}));

// Admin routes (would need additional admin authentication middleware)
const adminRouter = Router();

/**
 * @route POST /api/v1/quota/admin/reset/:userId
 * @desc Reset quota for a specific user (admin only)
 * @access Admin
 */
adminRouter.post('/admin/reset/:userId', asyncHandler(adminQuotaOperations.resetUserQuota));

/**
 * @route POST /api/v1/quota/admin/bulk-operation
 * @desc Perform bulk quota operations (admin only)
 * @access Admin
 */
adminRouter.post('/admin/bulk-operation', asyncHandler(adminQuotaOperations.bulkQuotaOperation));

/**
 * @route GET /api/v1/quota/admin/analytics
 * @desc Get system-wide quota analytics (admin only)
 * @access Admin
 */
adminRouter.get('/admin/analytics', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days as string) || 30;
  
  // This would require admin permissions - placeholder implementation
  const analytics = {
    period: `${days} days`,
    totalUsers: 1000, // placeholder
    totalGenerations: 50000, // placeholder
    quotaUtilization: {
      free: 0.65,
      plus: 0.45,
      pro: 0.35
    },
    averageDailyUsage: 1666, // placeholder
    peakUsageDays: ['2024-01-15', '2024-01-20'], // placeholder
  };
  
  res.json({
    status: 'success',
    data: analytics
  });
}));

/**
 * @route GET /api/v1/quota/admin/users-approaching-limit
 * @desc Get users approaching their quota limits (admin only)
 * @access Admin
 */
adminRouter.get('/admin/users-approaching-limit', asyncHandler(async (req, res) => {
  const threshold = parseInt(req.query.threshold as string) || 90;
  
  // This would require admin permissions and actual database queries
  const users: Array<{
    userId: string;
    username: string;
    tier: string;
    quotaUsed: number;
    quotaLimit: number;
    usagePercentage: number;
  }> = []; // placeholder
  
  res.json({
    status: 'success',
    data: {
      threshold: `${threshold}%`,
      users,
      count: users.length
    }
  });
}));

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    message: 'Quota service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}));

// Attach admin routes
router.use(adminRouter);

export default router;