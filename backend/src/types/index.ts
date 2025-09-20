// Base response interface for API responses
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message: string;
  data?: T;
  timestamp: string;
}

// Paginated response interface
export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error response interface
export interface ErrorResponse {
  status: 'error';
  message: string;
  error?: string;
  stack?: string;
  timestamp: string;
}

// Clerk User Interface
export interface ClerkUser {
  id: string;
  email: string;
  name: string;
  imageUrl?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  emailVerified: boolean;
  createdAt: Date;
  lastActiveAt?: Date;
}

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  subscription: SubscriptionTier;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'user' | 'admin';

export type SubscriptionTier = 'free' | 'pro' | 'premium';

// Authentication types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  subscription: SubscriptionTier;
  imageUrl?: string;
  emailVerified: boolean;
}

// Authenticated request interface
export interface AuthenticatedRequest extends Request {
  auth: {
    userId: string;
    user?: ClerkUser;
    sessionId?: string;
    getToken?: () => Promise<string | null>;
  };
  userRole?: UserRole;
  subscriptionTier?: SubscriptionTier;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Session validation response
export interface SessionValidationResponse {
  valid: boolean;
  userId?: string;
  sessionId?: string;
  emailVerified?: boolean;
  timestamp: string;
}

// Request types for API endpoints
export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

// Database connection info
export interface DatabaseInfo {
  status: 'connected' | 'disconnected';
  readyState: number;
  host?: string;
  port?: number;
  name?: string;
  isConnected: boolean;
}

// Health check response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: DatabaseInfo;
    api: {
      status: string;
      responseTime: string;
    };
  };
  memory: {
    used: number;
    total: number;
    unit: string;
  };
}

// Query parameters
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchQuery extends PaginationQuery {
  q: string;
  filters?: string;
}

export interface DateRangeQuery {
  from?: string;
  to?: string;
}

// Utility types
export type RequestWithUser<T = any> = Express.Request & {
  user: AuthUser;
  body: T;
};

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// MongoDB document base interface
export interface BaseDocument {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

// API endpoint paths (for type safety)
export const API_ROUTES = {
  HEALTH: '/api/v1/health',
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    REFRESH: '/api/v1/auth/refresh',
    LOGOUT: '/api/v1/auth/logout',
  },
  USERS: {
    LIST: '/api/v1/users',
    CREATE: '/api/v1/users',
    GET_BY_ID: '/api/v1/users/:id',
    UPDATE: '/api/v1/users/:id',
    DELETE: '/api/v1/users/:id',
  },
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// Environment types
export type Environment = 'development' | 'production' | 'test';

// Configuration interface
export interface AppConfig {
  server: {
    port: number;
    env: Environment;
    corsOrigin: string;
  };
  database: {
    uri: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
  };
  apis: {
    clerk?: string;
    google?: string;
    stripe?: string;
  };
  email: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
  };
}