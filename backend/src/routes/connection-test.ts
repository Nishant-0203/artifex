import { Router } from 'express';

const router = Router();

// Simple connectivity test - no auth or database required
router.get('/connection', (req, res) => {
  res.json({
    success: true,
    message: 'Backend-Frontend connection successful!',
    timestamp: new Date().toISOString(),
    backend: {
      port: process.env.PORT || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      corsOrigin: process.env.CORS_ORIGIN || 'unknown'
    },
    headers: {
      origin: req.headers.origin,
      host: req.headers.host,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...'
    }
  });
});

// CORS preflight test
router.options('/connection', (req, res) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

export default router;