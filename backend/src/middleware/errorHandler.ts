import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Custom error classes
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden access') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500);
  }
}

// Image generation specific errors
export class ImageGenerationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class FileUploadError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class QuotaExceededError extends AppError {
  constructor(message: string = 'Generation quota exceeded') {
    super(message, 429);
  }
}

export class InvalidImageError extends AppError {
  constructor(message: string = 'Invalid image format or content') {
    super(message, 400);
  }
}

export class ImageProcessingError extends AppError {
  constructor(message: string = 'Error processing image') {
    super(message, 500);
  }
}

// Handle MongoDB errors
const handleMongoError = (error: any): AppError => {
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    return new ValidationError(`Validation Error: ${messages.join(', ')}`);
  }

  if (error.name === 'CastError') {
    return new ValidationError(`Invalid ${error.path}: ${error.value}`);
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = field ? error.keyValue[field] : 'unknown';
    return new ConflictError(`${field || 'Field'} '${value}' already exists`);
  }

  return new InternalServerError('Database error occurred');
};

// Handle Multer file upload errors
const handleMulterError = (error: any): AppError => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new FileUploadError('File size exceeds the allowed limit');
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return new FileUploadError('Too many files uploaded');
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new FileUploadError('Unexpected file field');
  }
  
  return new FileUploadError('File upload error occurred');
};

// Handle image processing errors
const handleImageError = (error: any): AppError => {
  if (error.message?.includes('unsupported image format')) {
    return new InvalidImageError('Unsupported image format. Please use JPEG, PNG, or WebP');
  }
  
  if (error.message?.includes('image too small') || error.message?.includes('dimensions')) {
    return new InvalidImageError('Image dimensions are invalid or too small');
  }
  
  if (error.message?.includes('quota') || error.message?.includes('limit')) {
    return new QuotaExceededError(error.message);
  }
  
  return new ImageProcessingError('Error processing the image');
};

// Development error response
const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    status: 'error',
    error: err,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });
};

// Production error response
const sendErrorProd = (err: AppError, res: Response) => {
  // Operational errors: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Programming or unknown errors: don't leak error details
    logger.error('ERROR:', err);

    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString(),
    });
  }
};

// Global error handler middleware
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`${req.method} ${req.originalUrl} - ${err.message}`, {
    error: err,
    requestId: req.headers['x-request-id'],
    userId: (req as any).user?.id,
  });

  // Handle MongoDB errors
  if (err.name === 'ValidationError' || err.name === 'CastError' || err.code === 11000) {
    error = handleMongoError(err);
  }
  
  // Handle Multer file upload errors
  else if (err.name === 'MulterError' || (err.code && ['LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE'].includes(err.code))) {
    error = handleMulterError(err);
  }
  
  // Handle image processing and generation errors
  else if (err.name === 'ImageGenerationError' || err.name === 'ImageProcessingError' || 
           (err.message && (err.message.includes('image') || err.message.includes('quota') || err.message.includes('generation')))) {
    error = handleImageError(err);
  }

  // Convert non-AppError to AppError
  if (!(error instanceof AppError)) {
    error = new InternalServerError();
  }

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// 404 error handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};