import { Router } from 'express';
import { clerkAuth, requireAuthentication } from '../middleware/auth';
import { validateSubscription, requireTier } from '../middleware/subscription';
import { asyncHandler } from '../utils/asyncHandler';
import { getAuthenticatedUserId } from '../middleware/auth';
import { createHmac } from 'crypto';

const router = Router();

// Apply authentication middleware to all routes except webhooks
router.use('/webhook', clerkAuth); // Webhooks need special handling
router.use(clerkAuth);
router.use(requireAuthentication);

/**
 * @route GET /api/v1/subscription/status
 * @desc Get current subscription status for authenticated user
 * @access Private
 */
router.get('/status', validateSubscription, asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  
  // Get subscription info from middleware
  const subscriptionInfo = (req as any).subscriptionInfo;
  
  res.json({
    status: 'success',
    data: {
      subscription: subscriptionInfo,
      userId,
      retrievedAt: new Date().toISOString()
    }
  });
}));

/**
 * @route GET /api/v1/subscription/plans
 * @desc Get available subscription plans
 * @access Private
 */
router.get('/plans', asyncHandler(async (req, res) => {
  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      interval: 'monthly',
      quota: 10,
      features: [
        'Basic image generation',
        'Standard quality',
        '10 images per month',
        'Community support'
      ],
      limitations: [
        'No batch generation',
        'No HD quality',
        'No custom models',
        'Watermarked images'
      ]
    },
    {
      id: 'plus',
      name: 'Plus',
      price: 9.99,
      interval: 'monthly',
      quota: 100,
      features: [
        'Enhanced image generation',
        'HD quality available',
        '100 images per month',
        'Batch generation (up to 4)',
        'Email support',
        'No watermarks'
      ],
      limitations: [
        'Limited custom models',
        'No priority processing'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 29.99,
      interval: 'monthly',
      quota: 1000,
      features: [
        'Professional image generation',
        'All quality options',
        '1000 images per month',
        'Large batch generation (up to 10)',
        'Custom model access',
        'Priority processing',
        'Advanced analytics',
        'Priority support',
        'API access'
      ],
      limitations: []
    }
  ];
  
  res.json({
    status: 'success',
    data: {
      plans,
      currency: 'USD'
    }
  });
}));

/**
 * @route GET /api/v1/subscription/features
 * @desc Get feature comparison across tiers
 * @access Private
 */
router.get('/features', asyncHandler(async (req, res) => {
  const features = {
    imageGeneration: {
      free: { quota: 10, quality: ['standard'], batchSize: 1 },
      plus: { quota: 100, quality: ['standard', 'hd'], batchSize: 4 },
      pro: { quota: 1000, quality: ['standard', 'hd', 'ultra'], batchSize: 10 }
    },
    customModels: {
      free: { available: false, count: 0 },
      plus: { available: true, count: 2 },
      pro: { available: true, count: 10 }
    },
    priorityProcessing: {
      free: false,
      plus: false,
      pro: true
    },
    analytics: {
      free: { basic: true, advanced: false },
      plus: { basic: true, advanced: false },
      pro: { basic: true, advanced: true }
    },
    support: {
      free: 'Community',
      plus: 'Email',
      pro: 'Priority'
    },
    apiAccess: {
      free: false,
      plus: false,
      pro: true
    }
  };
  
  res.json({
    status: 'success',
    data: features
  });
}));

/**
 * @route POST /api/v1/subscription/upgrade
 * @desc Initiate subscription upgrade process
 * @access Private
 */
router.post('/upgrade', asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { planId, returnUrl } = req.body;
  
  if (!planId) {
    return res.status(400).json({
      status: 'error',
      message: 'Plan ID is required',
      code: 'MISSING_PLAN_ID'
    });
  }
  
  // In a real implementation, this would integrate with Clerk's subscription management
  // For now, return a mock upgrade URL
  const upgradeUrl = `https://your-app.clerk.com/subscription/upgrade?plan=${planId}&user=${userId}&return=${encodeURIComponent(returnUrl || '/')}`;
  
  res.json({
    status: 'success',
    data: {
      upgradeUrl,
      planId,
      message: 'Redirect user to upgrade URL to complete subscription change'
    }
  });
}));

/**
 * @route POST /api/v1/subscription/cancel
 * @desc Cancel current subscription
 * @access Private
 */
router.post('/cancel', requireTier(['plus', 'pro']), asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { reason, feedback } = req.body;
  
  // In a real implementation, this would cancel the Clerk subscription
  // For now, return a mock response
  
  res.json({
    status: 'success',
    data: {
      message: 'Subscription cancellation initiated',
      cancellationDate: new Date().toISOString(),
      reason,
      feedback
    }
  });
}));

