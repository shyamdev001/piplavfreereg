import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import multer from 'multer';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : 'File upload failed.';
    return res.status(400).json({ message });
  }

  if (err && typeof err === 'object' && 'name' in err && (err as Error).name === 'ValidationError') {
    return res.status(400).json({ message: (err as Error).message });
  }

  if (err && typeof err === 'object' && 'code' in err && (err as { code?: number }).code === 11000) {
    return res.status(409).json({ message: 'A record with these details already exists.' });
  }

  console.error('[unhandled error]', err);
  return res.status(500).json({
    message: 'Something went wrong. Please try again later.',
    ...(env.isProduction ? {} : { stack: (err as Error)?.stack, raw: String(err) }),
  });
}
