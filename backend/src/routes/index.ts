import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import generateRouter from './generate';
import testRouter from './test';
import connectionTestRouter from './connection-test';

// Create main router
const router = Router();

// Health check routes
router.use('/health', healthRouter);

// Test routes
router.use('/test', testRouter);

// Connection test routes (no auth required)
router.use('/connection-test', connectionTestRouter);

// Authentication routes
router.use('/auth', authRouter);

// Image generation routes
router.use('/generate', generateRouter);

// Future route modules will be mounted here
// router.use('/users', usersRouter);
// router.use('/subscriptions', subscriptionsRouter);

// API information endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Artifex API v1',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/v1/health',
      auth: '/api/v1/auth',
      generate: '/api/v1/generate',
      // Future endpoints will be listed here
      // users: '/api/v1/users',
      // subscriptions: '/api/v1/subscriptions'
    }
  });
});

export default router;