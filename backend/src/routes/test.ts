import { Router } from 'express';
import { clerkAuth, requireAuthentication } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Simple test endpoint without auth
router.get('/ping', (req, res) => {
  res.json({ 
    message: 'pong',
    timestamp: new Date().toISOString() 
  });
});

// Test endpoint with auth
router.get('/auth-test', clerkAuth, requireAuthentication, asyncHandler(async (req, res) => {
  res.json({ 
    message: 'Authentication successful',
    userId: req.auth?.userId,
    timestamp: new Date().toISOString() 
  });
}));

export default router;