import axios from 'axios';
import { ConfigManager } from '../config';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LLMClient {
  private static instance: LLMClient;
  private config: ReturnType<ConfigManager['getConfig']>;
  private baseURL: string;

  private constructor() {
    const configManager = ConfigManager.getInstance();
    this.config = configManager.getConfig();
    this.baseURL = this.config.baseURL;
  }

  static getInstance(): LLMClient {
    if (!LLMClient.instance) {
      LLMClient.instance = new LLMClient();
    }
    return LLMClient.instance;
  }

  reloadConfig(): void {
    const configManager = ConfigManager.getInstance();
    this.config = configManager.getConfig();
    this.baseURL = this.config.baseURL;
  }

  async chat(messages: Message[]): Promise<string> {
    try {
      const url = `${this.baseURL}/chat/completions`;
      
      const response = await axios.post(
        url,
        {
          model: this.config.model,
          messages: messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          },
          timeout: 60000
        }
      );
      
      return response.data.choices[0]?.message?.content || '';
    } catch (error: any) {
      if (error.response) {
        console.error('LLM API 错误:', error.response.status, error.response.data);
      } else {
        console.error('LLM调用失败:', error.message);
      }
      throw error;
    }
  }
}
