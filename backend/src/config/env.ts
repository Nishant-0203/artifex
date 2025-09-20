import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  
  // Clerk Authentication (required for production)
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  
  // Optional environment variables
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // Google Gemini Configuration
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required for image generation'),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash-exp'),
  GEMINI_MAX_OUTPUT_TOKENS: z.string().default('8192').transform((val) => parseInt(val, 10)),
  GEMINI_TEMPERATURE: z.string().default('0.9').transform((val) => parseFloat(val)),
  
  // Image Generation Configuration
  IMAGE_UPLOAD_MAX_SIZE: z.string().default('10485760').transform((val) => parseInt(val, 10)), // 10MB
  IMAGE_UPLOAD_MAX_FILES: z.string().default('5').transform((val) => parseInt(val, 10)),
  IMAGE_TEMP_DIR: z.string().default('./temp/uploads'),
  IMAGE_STORAGE_DIR: z.string().default('./storage/images'),
  IMAGE_CLEANUP_INTERVAL: z.string().default('3600000').transform((val) => parseInt(val, 10)), // 1 hour
  
  // Quota and Subscription Settings
  FREE_TIER_MONTHLY_LIMIT: z.string().default('10').transform((val) => parseInt(val, 10)),
  PLUS_TIER_MONTHLY_LIMIT: z.string().default('100').transform((val) => parseInt(val, 10)),
  PRO_TIER_MONTHLY_LIMIT: z.string().default('1000').transform((val) => parseInt(val, 10)),
  
  // API Keys (optional for future use)
  GOOGLE_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  
  // Email configuration (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

// Validate environment variables
const validateEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Invalid environment configuration:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
};

// Export validated configuration
export const config = validateEnv();

// Environment utilities
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

// Configuration object with defaults
export const appConfig = {
  server: {
    port: config.PORT,
    env: config.NODE_ENV,
    corsOrigin: config.CORS_ORIGIN,
  },
  database: {
    uri: config.MONGODB_URI,
  },
  auth: {
    jwtSecret: config.JWT_SECRET || 'fallback-secret-key-for-development',
    jwtExpiresIn: config.JWT_EXPIRES_IN,
    clerkSecretKey: config.CLERK_SECRET_KEY,
    clerkPublishableKey: config.CLERK_PUBLISHABLE_KEY,
    clerkWebhookSecret: config.CLERK_WEBHOOK_SECRET,
  },
  gemini: {
    apiKey: config.GEMINI_API_KEY,
    model: config.GEMINI_MODEL,
    maxOutputTokens: config.GEMINI_MAX_OUTPUT_TOKENS,
    temperature: config.GEMINI_TEMPERATURE,
  },
  imageGeneration: {
    upload: {
      maxSize: config.IMAGE_UPLOAD_MAX_SIZE,
      maxFiles: config.IMAGE_UPLOAD_MAX_FILES,
      tempDir: config.IMAGE_TEMP_DIR,
      storageDir: config.IMAGE_STORAGE_DIR,
    },
    cleanup: {
      interval: config.IMAGE_CLEANUP_INTERVAL,
    },
    quotas: {
      free: config.FREE_TIER_MONTHLY_LIMIT,
      plus: config.PLUS_TIER_MONTHLY_LIMIT,
      pro: config.PRO_TIER_MONTHLY_LIMIT,
    },
  },
  apis: {
    clerk: config.CLERK_SECRET_KEY,
    google: config.GOOGLE_API_KEY,
    stripe: config.STRIPE_SECRET_KEY,
  },
  email: {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
};