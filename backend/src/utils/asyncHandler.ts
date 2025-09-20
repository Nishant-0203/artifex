import { Request, Response, NextFunction, RequestHandler } from 'express';

// Async handler wrapper to catch errors in async route handlers
export const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Alternative async handler for more complex scenarios
export const asyncHandlerWithErrorHandling = <T = any>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// Typed async handler for better type safety
export const typedAsyncHandler = <
  TRequest = Request,
  TResponse = Response
>(
  fn: (req: TRequest, res: TResponse, next: NextFunction) => Promise<void>
) => {
  return (req: TRequest, res: TResponse, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Async handler specifically for validation middleware
export const asyncValidationHandler = (
  validationFn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await validationFn(req, res, next);
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Helper to wrap multiple async handlers
export const wrapAsyncHandlers = (...handlers: RequestHandler[]): RequestHandler[] => {
  return handlers.map(handler => asyncHandler(handler));
};

// Async handler with timeout support
export const asyncHandlerWithTimeout = (
  fn: RequestHandler,
  timeoutMs: number = 30000
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    });

    try {
      await Promise.race([
        Promise.resolve(fn(req, res, next)),
        timeoutPromise
      ]);
    } catch (error) {
      next(error);
    }
  };
};

// Utility type for async request handlers
export type AsyncRequestHandler<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<void>;

// Export default handler
export default asyncHandler;