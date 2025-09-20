/**
 * Custom error classes for image generation operations
 * Provides specific error handling for different failure scenarios
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Gemini API specific errors
 */
export class GeminiAPIError extends AppError {
  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'GEMINI_API_ERROR'
  ) {
    super(message, statusCode, errorCode);
  }
}

/**
 * Image processing errors
 */
export class ImageProcessingError extends AppError {
  constructor(
    message: string,
    statusCode: number = 400,
    errorCode: string = 'IMAGE_PROCESSING_ERROR'
  ) {
    super(message, statusCode, errorCode);
  }
}

/**
 * Quota exceeded errors
 */
export class QuotaExceededError extends AppError {
  public readonly remainingQuota: number;
  public readonly resetDate: Date;

  constructor(
    message: string,
    remainingQuota: number = 0,
    resetDate: Date = new Date(),
    errorCode: string = 'QUOTA_EXCEEDED'
  ) {
    super(message, 429, errorCode);
    this.remainingQuota = remainingQuota;
    this.resetDate = resetDate;
  }
}

/**
 * Subscription validation errors
 */
export class SubscriptionError extends AppError {
  public readonly requiredTier: string;
  public readonly currentTier: string;

  constructor(
    message: string,
    requiredTier: string,
    currentTier: string,
    errorCode: string = 'SUBSCRIPTION_ERROR'
  ) {
    super(message, 403, errorCode);
    this.requiredTier = requiredTier;
    this.currentTier = currentTier;
  }
}

/**
 * File upload and validation errors
 */
export class FileUploadError extends AppError {
  public readonly fileName?: string;
  public readonly fileSize?: number;
  public readonly allowedTypes?: string[];

  constructor(
    message: string,
    fileName?: string,
    fileSize?: number,
    allowedTypes?: string[],
    errorCode: string = 'FILE_UPLOAD_ERROR'
  ) {
    super(message, 400, errorCode);
    if (fileName !== undefined) this.fileName = fileName;
    if (fileSize !== undefined) this.fileSize = fileSize;
    if (allowedTypes !== undefined) this.allowedTypes = allowedTypes;
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number; // seconds
  public readonly limit: number;
  public readonly used: number;

  constructor(
    message: string,
    retryAfter: number,
    limit: number,
    used: number,
    errorCode: string = 'RATE_LIMIT_ERROR'
  ) {
    super(message, 429, errorCode);
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.used = used;
  }
}

/**
 * Validation errors for generation parameters
 */
export class ValidationError extends AppError {
  public readonly field: string;
  public readonly value: any;
  public readonly allowedValues?: any[];

  constructor(
    message: string,
    field: string,
    value: any,
    allowedValues?: any[],
    errorCode: string = 'VALIDATION_ERROR'
  ) {
    super(message, 400, errorCode);
    this.field = field;
    this.value = value;
    if (allowedValues !== undefined) this.allowedValues = allowedValues;
  }
}

/**
 * Database operation errors
 */
export class DatabaseError extends AppError {
  public readonly operation: string;
  public readonly collection?: string;

  constructor(
    message: string,
    operation: string,
    collection?: string,
    errorCode: string = 'DATABASE_ERROR'
  ) {
    super(message, 500, errorCode);
    this.operation = operation;
    if (collection !== undefined) this.collection = collection;
  }
}

/**
 * External service integration errors
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly originalError?: any;

  constructor(
    message: string,
    service: string,
    originalError?: any,
    statusCode: number = 503,
    errorCode: string = 'EXTERNAL_SERVICE_ERROR'
  ) {
    super(message, statusCode, errorCode);
    this.service = service;
    this.originalError = originalError;
  }
}

/**
 * Error mapping utilities
 */
export class ErrorMapper {
  /**
   * Map Gemini API errors to application errors
   */
  static mapGeminiError(error: any, operation: string): AppError {
    const message = error.message || 'Unknown Gemini API error';
    
    if (message.includes('API key')) {
      return new GeminiAPIError(
        'Invalid or expired Google Gemini API key',
        401,
        'GEMINI_INVALID_API_KEY'
      );
    }
    
    if (message.includes('quota') || message.includes('rate limit')) {
      const retryAfter = error.retryAfter || 3600; // Default 1 hour
      return new RateLimitError(
        'Gemini API rate limit exceeded',
        retryAfter,
        error.limit || 100,
        error.used || 0,
        'GEMINI_RATE_LIMIT'
      );
    }
    
    if (message.includes('safety') || message.includes('policy')) {
      return new GeminiAPIError(
        'Content violates safety guidelines. Please modify your request.',
        400,
        'GEMINI_SAFETY_VIOLATION'
      );
    }
    
    if (message.includes('timeout') || message.includes('deadline')) {
      return new GeminiAPIError(
        'Generation request timed out. Please try again.',
        408,
        'GEMINI_TIMEOUT'
      );
    }
    
    if (message.includes('model') || message.includes('version')) {
      return new GeminiAPIError(
        'Invalid model configuration',
        400,
        'GEMINI_INVALID_MODEL'
      );
    }
    
    // Generic Gemini error
    return new GeminiAPIError(
      `Gemini ${operation} failed: ${message}`,
      500,
      'GEMINI_UNKNOWN_ERROR'
    );
  }

