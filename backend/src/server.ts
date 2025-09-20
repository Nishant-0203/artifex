import app from '@/app';
import { connectDB, disconnectDB } from '@/config/database';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection:', { reason, promise });
  process.exit(1);
});

// Start the server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start HTTP server
    const server = app.listen(config.PORT, () => {
      logger.info(`🚀 Server running on port ${config.PORT}`);
      logger.info(`📝 Environment: ${config.NODE_ENV}`);
      logger.info(`🔗 MongoDB: ${config.MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@')}`);
      logger.info(`🌍 CORS Origin: ${config.CORS_ORIGIN}`);
    });

    const shutdown = (signal: NodeJS.Signals) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      const forceTimeout = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000).unref();

      server.close(async () => {
        try {
          await disconnectDB();
          clearTimeout(forceTimeout);
          logger.info('Shutdown complete.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during shutdown:', err as Error);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error('❌ Failed to start server:', error as Error);
    process.exit(1);
  }
};

// Initialize server
startServer();