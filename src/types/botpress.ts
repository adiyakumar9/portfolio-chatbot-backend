// src/types/botpress.ts
export interface MessagePayload {
  type: string;
  text: string;
}

export interface BotpressMessage {
  id: string;
  createdAt: string;
  conversationId: string;
  userId: string;
  payload: MessagePayload;
}

export interface BotpressMessageResponse {
  message: BotpressMessage;
}

export interface BotpressConversation {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface BotpressUser {
  id: string;
  key: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MessagesResponse {
  messages: BotpressMessage[];
  meta: Record<string, any>;
}

export interface ChatResponse {
  message: BotpressMessageResponse;
  botResponse?: BotpressMessage | null;
  conversation: {
    id: string;
    isStarted: boolean;
  };
  messages: BotpressMessage[];
  user: {
    key: string;
    id?: string;
  };
}