/**
 * @route GET /api/v1/subscription/billing-history
 * @desc Get billing history for authenticated user
 * @access Private
 */
router.get('/billing-history', requireTier(['plus', 'pro']), asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const limit = parseInt(req.query.limit as string) || 10;
  
  // In a real implementation, this would fetch from Clerk's billing system
  const billingHistory = [
    {
      id: 'inv_001',
      date: new Date('2024-01-01'),
      amount: 9.99,
      status: 'paid',
      planName: 'Plus',
      period: 'January 2024'
    }
  ];
  
  res.json({
    status: 'success',
    data: {
      billingHistory,
      total: billingHistory.length,
      limit
    }
  });
}));

/**
 * @route GET /api/v1/subscription/usage-analytics
 * @desc Get subscription usage analytics
 * @access Private
 */
router.get('/usage-analytics', validateSubscription, asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const days = parseInt(req.query.days as string) || 30;
  
  // This would integrate with the subscription utilities once they're working
  const analytics = {
    period: `${days} days`,
    totalGenerations: 45,
    quotaUtilized: 0.45,
    averageDailyUsage: 1.5,
    peakUsageDate: '2024-01-15',
    trendsAnalysis: {
      growthRate: 0.15,
      projectedMonthlyUsage: 50,
      recommendedTier: 'current'
    }
  };
  
  res.json({
    status: 'success',
    data: analytics
  });
}));

/**
 * @route POST /api/v1/subscription/webhook
 * @desc Handle Clerk subscription webhooks
 * @access Public (but authenticated via webhook signature)
 */
router.post('/webhook', asyncHandler(async (req, res) => {
  const signature = req.headers['clerk-signature'] as string;
  const payload = JSON.stringify(req.body);
  
  if (!signature) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing webhook signature',
      code: 'MISSING_SIGNATURE'
    });
  }
  
  // Verify webhook signature
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({
      status: 'error',
      message: 'Webhook secret not configured',
      code: 'WEBHOOK_SECRET_MISSING'
    });
  }
  
  try {
    // Basic signature verification (in production, use Clerk's SDK)
    const expectedSignature = createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE'
      });
    }
    
    const event = req.body;
    
    // Handle different webhook events
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.cancelled':
        // Process subscription changes
        console.log(`Processing ${event.type} for user ${event.data.user_id}`);
        
        // This would use the subscription utilities once they're working
        // await SubscriptionUtils.processClerkWebhook(event);
        
        break;
      
      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }
    
    res.json({
      status: 'success',
      message: 'Webhook processed successfully'
    });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Webhook processing failed',
      code: 'WEBHOOK_PROCESSING_ERROR'
    });
  }
}));

/**
 * @route GET /api/v1/subscription/recommendations
 * @desc Get personalized subscription recommendations
 * @access Private
 */
router.get('/recommendations', validateSubscription, asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const subscriptionInfo = (req as any).subscriptionInfo;
  
  // Basic recommendation logic
  let recommendation = null;
  
  if (subscriptionInfo.tier === 'free' && subscriptionInfo.quotaUsed > 8) {
    recommendation = {
      suggestedTier: 'plus',
      reason: 'You\'re approaching your free tier limit. Upgrade to Plus for 10x more generations.',
      savings: 'Get 100 images for just $9.99/month',
      urgency: 'high'
    };
  } else if (subscriptionInfo.tier === 'plus' && subscriptionInfo.quotaUsed > 80) {
    recommendation = {
      suggestedTier: 'pro',
      reason: 'Heavy usage detected. Pro tier offers better value and advanced features.',
      savings: '10x more images plus advanced features for $29.99/month',
      urgency: 'medium'
    };
  }
  
  res.json({
    status: 'success',
    data: {
      currentTier: subscriptionInfo.tier,
      recommendation,
      generatedAt: new Date().toISOString()
    }
  });
}));

/**
 * @route POST /api/v1/subscription/feedback
 * @desc Submit subscription feedback
 * @access Private
 */
router.post('/feedback', asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const { category, rating, message, suggestions } = req.body;
  
  if (!category || !rating) {
    return res.status(400).json({
      status: 'error',
      message: 'Category and rating are required',
      code: 'MISSING_REQUIRED_FIELDS'
    });
  }
  
  // In a real implementation, this would save feedback to database
  console.log('Subscription feedback received:', {
    userId,
    category,
    rating,
    message,
    suggestions,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    status: 'success',
    message: 'Feedback submitted successfully',
    data: {
      category,
      rating,
      submittedAt: new Date().toISOString()
    }
  });
}));

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    message: 'Subscription service is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}));

export default router;