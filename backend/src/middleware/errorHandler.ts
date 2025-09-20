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