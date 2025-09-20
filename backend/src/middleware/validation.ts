import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from '@/middleware/errorHandler';

// Validation middleware factory
export const validate = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query parameters
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }

      // Validate route parameters
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        next(new ValidationError(`Validation failed: ${messages.join(', ')}`));
      } else {
        next(error);
      }
    }
  };
};

// Common validation schemas
export const commonSchemas = {
  // MongoDB ObjectId validation
  objectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format'),

  // Email validation
  email: z.string().email('Invalid email format'),

  // Password validation
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase, one uppercase letter and one number'),

  // Pagination validation
  pagination: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? Math.min(parseInt(val, 10), 100) : 10),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
  }),

  // Search validation
  search: z.object({
    q: z.string().min(1, 'Search query is required').max(100, 'Search query too long'),
    filters: z.string().optional(),
  }),

  // Date range validation
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }).refine(data => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  }, 'From date must be before to date'),
};

// Validation for specific endpoints
export const validationSchemas = {
  // User validation
  createUser: {
    body: z.object({
      email: commonSchemas.email,
      password: commonSchemas.password,
      name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
      role: z.enum(['user', 'admin']).optional().default('user'),
    }),
  },

  updateUser: {
    params: z.object({
      id: commonSchemas.objectId,
    }),
    body: z.object({
      name: z.string().min(1, 'Name is required').max(50, 'Name too long').optional(),
      email: commonSchemas.email.optional(),
    }),
  },

  // Authentication validation
  login: {
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(1, 'Password is required'),
    }),
  },

  // Generic ID parameter validation
  idParam: {
    params: z.object({
      id: commonSchemas.objectId,
    }),
  },

  // Pagination query validation
  paginationQuery: {
    query: commonSchemas.pagination,
  },

  // Search query validation
  searchQuery: {
    query: commonSchemas.search.merge(commonSchemas.pagination),
  },
};

// Type guards for request validation
export type ValidatedRequest<T = any, U = any, V = any> = Request<T, any, U, V>;

// Utility function to validate single values
export const validateValue = <T>(schema: ZodSchema<T>, value: unknown): T => {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      );
      throw new ValidationError(`Validation failed: ${messages.join(', ')}`);
    }
    throw error;
  }
};