import { Router, Request, Response } from 'express';
import { requireAuthentication, validateUser } from '@/middleware/auth';
import { AuthUtils } from '@/utils/auth';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiResponse } from '@/types';

const router = Router();

// Get authenticated user profile
router.get('/me', requireAuthentication, asyncHandler(async (req: Request, res: Response) => {
  const userInfo = AuthUtils.extractUserInfo(req);
  const formattedUser = AuthUtils.formatUserResponse(userInfo.userId, userInfo.user);
  
  const response: ApiResponse = {
    status: 'success',
    message: 'User profile retrieved successfully',
    data: {
      user: formattedUser,
      session: {
        sessionId: userInfo.sessionId,
        isActive: AuthUtils.validateSession(req),
        emailVerified: AuthUtils.isEmailVerified(userInfo.user),
      }
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

// Validate user session
router.get('/validate', requireAuthentication, asyncHandler(async (req: Request, res: Response) => {
  const userInfo = AuthUtils.extractUserInfo(req);
  const isValid = AuthUtils.validateSession(req);
  
  const response: ApiResponse = {
    status: 'success',
    message: isValid ? 'Session is valid' : 'Session is invalid',
    data: {
      valid: isValid,
      userId: userInfo.userId,
      sessionId: userInfo.sessionId,
      emailVerified: AuthUtils.isEmailVerified(userInfo.user),
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

// Get user authentication status (optional auth)
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const isAuthenticated = !!(req.auth?.userId);
  
  let userData = null;
  if (isAuthenticated) {
    const userInfo = AuthUtils.extractUserInfo(req);
    userData = {
      userId: userInfo.userId,
      sessionId: userInfo.sessionId,
      emailVerified: AuthUtils.isEmailVerified(userInfo.user),
    };
  }

  const response: ApiResponse = {
    status: 'success',
    message: isAuthenticated ? 'User is authenticated' : 'User is not authenticated',
    data: {
      authenticated: isAuthenticated,
      user: userData,
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

// User logout (client-side handled, but can be used for logging)
router.post('/logout', requireAuthentication, asyncHandler(async (req: Request, res: Response) => {
  const userInfo = AuthUtils.extractUserInfo(req);
  
  // Note: Actual logout is handled by Clerk on the client-side
  // This endpoint can be used for server-side logging or cleanup
  
  const response: ApiResponse = {
    status: 'success',
    message: 'Logout request processed',
    data: {
      userId: userInfo.userId,
      logoutTime: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

// Get user permissions and subscription info
router.get('/permissions', requireAuthentication, asyncHandler(async (req: Request, res: Response) => {
  const userInfo = AuthUtils.extractUserInfo(req);
  
  // In a real implementation, fetch from database
  const userRole = 'user'; // TODO: Implement database lookup
  const subscriptionTier = 'free'; // TODO: Implement database lookup
  
  const rateLimit = AuthUtils.getUserRateLimit(subscriptionTier);
  const hasPremiumAccess = AuthUtils.hasPremiumAccess(subscriptionTier);
  const isAdmin = AuthUtils.isAdmin(userRole);

  const response: ApiResponse = {
    status: 'success',
    message: 'User permissions retrieved successfully',
    data: {
      userId: userInfo.userId,
      role: userRole,
      subscription: {
        tier: subscriptionTier,
        hasPremiumAccess,
        rateLimit,
      },
      permissions: {
        isAdmin,
        canAccessPremiumFeatures: hasPremiumAccess,
      },
    },
    timestamp: new Date().toISOString(),
  };

  res.json(response);
}));

// Refresh user token (for external API calls)
router.post('/refresh-token', requireAuthentication, asyncHandler(async (req: Request, res: Response) => {
  try {
    const token = await AuthUtils.getUserToken(req);
    
    const response: ApiResponse = {
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        tokenAvailable: !!token,
        // Note: Don't return the actual token for security reasons
        expiresIn: '1h', // This would be determined by Clerk
      },
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      status: 'error',
      message: 'Failed to refresh token',
      timestamp: new Date().toISOString(),
    };

    res.status(401).json(response);
  }
}));

export default router;