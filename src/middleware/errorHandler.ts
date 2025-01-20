// src/middleware/errorHandler.ts
import { Request, Response, NextFunction, Express } from 'express';
import { ErrorRequestHandler } from 'express';
import logger from '../utils/logger';

interface CustomError extends Error {
  status?: number;
  code?: string;
}

export const errorHandler: ErrorRequestHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    status: err.status,
    code: err.code
  });

  if (err.message.includes('BOTPRESS_WEBHOOK_ID')) {
    res.status(500).json({
      error: 'Bot configuration error',
      message: 'The bot is not properly configured'
    });
    return;
  }

  if (err.status) {
    res.status(err.status).json({
      error: err.code || 'Error',
      message: err.message
    });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
  return;
};

// Add custom error class for better error handling
export class APIError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export const setupErrorHandler = (app: Express): void => {
  app.use(errorHandler);
};