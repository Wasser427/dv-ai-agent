import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { AgentConfig } from './types';

const candidatePaths = [
  path.resolve(path.dirname(process.execPath), '.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AgentConfig;

  private constructor() {
    this.config = {
      apiKey: process.env.USER_API_KEY || '',
      baseURL: process.env.USER_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.USER_MODEL || 'gpt-3.5-turbo',
      temperature: parseFloat(process.env.USER_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.USER_MAX_TOKENS || '2048', 10),
      language: process.env.AGENT_LANGUAGE || 'zh'
    };
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  get(key: keyof AgentConfig): string | number {
    return this.config[key];
  }
}
