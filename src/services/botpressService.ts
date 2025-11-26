// src/services/botpressService.ts
import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { 
  BotpressMessage, 
  BotpressMessageResponse, 
  MessagesResponse, 
  BotpressUser 
} from '../types/botpress';

// Cache for conversation context to reduce API calls
interface ConversationCache {
  messages: BotpressMessage[];
  lastUpdated: number;
  ttl: number; // Time to live in milliseconds
}

class BotpressService {
  private static instance: BotpressService;
  private readonly client: AxiosInstance;
  private readonly webhookId: string;
  private conversationCache: Map<string, ConversationCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_RETRIES = 15; // Increased from 10
  private readonly INITIAL_WAIT = 500; // Start with 500ms instead of 1000ms
  private readonly MAX_WAIT = 3000; // Max wait time between retries

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
      },
      timeout: 30000 // 30 second timeout
    });

    logger.info('BotpressService initialized with webhook ID:', this.webhookId);
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Exponential backoff with jitter for retries
   */
  private calculateBackoff(attempt: number): number {
    const exponential = Math.min(this.INITIAL_WAIT * Math.pow(1.5, attempt), this.MAX_WAIT);
    const jitter = Math.random() * 0.1 * exponential; // Add up to 10% jitter
    return exponential + jitter;
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cache] of this.conversationCache.entries()) {
      if (now - cache.lastUpdated > cache.ttl) {
        this.conversationCache.delete(key);
        logger.debug(`Cleared expired cache for conversation: ${key}`);
      }
    }
  }

  /**
   * Get cached messages for a conversation
   */
  private getCachedMessages(conversationId: string): BotpressMessage[] | null {
    this.clearExpiredCache();
    const cache = this.conversationCache.get(conversationId);
    if (cache && Date.now() - cache.lastUpdated < cache.ttl) {
      logger.debug(`Cache hit for conversation: ${conversationId}`);
      return cache.messages;
    }
    return null;
  }

  /**
   * Update cache for a conversation
   */
  private updateCache(conversationId: string, messages: BotpressMessage[]): void {
    this.conversationCache.set(conversationId, {
      messages,
      lastUpdated: Date.now(),
      ttl: this.CACHE_TTL
    });
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
      // Invalidate cache when new message is sent
      this.conversationCache.delete(conversationId);
      return response.data;
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Improved bot response waiting with exponential backoff and early termination
   */
  async waitForBotResponse(userKey: string, conversationId: string, lastMessageId: string): Promise<BotpressMessage | null> {
    try {
      let lastKnownMessageCount = 0;
      let noChangeCount = 0;
      const MAX_NO_CHANGE_ATTEMPTS = 3; // Stop if no new messages for 3 attempts

      for (let i = 0; i < this.MAX_RETRIES; i++) {
        const backoffTime = this.calculateBackoff(i);
        await this.wait(backoffTime);
        
        logger.debug(`Waiting for bot response - attempt ${i + 1}/${this.MAX_RETRIES}`);

        const messages = await this.listMessages(userKey, conversationId);
        const lastMessage = messages.messages.find(m => m.id === lastMessageId);
        
        if (!lastMessage) {
          continue;
        }

        // Check if we got new messages
        if (messages.messages.length === lastKnownMessageCount) {
          noChangeCount++;
          if (noChangeCount >= MAX_NO_CHANGE_ATTEMPTS) {
            logger.debug('No new messages detected, stopping wait');
            break;
          }
        } else {
          noChangeCount = 0;
          lastKnownMessageCount = messages.messages.length;
        }

        // Find bot messages after the user's message
        const botMessages = messages.messages.filter(msg => 
          msg.id !== lastMessageId && 
          new Date(msg.createdAt) > new Date(lastMessage.createdAt)
        );

        if (botMessages.length > 0) {
          logger.info('Bot response received after', i + 1, 'attempts');
          return botMessages[0];
        }
      }
      
      logger.warn('No bot response received after max retries');
      return null;
    } catch (error) {
      logger.error('Error waiting for bot response:', error);
      throw error;
    }
  }

  /**
   * Improved listMessages with caching
   */
  async listMessages(userKey: string, conversationId: string): Promise<MessagesResponse> {
    try {
      // Check cache first
      const cachedMessages = this.getCachedMessages(conversationId);
      if (cachedMessages) {
        return {
          messages: cachedMessages,
          meta: {
            pageSize: cachedMessages.length,
            nextToken: undefined
          }
        };
      }

      const response = await this.client.get<MessagesResponse>(
        `conversations/${conversationId}/messages`,
        {
          headers: {
            'x-user-key': userKey
          }
        }
      );

      // Update cache
      if (response.data.messages) {
        this.updateCache(conversationId, response.data.messages);
      }

      return response.data;
    } catch (error) {
      logger.error('Error listing messages:', error);
      throw error;
    }
  }

  /**
   * Get conversation history with pagination support
   */
  async getConversationHistory(userKey: string, conversationId: string, limit: number = 50): Promise<BotpressMessage[]> {
    try {
      const response = await this.listMessages(userKey, conversationId);
      return response.messages.slice(-limit);
    } catch (error) {
      logger.error('Error getting conversation history:', error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific conversation
   */
  clearConversationCache(conversationId: string): void {
    this.conversationCache.delete(conversationId);
    logger.debug(`Cleared cache for conversation: ${conversationId}`);
  }

  /**
   * Clear all caches
   */
  clearAllCache(): void {
    this.conversationCache.clear();
    logger.debug('Cleared all conversation caches');
  }

  public static getInstance(): BotpressService {
    if (!BotpressService.instance) {
      BotpressService.instance = new BotpressService();
    }
    return BotpressService.instance;
  }
}

export const botpressService = BotpressService.getInstance();
