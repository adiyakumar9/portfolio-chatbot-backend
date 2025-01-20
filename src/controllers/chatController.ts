// src/controllers/chatController.ts
import { Request, Response } from 'express';
import { botpressService } from '../services/botpressService';
import logger from '../utils/logger';
import { ChatResponse } from '../types/botpress';

export const handleChatMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, userId } = req.body;
    const userKey = req.headers['x-user-key'] as string;
    const conversationId = req.body.conversationId;

    logger.info('Received message request:', { message, userId, hasUserKey: !!userKey, conversationId });

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Get or create user
    let currentUserKey = userKey;
    let currentUserId = userId;
    
    if (!currentUserKey) {
      const userResponse = await botpressService.createUser();
      currentUserKey = userResponse.key;
      currentUserId = userResponse.user.id;
      logger.info('Created new user:', { userId: currentUserId, userKey: currentUserKey });
    }

    // Get or create conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const conversation = await botpressService.createConversation(currentUserKey);
      currentConversationId = conversation.id;
      logger.info('Created new conversation:', { conversationId: currentConversationId });
    }

    // Send user message
    const sentMessage = await botpressService.sendMessage(
      currentUserKey,
      currentConversationId,
      message
    );

    // Wait for bot response
    const botResponse = await botpressService.waitForBotResponse(
      currentUserKey,
      currentConversationId,
      sentMessage.message.id
    );

    // Get all messages
    const { messages, meta } = await botpressService.listMessages(
      currentUserKey,
      currentConversationId
    );

    const response: ChatResponse = {
      message: sentMessage,
      botResponse,
      conversation: {
        id: currentConversationId,
        isStarted: true
      },
      messages,
      user: {
        key: currentUserKey,
        id: currentUserId
      }
    };

    res.json(response);

  } catch (error) {
    logger.error('Chat handler error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};