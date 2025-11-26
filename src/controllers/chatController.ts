// src/controllers/chatController.ts
import { Request, Response } from 'express';
import { botpressService } from '../services/botpressService';
import logger from '../utils/logger';
import { ChatResponse } from '../types/botpress';

/**
 * Handle incoming chat messages with improved error handling and performance
 */
export const handleChatMessage = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    const { message, userId } = req.body;
    const userKey = req.headers['x-user-key'] as string;
    const conversationId = req.body.conversationId;

    logger.info('Received message request:', { 
      message: message?.substring(0, 50), 
      userId, 
      hasUserKey: !!userKey, 
      conversationId 
    });

    // Validate input
    if (!message || typeof message !== 'string') {
      res.status(400).json({ 
        error: 'Message is required and must be a string',
        code: 'INVALID_MESSAGE'
      });
      return;
    }

    if (message.trim().length === 0) {
      res.status(400).json({ 
        error: 'Message cannot be empty',
        code: 'EMPTY_MESSAGE'
      });
      return;
    }

    if (message.length > 5000) {
      res.status(400).json({ 
        error: 'Message is too long (max 5000 characters)',
        code: 'MESSAGE_TOO_LONG'
      });
      return;
    }

    // Get or create user
    let currentUserKey = userKey;
    let currentUserId = userId;
    
    if (!currentUserKey) {
      try {
        const userResponse = await botpressService.createUser();
        currentUserKey = userResponse.key;
        currentUserId = userResponse.user.id;
        logger.info('Created new user:', { userId: currentUserId, userKey: currentUserKey });
      } catch (error) {
        logger.error('Failed to create user:', error);
        res.status(500).json({ 
          error: 'Failed to create user session',
          code: 'USER_CREATION_FAILED'
        });
        return;
      }
    }

    // Get or create conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      try {
        const conversation = await botpressService.createConversation(currentUserKey);
        currentConversationId = conversation.id;
        logger.info('Created new conversation:', { conversationId: currentConversationId });
      } catch (error) {
        logger.error('Failed to create conversation:', error);
        res.status(500).json({ 
          error: 'Failed to create conversation',
          code: 'CONVERSATION_CREATION_FAILED'
        });
        return;
      }
    }

    // Send user message
    let sentMessage;
    try {
      sentMessage = await botpressService.sendMessage(
        currentUserKey,
        currentConversationId,
        message
      );
      logger.info('Message sent successfully:', { messageId: sentMessage.message.id });
    } catch (error) {
      logger.error('Failed to send message:', error);
      res.status(500).json({ 
        error: 'Failed to send message',
        code: 'MESSAGE_SEND_FAILED'
      });
      return;
    }

    // Wait for bot response with timeout
    let botResponse = null;
    try {
      botResponse = await botpressService.waitForBotResponse(
        currentUserKey,
        currentConversationId,
        sentMessage.message.id
      );
      
      if (botResponse) {
        logger.info('Bot response received:', { botMessageId: botResponse.id });
      } else {
        logger.warn('No bot response received within timeout');
      }
    } catch (error) {
      logger.error('Error waiting for bot response:', error);
      // Don't fail the request if we can't get bot response, just return what we have
    }

    // Get all messages
    let messages = [];
    let meta = {};
    try {
      const messagesResponse = await botpressService.listMessages(
        currentUserKey,
        currentConversationId
      );
      messages = messagesResponse.messages || [];
      meta = messagesResponse.meta || {};
    } catch (error) {
      logger.error('Failed to list messages:', error);
      // Continue without message history
    }

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

    const responseTime = Date.now() - startTime;
    logger.info('Chat request completed successfully', { 
      responseTime: `${responseTime}ms`,
      hasBot Response: !!botResponse,
      messageCount: messages.length
    });

    // Set response headers for better caching and performance
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.status(200).json(response);

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Chat handler error:', { 
      error: error instanceof Error ? error.message : String(error),
      responseTime: `${responseTime}ms`
    });

    res.status(500).json({ 
      error: 'Failed to process message',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * Health check endpoint for monitoring
 */
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'chat-api'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed'
    });
  }
};
