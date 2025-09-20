import { Request, Response, NextFunction } from 'express';
import type { User } from '@clerk/backend';
import { UnauthorizedError, ForbiddenError, ValidationError } from '../middleware/errorHandler';
import { logger } from './logger';
import { SubscriptionTier, UserRole } from '../types';

// Protected route wrapper
export const requireAuth = (
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.userId) {
        throw new UnauthorizedError('Authentication required');
      }
      
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// User validation utilities
export class AuthUtils {
  // Validate user authentication
  static validateAuthentication(req: Request): string {
    if (!req.auth?.userId) {
      throw new UnauthorizedError('User authentication required');
    }
    return req.auth.userId;
  }

  // Extract user information from request
  static extractUserInfo(req: Request) {
    const userId = this.validateAuthentication(req);
    
    return {
      userId,
      sessionId: req.auth?.sessionId,
      user: req.auth?.user,
    };
  }

  // Validate user role
  static validateUserRole(userRole: string, requiredRoles: UserRole[]): boolean {
    return requiredRoles.includes(userRole as UserRole);
  }

  // Validate subscription tier
  static validateSubscriptionTier(userTier: string, requiredTiers: SubscriptionTier[]): boolean {
    return requiredTiers.includes(userTier as SubscriptionTier);
  }

  // Check if user has admin privileges
  static isAdmin(userRole: string): boolean {
    return userRole === 'admin';
  }

  // Check if user has premium subscription
  static hasPremiumAccess(subscriptionTier: string): boolean {
    return ['pro', 'premium'].includes(subscriptionTier);
  }

  // Validate API key from headers (for service-to-service communication)
  static validateApiKey(req: Request, validApiKey: string): boolean {
    const apiKey = req.headers['x-api-key'];
    return apiKey === validApiKey;
  }

  // Get user token for external API calls
  static async getUserToken(req: Request): Promise<string> {
    if (!req.auth?.getToken) {
      throw new UnauthorizedError('Unable to retrieve user token');
    }

    try {
      const token = await req.auth.getToken();
      if (!token) {
        throw new UnauthorizedError('No valid token found');
      }
      return token;
    } catch (error) {
      logger.error('Error retrieving user token:', error as Error);
      throw new UnauthorizedError('Failed to retrieve authentication token');
    }
  }

  // Format user response data
  static formatUserResponse(userId: string, user?: User) {
    return {
      id: userId,
      email: user?.emailAddresses?.[0]?.emailAddress || '',
      name: user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}`.trim()
        : user?.username || 'Unknown User',
      imageUrl: user?.imageUrl,
      createdAt: user?.createdAt,
      lastActiveAt: user?.lastActiveAt,
    };
  }

  // Validate session
  static validateSession(req: Request): boolean {
    return !!(req.auth?.userId && req.auth?.sessionId);
  }

  // Check if user email is verified
  static isEmailVerified(user?: User): boolean {
    if (!user?.emailAddresses?.length) return false;
    return user.emailAddresses.some((email: any) => email.verification?.status === 'verified');
  }

  // Rate limiting by user
  static getUserRateLimit(subscriptionTier: string): { requests: number; window: number } {
    const rateLimits = {
      free: { requests: 100, window: 3600 }, // 100 requests per hour
      pro: { requests: 1000, window: 3600 }, // 1000 requests per hour  
      premium: { requests: 10000, window: 3600 }, // 10000 requests per hour
    };

    return rateLimits[subscriptionTier as keyof typeof rateLimits] || rateLimits.free;
  }
}

// Middleware factory for role-based access control
export const requireRole = (...roles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = AuthUtils.validateAuthentication(req);
      
      // In a real implementation, fetch user role from database
      // For now, assume all authenticated users have 'user' role
      const userRole = 'user' as UserRole; // TODO: Implement database lookup
      
      if (!AuthUtils.validateUserRole(userRole, roles)) {
        throw new ForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`);
      }

      // Add role to request for downstream use
      (req as any).userRole = userRole;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware factory for subscription-based access control
export const requireSubscription = (...tiers: SubscriptionTier[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = AuthUtils.validateAuthentication(req);
      
      // In a real implementation, fetch subscription from database
      // For now, assume all users have 'free' tier
      const subscriptionTier = 'free' as SubscriptionTier; // TODO: Implement database lookup
      
      if (!AuthUtils.validateSubscriptionTier(subscriptionTier, tiers)) {
        throw new ForbiddenError(`Access denied. Required subscription: ${tiers.join(', ')}`);
      }

      // Add subscription to request for downstream use
      (req as any).subscriptionTier = subscriptionTier;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Optional authentication middleware
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // Add user info to request if available, but don't require authentication
  if (req.auth?.userId) {
    (req as any).userId = req.auth.userId;
    (req as any).isAuthenticated = true;
  } else {
    (req as any).isAuthenticated = false;
  }
  next();
};

// Admin-only middleware
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = AuthUtils.validateAuthentication(req);
    
    // In a real implementation, fetch user role from database
    const userRole = 'user' as UserRole; // TODO: Implement database lookup
    
    if (!AuthUtils.isAdmin(userRole)) {
      throw new ForbiddenError('Admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default AuthUtils;