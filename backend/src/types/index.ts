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

export type UserRole = 'user' | 'admin' | 'moderator';

export type SubscriptionTier = 'free' | 'plus' | 'pro';

// Subscription tier quotas (images per month)
export const SUBSCRIPTION_QUOTAS: Record<SubscriptionTier, number> = {
  free: 10,
  plus: 100,
  pro: 1000
};

// Subscription tier features
export interface SubscriptionFeatures {
  monthlyImageQuota: number;
  maxImageResolution: string;
  apiAccess: boolean;
  priorityProcessing: boolean;
  advancedFeatures: boolean;
  supportLevel: 'basic' | 'priority' | 'premium';
}

export const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, SubscriptionFeatures> = {
  free: {
    monthlyImageQuota: 10,
    maxImageResolution: '512x512',
    apiAccess: false,
    priorityProcessing: false,
    advancedFeatures: false,
    supportLevel: 'basic'
  },
  plus: {
    monthlyImageQuota: 100,
    maxImageResolution: '1024x1024',
    apiAccess: true,
    priorityProcessing: false,
    advancedFeatures: true,
    supportLevel: 'priority'
  },
  pro: {
    monthlyImageQuota: 1000,
    maxImageResolution: '2048x2048',
    apiAccess: true,
    priorityProcessing: true,
    advancedFeatures: true,
    supportLevel: 'premium'
  }
};

// Enhanced User interface
export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  imageUrl?: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  subscriptionId?: string;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  quotaResetDate: Date;
  monthlyUsage: number;
  totalImagesGenerated: number;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

// User preferences
export interface UserPreferences {
  defaultImageSize: string;
  defaultStyle: string;
  emailNotifications: boolean;
  marketingEmails: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
}

// Subscription interface
export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: ClerkSubscriptionStatus;
  clerkCustomerId?: string;
  clerkSubscriptionId?: string;
  clerkPlanId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  lastPaymentAt?: Date;
  nextPaymentAt?: Date;
  paymentFailures: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type SubscriptionStatus = 
  | 'active' 
  | 'canceled' 
  | 'incomplete' 
  | 'incomplete_expired' 
  | 'past_due' 
  | 'trialing' 
  | 'unpaid';

// Image Generation interfaces
export interface ImageGeneration {
  id: string;
  userId: string;
  type: ImageGenerationType;
  status: ImageGenerationStatus;
  prompt: string;
  negativePrompt?: string;
  style?: string;
  aspectRatio: string;
  quality: ImageQuality;
  model: string;
  seed?: number;
  steps?: number;
  guidance?: number;
  inputImages?: string[];
  outputImages: GeneratedImage[];
  processingTimeMs?: number;
  cost: number;
  credits: number;
  metadata: ImageGenerationMetadata;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ImageGenerationType = 
  | 'text-to-image' 
  | 'image-to-image' 
  | 'multi-image' 
  | 'refine';

export type ImageGenerationStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'canceled';

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  format: string;
  fileSize: number;
  storageKey: string;
  thumbnailUrl?: string;
}

export interface ImageGenerationMetadata {
  model: string;
  version: string;
  parameters: Record<string, any>;
  processingNode?: string;
  queuePosition?: number;
  estimatedTime?: number;
  actualTime?: number;
  // Extended properties for orchestrator
  processedImages?: number;
  totalProcessingTime?: number;
  inputImageAnalysis?: Record<string, any>;
  inputImageCount?: number;
  compositionAnalysis?: Record<string, any>;
  refinementType?: string;
  refinementAnalysis?: Record<string, any>;
}

// Quota tracking interfaces
export interface QuotaUsage {
  userId: string;
  period: Date;
  imagesGenerated: number;
  creditsUsed: number;
  tier: SubscriptionTier;
  limit: number;
  remaining: number;
  resetDate: Date;
}

export interface QuotaCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetDate: Date;
  overageAllowed: boolean;
  cost: number;
}

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

// Enhanced Quota Management Types for Clerk Integration
export interface QuotaInfo {
  userId: string;
  subscriptionTier: SubscriptionTier;
  monthlyUsage: number;
  monthlyLimit: number;
  remainingQuota: number;
  quotaResetDate: Date;
  quotaPercentageUsed: number;
  canGenerate: boolean;
  // Convenience aliases for orchestrator compatibility
  remaining: number; // Same as remainingQuota
  resetDate: Date;   // Same as quotaResetDate
}

export interface QuotaValidationResult {
  allowed: boolean;
  reason?: string;
  requiredCredits: number;
  quotaInfo: QuotaInfo;
  upgradeRequired?: boolean;
  nextTier?: 'plus' | 'pro';
}

export interface QuotaCheckOptions {
  credits?: number;
  generationType?: string;
  requiresPremium?: boolean;
  bypassQuota?: boolean;
}

