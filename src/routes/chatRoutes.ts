// src/routes/chatRoutes.ts
import { Router } from 'express';
import {  handleChatMessage } from '../controllers/chatController';

const router = Router();
// router.post('/users',createUser );

router.post('/messages', handleChatMessage);

export default router;
