// src/routes/index.ts
import { Application } from 'express';
import chatRoutes from './chatRoutes';
import contactRoutes from './contacts';

export const setupRoutes = (app: Application): void => {
  app.use('/api/chat', chatRoutes);

  app.use('/api/contacts', contactRoutes);

  // setup contacts routes
};