export interface QuotaOperationResult {
  success: boolean;
  userId: string;
  creditsConsumed?: number;
  remainingQuota?: number;
  error?: string;
}

// Enhanced Subscription Types for Clerk Integration  
export interface ClerkSubscriptionData {
  id: string;
  clerkSubscriptionId: string;
  clerkPlanId: string;
  clerkCustomerId: string;
  status: ClerkSubscriptionStatus;
  tier: SubscriptionTier;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, any>;
}

export type ClerkSubscriptionStatus = 
  | 'active' 
  | 'inactive' 
  | 'trialing' 
  | 'past_due' 
  | 'canceled'
  | 'incomplete'
  | 'paused';

export interface SubscriptionInfo {
  userId: string;
  tier: SubscriptionTier;
  status: ClerkSubscriptionStatus;
  isActive: boolean;
  isInTrial: boolean;
  hasExpired: boolean;
  currentPeriodEnd?: Date;
  trialEnd?: Date;
  clerkSubscriptionId?: string;
  clerkPlanId?: string;
  features: string[];
  permissions: TierPermissions;
}

export interface TierPermissions {
  maxImageGenerations: number;
  allowsHighResolution: boolean;
  allowsAdvancedFeatures: boolean;
  allowsCommercialUse: boolean;
  allowsAPIAccess: boolean;
  allowsPriorityProcessing: boolean;
  maxConcurrentGenerations: number;
  allowsCustomModels: boolean;
  allowsBatchProcessing: boolean;
  allowsImageUpscaling: boolean;
}

export interface SubscriptionValidationResult {
  valid: boolean;
  subscription: SubscriptionInfo;
  reason?: string;
  upgradeRequired?: boolean;
  recommendedTier?: 'plus' | 'pro';
}

