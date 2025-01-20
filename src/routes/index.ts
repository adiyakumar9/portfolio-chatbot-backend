// src/routes/index.ts
import { Application } from 'express';
import chatRoutes from './chatRoutes';

export const setupRoutes = (app: Application): void => {
  app.use('/api/chat', chatRoutes);
};