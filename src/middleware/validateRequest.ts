// src/middleware/validateRequest.ts
import { Request, Response, NextFunction } from 'express';

export const validateChatRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { message } = req.body;
  const userKey = req.headers['x-user-key'];

  if (!userKey || typeof userKey !== 'string') {
    res.status(400).json({ error: 'Valid user key is required' });
    return;
  }

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Valid message is required' });
    return;
  }

  next();
};