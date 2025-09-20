import { clerkMiddleware, requireAuth } from '@clerk/express';
import { Request, Response, NextFunction } from 'express';
import type { User as ClerkUser } from '@clerk/types';
import { config } from '@/config/env';
import { UnauthorizedError, ForbiddenError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';

// Configure Clerk middleware
export const clerkAuth = clerkMiddleware({
  secretKey: config.auth.clerkSecretKey,
  publishableKey: config.auth.clerkPublishableKey,
});

// Extend Express Request interface for Clerk
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId?: string | null;
        user?: ClerkUser;
        sessionId?: string | null;
        getToken?: () => Promise<string | null>;
      };
    }
  }
}

// Middleware to require authentication
export const requireAuthentication = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth?.userId) {
    throw new UnauthorizedError('Authentication required');
  }
  next();
};

// Middleware to validate user and add to request
export const validateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.userId) {
      throw new UnauthorizedError('User not authenticated');
    }

    // User information is available through req.auth
    logger.info('User authenticated', {
      userId: req.auth.userId,
      sessionId: req.auth.sessionId,
    });

    next();
  } catch (error) {
    next(error);
  }
};

// Middleware to check user role
export const requireRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // In a real implementation, you would fetch user role from your database
      // For now, we'll assume all authenticated users have 'user' role
      const userRole = 'user'; // This should be fetched from your user database

      if (!roles.includes(userRole)) {
        throw new ForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware to validate subscription tier
export const requireSubscription = (tiers: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // In a real implementation, you would fetch subscription from your database
      // For now, we'll assume all users have 'free' tier
      const subscriptionTier = 'free'; // This should be fetched from your user database

      if (!tiers.includes(subscriptionTier)) {
        throw new ForbiddenError(`Access denied. Required subscription: ${tiers.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Helper to get authenticated user ID
export const getAuthenticatedUserId = (req: Request): string => {
  if (!req.auth?.userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  return req.auth.userId;
};

// Helper to get user token
export const getUserToken = async (req: Request): Promise<string | null> => {
  if (!req.auth?.getToken) {
    return null;
  }
  
  try {
    return await req.auth.getToken();
  } catch (error) {
    logger.error('Error getting user token:', error as Error);
    return null;
  }
};

// Optional authentication middleware (doesn't throw if not authenticated)
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // Just pass through - user might or might not be authenticated
  next();
};