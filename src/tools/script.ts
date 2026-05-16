import { BaseTool } from './base';
import { spawn } from 'child_process';
import path from 'path';

interface ScriptConfig {
  name: string;
  description: string;
  command: string;
  args?: string[];
  workingDir?: string;
}

export class ScriptTool extends BaseTool {
  name: string;
  description: string;
  parameters = {
    scriptArgs: { type: 'array', description: '脚本参数', required: false }
  };
  
  private config: ScriptConfig;

  constructor(config: ScriptConfig) {
    super();
    this.name = config.name;
    this.description = config.description;
    this.config = config;
  }

  async execute(args: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const scriptArgs = args.scriptArgs || this.config.args || [];
      const workingDir = this.config.workingDir || process.cwd();
      
      const child = spawn(this.config.command, scriptArgs, {
        cwd: workingDir,
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          reject(new Error(`脚本执行失败: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }
}

export class ScriptRegistry {
  private static scripts: Map<string, ScriptConfig> = new Map();

  static register(config: ScriptConfig): void {
    this.scripts.set(config.name, config);
  }

  static get(name: string): ScriptConfig | undefined {
    return this.scripts.get(name);
  }

  static getAll(): ScriptConfig[] {
    return Array.from(this.scripts.values());
  }

  static createTool(name: string): ScriptTool | undefined {
    const config = this.get(name);
    if (config) {
      return new ScriptTool(config);
    }
    return undefined;
  }
}
