import { Router, Request, Response } from 'express';
import { getConnectionInfo } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Health check endpoint
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Check database connection
  const dbInfo = getConnectionInfo();
  const responseTime = Date.now() - startTime;
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {
      database: {
        status: dbInfo.isConnected ? 'connected' : 'disconnected',
        readyState: dbInfo.readyState,
        host: dbInfo.host,
        port: dbInfo.port,
        name: dbInfo.name,
      },
      api: {
        status: 'running',
        responseTime: `${responseTime}ms`,
      }
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    }
  };

  // Return appropriate status code based on service health
  const statusCode = dbInfo.isConnected ? 200 : 503;
  
  res.status(statusCode).json(healthData);
}));

// Detailed health check endpoint
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Check database connection with additional details
  const dbInfo = getConnectionInfo();
  
  // System information
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  const detailedHealth = {
    status: dbInfo.isConnected ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    responseTime: `${Date.now() - startTime}ms`,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: {
        process: process.uptime(),
        system: require('os').uptime(),
      },
      environment: process.env.NODE_ENV || 'development',
    },
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      unit: 'MB'
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    database: {
      status: dbInfo.isConnected ? 'connected' : 'disconnected',
      readyState: dbInfo.readyState,
      readyStateText: getReadyStateText(dbInfo.readyState),
      connection: {
        host: dbInfo.host,
        port: dbInfo.port,
        name: dbInfo.name,
      }
    },
  };

  const statusCode = dbInfo.isConnected ? 200 : 503;
  
  res.status(statusCode).json(detailedHealth);
}));

// Simple ping endpoint
router.get('/ping', (req: Request, res: Response) => {
  res.json({
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

// Helper function to convert readyState number to text
const getReadyStateText = (readyState: number): string => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };
  
  return states[readyState as keyof typeof states] || 'unknown';
};

export default router;