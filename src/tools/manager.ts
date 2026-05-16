import { Tool } from './base';

export class ToolManager {
  private static instance: ToolManager;
  private tools: Map<string, Tool> = new Map();

  private constructor() {}

  static getInstance(): ToolManager {
    if (!ToolManager.instance) {
      ToolManager.instance = new ToolManager();
    }
    return ToolManager.instance;
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolsDescription(): string {
    return this.getAllTools()
      .map(tool => `${tool.name}: ${tool.description}`)
      .join('\n');
  }

  async executeTool(name: string, args: Record<string, any>): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`工具 ${name} 不存在`);
    }
    return await tool.execute(args);
  }
}
