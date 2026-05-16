import path from 'path';
import fs from 'fs';
import { AgentConfig } from './types';

function findEnvPath(): string | null {
  const candidatePaths = [
    path.resolve(path.dirname(process.execPath), '.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }
  return null;
}

function loadEnvFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    const val = trimmed.substring(eqIndex + 1).trim();
    process.env[key] = val;
  }
}

const envPath = findEnvPath();
if (envPath) {
  loadEnvFile(envPath);
}

function buildDebugFlag(): boolean {
  const debugEnv = (process.env.DEBUG || '').toLowerCase();
  return debugEnv === 'true' || debugEnv === '1';
}

function buildConfig(): AgentConfig {
  return {
    apiKey: process.env.USER_API_KEY || '',
    baseURL: process.env.USER_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.USER_MODEL || 'gpt-3.5-turbo',
    temperature: parseFloat(process.env.USER_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.USER_MAX_TOKENS || '2048', 10),
    language: process.env.AGENT_LANGUAGE || 'zh'
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: AgentConfig;
  public isDebug: boolean;

  private constructor() {
    this.isDebug = buildDebugFlag();
    this.config = buildConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  reload(): void {
    const p = findEnvPath();
    if (p) {
      loadEnvFile(p);
    }
    this.isDebug = buildDebugFlag();
    this.config = buildConfig();
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  get(key: keyof AgentConfig): string | number {
    return this.config[key];
  }
}
