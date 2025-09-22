import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { clerkAuth } from './middleware/auth';
import { logger } from './utils/logger';
import routes from './routes';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      rateLimit: {
        limit: number;
        used: number;
        remaining: number;
        resetTime?: Date;
      };
    }
  }
}

// Create Express application
const app = express();

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration
const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'clerk-db-jwt'],
}));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Body parsing middleware with increased limits for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for generated images (optional)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Clerk authentication middleware
app.use(clerkAuth);

// Request ID middleware
app.use((req, res, next) => {
  (req as any).id = req.headers['x-request-id'] || uuid();
  res.setHeader('x-request-id', (req as any).id);
  next();
});

// Rate limiting with enhanced response
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const resetMs = req.rateLimit.resetTime ? Math.max(req.rateLimit.resetTime.getTime() - Date.now(), 0) : options.windowMs;
    const retryAfter = Math.ceil(resetMs / 1000);
    res.set('Retry-After', String(retryAfter));
    res.status(options.statusCode ?? 429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: `${retryAfter}s`,
      limit: req.rateLimit.limit,
      used: req.rateLimit.used,
      remaining: req.rateLimit.remaining,
      resetTime: req.rateLimit.resetTime?.toISOString() ?? null,
    });
  },
});
app.use('/api', limiter);

// API routes
app.use('/api/v1', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Artifex Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;