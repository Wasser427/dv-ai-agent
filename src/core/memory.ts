import { Message } from './llm';

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class Memory {
  private static instance: Memory;
  private conversationHistory: ConversationEntry[] = [];
  private maxHistory: number = 10;

  private constructor() {}

  static getInstance(): Memory {
    if (!Memory.instance) {
      Memory.instance = new Memory();
    }
    return Memory.instance;
  }

  addUserMessage(content: string): void {
    this.conversationHistory.push({
      role: 'user',
      content,
      timestamp: Date.now()
    });
    this.trimHistory();
  }

  addAssistantMessage(content: string): void {
    this.conversationHistory.push({
      role: 'assistant',
      content,
      timestamp: Date.now()
    });
    this.trimHistory();
  }

  getHistory(): ConversationEntry[] {
    return [...this.conversationHistory];
  }

  getMessages(): Message[] {
    return this.conversationHistory.map(entry => ({
      role: entry.role,
      content: entry.content
    }));
  }

  clear(): void {
    this.conversationHistory = [];
    console.log('记忆已清空');
  }

  private trimHistory(): void {
    if (this.conversationHistory.length > this.maxHistory * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistory * 2);
    }
  }

  getSize(): number {
    return this.conversationHistory.length;
  }
}
