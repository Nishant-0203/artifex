import { Router } from 'express';
import healthRouter from '@/routes/health';
import authRouter from '@/routes/auth';

// Create main router
const router = Router();

// Health check routes
router.use('/health', healthRouter);

// Authentication routes
router.use('/auth', authRouter);

// Future route modules will be mounted here
// router.use('/users', usersRouter);
// router.use('/generate', generateRouter);
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
      // Future endpoints will be listed here
      // users: '/api/v1/users',
      // generate: '/api/v1/generate',
      // subscriptions: '/api/v1/subscriptions'
    }
  });
});

export default router;