  /**
   * Map image processing errors
   */
  static mapImageProcessingError(error: any, operation: string): AppError {
    const message = error.message || 'Unknown image processing error';
    
    if (message.includes('format') || message.includes('type')) {
      return new ImageProcessingError(
        'Unsupported image format',
        400,
        'UNSUPPORTED_IMAGE_FORMAT'
      );
    }
    
    if (message.includes('size') || message.includes('dimension')) {
      return new ImageProcessingError(
        'Image dimensions exceed limits',
        400,
        'IMAGE_SIZE_EXCEEDED'
      );
    }
    
    if (message.includes('corrupt') || message.includes('invalid')) {
      return new ImageProcessingError(
        'Image file is corrupted or invalid',
        400,
        'CORRUPTED_IMAGE'
      );
    }
    
    if (message.includes('memory') || message.includes('resource')) {
      return new ImageProcessingError(
        'Insufficient resources to process image',
        507,
        'INSUFFICIENT_RESOURCES'
      );
    }
    
    // Generic processing error
    return new ImageProcessingError(
      `Image processing ${operation} failed: ${message}`,
      500,
      'PROCESSING_UNKNOWN_ERROR'
    );
  }

  /**
   * Map file upload errors
   */
  static mapFileUploadError(error: any, fileName?: string): AppError {
    const message = error.message || 'File upload error';
    
    if (message.includes('size') || message.includes('limit')) {
      return new FileUploadError(
        'File size exceeds limit',
        fileName,
        error.fileSize,
        undefined,
        'FILE_TOO_LARGE'
      );
    }
    
    if (message.includes('type') || message.includes('format')) {
      return new FileUploadError(
        'File type not allowed',
        fileName,
        undefined,
        error.allowedTypes,
        'INVALID_FILE_TYPE'
      );
    }
    
    if (message.includes('missing') || message.includes('required')) {
      return new FileUploadError(
        'Required file is missing',
        fileName,
        undefined,
        undefined,
        'MISSING_FILE'
      );
    }
    
    // Generic upload error
    return new FileUploadError(
      `File upload failed: ${message}`,
      fileName,
      undefined,
      undefined,
      'UPLOAD_FAILED'
    );
  }
}

/**
 * Error response formatter for API responses
 */
export class ErrorResponseFormatter {
  /**
   * Format error for API response
   */
  static formatError(error: AppError): {
    status: string;
    message: string;
    code: string;
    statusCode: number;
    details?: any;
  } {
    const baseResponse = {
      status: 'error',
      message: error.message,
      code: error.errorCode,
      statusCode: error.statusCode
    };

    // Add specific error details based on error type
    if (error instanceof QuotaExceededError) {
      return {
        ...baseResponse,
        details: {
          remainingQuota: error.remainingQuota,
          resetDate: error.resetDate.toISOString(),
          type: 'quota_exceeded'
        }
      };
    }

    if (error instanceof SubscriptionError) {
      return {
        ...baseResponse,
        details: {
          requiredTier: error.requiredTier,
          currentTier: error.currentTier,
          type: 'subscription_required'
        }
      };
    }

    if (error instanceof RateLimitError) {
      return {
        ...baseResponse,
        details: {
          retryAfter: error.retryAfter,
          limit: error.limit,
          used: error.used,
          type: 'rate_limit'
        }
      };
    }

    if (error instanceof FileUploadError) {
      return {
        ...baseResponse,
        details: {
          fileName: error.fileName,
          fileSize: error.fileSize,
          allowedTypes: error.allowedTypes,
          type: 'file_upload'
        }
      };
    }

    if (error instanceof ValidationError) {
      return {
        ...baseResponse,
        details: {
          field: error.field,
          value: error.value,
          allowedValues: error.allowedValues,
          type: 'validation'
        }
      };
    }

    return baseResponse;
  }

  /**
   * Format error for logging
   */
  static formatForLogging(error: AppError, context?: any): {
    message: string;
    errorCode: string;
    statusCode: number;
    stack?: string;
    context?: any;
    timestamp: string;
  } {
    const result: {
      message: string;
      errorCode: string;
      statusCode: number;
      stack?: string;
      context?: any;
      timestamp: string;
    } = {
      message: error.message,
      errorCode: error.errorCode,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString()
    };

    if (error.stack !== undefined) {
      result.stack = error.stack;
    }

    if (context !== undefined) {
      result.context = context;
    }

    return result;
  }
}

/**
 * Retry logic for transient errors
 */
export class RetryHandler {
  /**
   * Determine if error is retryable
   */
  static isRetryable(error: AppError): boolean {
    const retryableCodes = [
      'GEMINI_TIMEOUT',
      'GEMINI_RATE_LIMIT',
      'EXTERNAL_SERVICE_ERROR',
      'DATABASE_ERROR'
    ];
    
    return retryableCodes.includes(error.errorCode) || error.statusCode >= 500;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static calculateDelay(attempt: number, baseDelay: number = 1000): number {
    return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
  }

  /**
   * Execute operation with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: AppError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof AppError ? error : new AppError(
          error instanceof Error ? error.message : 'Unknown error',
          500,
          'UNKNOWN_ERROR'
        );
        
        if (attempt === maxAttempts || !this.isRetryable(lastError)) {
          throw lastError;
        }
        
        const delay = this.calculateDelay(attempt, baseDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}

export default {
  AppError,
  GeminiAPIError,
  ImageProcessingError,
  QuotaExceededError,
  SubscriptionError,
  FileUploadError,
  RateLimitError,
  ValidationError,
  DatabaseError,
  ExternalServiceError,
  ErrorMapper,
  ErrorResponseFormatter,
  RetryHandler
};