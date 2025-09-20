import mongoose from 'mongoose';
import { config } from './env';
import { logger } from '../utils/logger';
import { initializeModels } from '../models';

// Connection state tracking
let isConnected = false;

export const connectDB = async (): Promise<void> => {
  try {
    if (isConnected) {
      logger.info('📊 Using existing MongoDB connection');
      return;
    }

    // Mongoose connection options
    const options = {
      // Connection pool settings
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable mongoose buffering
    };

    // Connect to MongoDB
    await mongoose.connect(config.MONGODB_URI, options);
    isConnected = true;
    logger.info('✅ Connected to MongoDB');

    // Initialize models and their relationships
    await initializeModels();
    logger.info('📋 Database models initialized');

  } catch (error) {
    logger.error('❌ MongoDB connection error:', error as Error);
    throw error;
  }
};

// Connection event listeners
mongoose.connection.on('connected', () => {
  logger.info('🔗 Mongoose connected to MongoDB');
  isConnected = true;
});

mongoose.connection.on('error', (error) => {
  logger.error('❌ Mongoose connection error:', error);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  logger.warn('🔌 Mongoose disconnected from MongoDB');
  isConnected = false;
});

// Database disconnect utility
export const disconnectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      isConnected = false;
      logger.info('✅ MongoDB connection closed');
    }
  } catch (error) {
    logger.error('❌ Error closing MongoDB connection:', error as Error);
    throw error;
  }
};

// Utility functions
export const getConnectionState = (): boolean => {
  return isConnected && mongoose.connection.readyState === 1;
};

export const getConnectionInfo = () => {
  const connection = mongoose.connection;
  return {
    readyState: connection.readyState,
    host: connection.host,
    port: connection.port,
    name: connection.name,
    isConnected: getConnectionState()
  };
};