export interface SubscriptionChangeRequest {
  userId: string;
  newTier: SubscriptionTier;
  clerkSubscriptionId?: string;
  clerkPlanId?: string;
  billingCycle?: 'monthly' | 'yearly';
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

export interface SubscriptionChangeResult {
  success: boolean;
  subscriptionId: string;
  newTier: SubscriptionTier;
  effectiveDate: Date;
  nextBillingDate?: Date;
  prorationAmount?: number;
  error?: string;
}

// Quota Reset and Scheduling Types
export interface QuotaResetJob {
  id: string;
  userId: string;
  scheduledAt: Date;
  executedAt?: Date;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
}

export interface BulkQuotaOperation {
  operation: 'reset' | 'addCredits' | 'setUsage';
  userIds: string[];
  credits?: number;
  usage?: number;
  scheduledAt?: Date;
}

export interface BulkQuotaResult {
  operation: string;
  results: Array<{
    userId: string;
    success: boolean;
    error?: string;
    creditsAdded?: number;
    newUsage?: number;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Middleware Extension Types
declare global {
  namespace Express {
    interface Request {
      quotaInfo?: QuotaInfo;
      quotaValidation?: QuotaValidationResult;
      subscriptionInfo?: SubscriptionInfo;
      tierPermissions?: TierPermissions;
    }
  }
}

// Clerk API Integration Types
export interface ClerkWebhookEvent {
  type: string;
  data: any;
  object: string;
  timestamp: number;
}

export interface ClerkSubscriptionWebhookData {
  id: string;
  subscription_id: string;
  plan_id: string;
  customer_id: string;
  status: ClerkSubscriptionStatus;
  current_period_start: number;
  current_period_end: number;
  trial_start?: number;
  trial_end?: number;
  cancel_at_period_end: boolean;
  metadata?: Record<string, any>;
}

// Analytics and Reporting Types
export interface QuotaAnalytics {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  usage: {
    total: number;
    byDay: Record<string, number>;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  trends: {
    averageDaily: number;
    peakDay: string;
    peakUsage: number;
    projectedMonthly: number;
  };
  recommendations: string[];
}

export interface SubscriptionAnalytics {
  tier: SubscriptionTier;
  totalUsers: number;
  activeUsers: number;
  trialingUsers: number;
  churnRate: number;
  upgradeRate: number;
  revenueImpact: number;
  usage: {
    averageMonthly: number;
    medianMonthly: number;
    utilizationRate: number;
  };
}

// Google Gemini API Integration Types
export type ImageQuality = 'standard' | 'hd' | 'ultra';
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:2';
export type ImageStyle = 'realistic' | 'artistic' | 'anime' | 'abstract' | 'cinematic';

export interface GeminiModelConfig {
  model: string;
  temperature: number;
  topK: number;
  topP: number;
  maxOutputTokens: number;
  safetySettings: any[];
}

export interface GeminiGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  quality: ImageQuality;
  aspectRatio: AspectRatio;
  style?: ImageStyle;
  batchSize?: number;
  subscriptionTier: SubscriptionTier;
  userId: string;
  seed?: number;
  steps?: number;
  guidance?: number;
  customModel?: string;
}

export interface GeminiGenerationResponse {
  success: boolean;
  images: GeminiGeneratedImage[];
  metadata: GeminiGenerationMetadata;
  usage: GeminiUsageData;
  error?: string;
}

export interface GeminiGeneratedImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  format: string;
  size: number;
  metadata: {
    prompt: string;
    analysis?: string;
    generatedAt: string;
  };
}

export interface GeminiGenerationMetadata {
  prompt: string;
  enhancedPrompt: string;
  model: string;
  quality: ImageQuality;
  aspectRatio: AspectRatio;
  style?: ImageStyle;
  generatedAt: string;
  processingTime: number;
  subscriptionTier: SubscriptionTier;
  inputImageAnalysis?: string;
  inputImageCount?: number;
  compositionAnalysis?: string;
  refinementType?: string;
  refinementAnalysis?: string;
}

export interface GeminiUsageData {
  creditsUsed: number;
  tokensUsed: number;
}

export interface GeminiError {
  code: string;
  message: string;
  details?: any;
}

// Image Processing Types
export interface ImageProcessingOptions {
  resize?: {
    width: number;
    height: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  };
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  optimize?: boolean;
  watermark?: {
    text: string;
    opacity: number;
    position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  };
}

export interface ProcessedImage {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
  metadata: {
    originalSize: number;
    compressionRatio: number;
    processingTime: number;
  };
}

// File Upload Types
export interface FileUploadInfo {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  fieldname: string;
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: {
    dimensions?: { width: number; height: number };
    format?: string;
    colorSpace?: string;
    channels?: number;
  };
}

// Image Generation Orchestration Types
export interface GenerationContext {
  userId: string;
  subscriptionTier: SubscriptionTier;
  quotaInfo: QuotaInfo;
  subscriptionInfo: SubscriptionInfo;
  request: GeminiGenerationRequest;
}

export interface GenerationResult {
  success: boolean;
  data?: {
    images: GeminiGeneratedImage[];
    metadata: GeminiGenerationMetadata;
    usage: GeminiUsageData;
    generationRecord: ImageGeneration;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Service Health Check Types
export interface ServiceHealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: string;
  error?: string;
  details?: any;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealthCheck[];
  timestamp: string;
  uptime: number;
}

// Test Utilities Types
export interface MockGenerationData {
  request: GeminiGenerationRequest;
  response: GeminiGenerationResponse;
  expectedCredits: number;
  expectedTokens: number;
}

export interface TestImageData {
  name: string;
  buffer: Buffer;
  mimetype: string;
  dimensions: { width: number; height: number };
  format: string;
}

// Image Generation API Request/Response Types
export interface TextToImageRequest {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  style?: 'realistic' | 'artistic' | 'anime' | 'digital-art' | 'photography';
  quality?: 'standard' | 'hd';
}

export interface ImageToImageRequest {
  prompt: string;
  transformationType?: 'enhance' | 'stylize' | 'background-change' | 'object-removal';
  strength?: number;
}

export interface MultiImageRequest {
  prompt: string;
  compositionType?: 'collage' | 'blend' | 'layered' | 'panorama';
  layout?: 'grid' | 'horizontal' | 'vertical' | 'custom';
}

export interface RefineImageRequest {
  prompt?: string;
  refinementType?: 'upscale' | 'enhance-details' | 'color-correction' | 'lighting-adjustment';
  adjustments?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    sharpness?: number;
  };
  preserveAspectRatio?: boolean;
}

export interface ImageGenerationResponse {
  success: boolean;
  data?: {
    imageUrl: string;
    imageId: string;
    metadata: {
      width: number;
      height: number;
      format: string;
      size: number;
      aspectRatio: string;
      generationType: string;
      processingTime: number;
    };
    usage: {
      creditsUsed: number;
      tokensConsumed: number;
      quotaRemaining: number;
    };
  };
  message?: string;
}

export interface GenerationHistoryResponse {
  success: boolean;
  data?: {
    generations: ImageGeneration[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
  message?: string;
}

export interface QuotaStatusResponse {
  success: boolean;
  data?: {
    subscription: SubscriptionTier;
    current: {
      images: number;
      credits: number;
    };
    limits: {
      images: number;
      credits: number;
      fileSize: number;
      maxDimensions: number;
      multiImageCount: number;
    };
    resetDate: string;
    usage: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  message?: string;
}

// Extended Request interfaces with file upload support
export interface ImageUploadRequest extends Express.Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
  user?: {
    id: string;
    subscriptionStatus?: string;
  };
  quotaInfo?: QuotaInfo;
}

// Rate Limiting Types
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
  onLimitReached?: (req: any, res: any) => void;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}