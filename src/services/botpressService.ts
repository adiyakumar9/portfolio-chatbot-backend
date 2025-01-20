// src/services/botpressService.ts
import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { 
  BotpressMessage, 
  BotpressMessageResponse, 
  MessagesResponse, 
  BotpressUser 
} from '../types/botpress';

class BotpressService {
  private static instance: BotpressService;
  private readonly client: AxiosInstance;
  private readonly webhookId: string;

  constructor() {
    this.webhookId = process.env.BOTPRESS_WEBHOOK_ID || '';
    if (!this.webhookId) {
      throw new Error('BOTPRESS_WEBHOOK_ID is required');
    }

    this.client = axios.create({
      baseURL: `https://chat.botpress.cloud/${this.webhookId}`,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    logger.info('BotpressService initialized with webhook ID:', this.webhookId);
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async createUser(): Promise<{ key: string; user: BotpressUser }> {
    try {
      const response = await this.client.post<{ key: string; user: BotpressUser }>('/users', {});
      logger.info('User creation response:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async createConversation(userKey: string): Promise<{ id: string }> {
    try {
      logger.info('Creating conversation with user key:', userKey);
      
      const response = await this.client.post<{ conversation: { id: string } }>(
        '/conversations',
        {},
        {
          headers: {
            'x-user-key': userKey
          }
        }
      );

      if (!response.data?.conversation?.id) {
        logger.error('Invalid conversation response:', response.data);
        throw new Error('Invalid conversation creation response');
      }

      logger.info('Conversation created successfully:', response.data.conversation);
      return response.data.conversation;
    } catch (error: any) {
      logger.error('Error creating conversation:', error);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
  }

  async sendMessage(userKey: string, conversationId: string, messageText: string): Promise<BotpressMessageResponse> {
    try {
      const payload = {
        type: 'text',
        text: messageText
      };

      logger.info('Sending message:', { conversationId, payload });

      const response = await this.client.post<BotpressMessageResponse>(
        '/messages',
        {
          payload,
          conversationId
        },
        {
          headers: {
            'x-user-key': userKey
          }
        }
      );

      logger.info('Message sent successfully:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  async waitForBotResponse(userKey: string, conversationId: string, lastMessageId: string): Promise<BotpressMessage | null> {
    try {
      // Wait for bot to process and respond (max 10 attempts, 1 second each)
      for (let i = 0; i < 10; i++) {
        await this.wait(1000);
        
        const messages = await this.listMessages(userKey, conversationId);
        const lastMessage = messages.messages.find(m => m.id === lastMessageId);
        
        if (!lastMessage) {
          continue;
        }

        const botMessages = messages.messages.filter(msg => 
          msg.id !== lastMessageId && 
          new Date(msg.createdAt) > new Date(lastMessage.createdAt)
        );

        if (botMessages.length > 0) {
          return botMessages[0];
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error waiting for bot response:', error);
      throw error;
    }
  }

  async listMessages(userKey: string, conversationId: string): Promise<MessagesResponse> {
    try {
      const response = await this.client.get<MessagesResponse>(
        `conversations/${conversationId}/messages`,
        {
          headers: {
            'x-user-key': userKey
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error listing messages:', error);
      throw error;
    }
  }

  public static getInstance(): BotpressService {
    if (!BotpressService.instance) {
      BotpressService.instance = new BotpressService();
    }
    return BotpressService.instance;
  }
}

export const botpressService = BotpressService.getInstance();