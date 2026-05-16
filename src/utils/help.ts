import { ToolManager } from '../tools/manager';

export class HelpManager {
  private static instance: HelpManager;
  private toolManager: ToolManager;

  private constructor() {
    this.toolManager = ToolManager.getInstance();
  }

  static getInstance(): HelpManager {
    if (!HelpManager.instance) {
      HelpManager.instance = new HelpManager();
    }
    return HelpManager.instance;
  }

  getHelp(): string {
    const commands = this.getCommandsHelp();
    const tools = this.getToolsHelp();
    const usage = this.getUsageHelp();

    return `
=========================================
           DV AI Agent 帮助信息          
=========================================

【命令】
${commands}

【内置工具】
${tools}

【使用示例】
${usage}

【提示】
- Agent 会根据您的任务描述自动规划执行步骤
- 任务会按计划顺序执行
- 执行结果会在完成后显示
`;
  }

  private getCommandsHelp(): string {
    return `  !help    - 显示帮助信息（当前命令）
  !exit    - 退出程序
  !mode    - 切换问答/Plan模式
  !qa      - 切换到问答模式
  !plan    - 切换到Plan-and-Execute模式
  !clear   - 清空对话记忆
  !reset   - 清空对话记忆（同!clear）
  !history - 查看对话记忆记录
  !mem     - 查看对话记忆记录（同!history）
  !tools   - 列出所有可用工具
  !help <工具名> - 查看工具详情`;
  }

  private getToolsHelp(): string {
    const tools = this.toolManager.getAllTools();
    let help = '';
    
    for (const tool of tools) {
      const params = this.formatParameters(tool.parameters);
      help += `\n  ${tool.name}`;
      help += `\n    描述: ${tool.description}`;
      if (params) {
        help += `\n    参数: ${params}`;
      }
      help += '\n';
    }
    
    return help;
  }

  private formatParameters(params: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }
    
    return Object.entries(params)
      .map(([key, value]: [string, any]) => {
        const required = value.required ? '(必需)' : '(可选)';
        const type = value.type || 'any';
        const desc = value.description || '';
        return `${key}: ${type} ${required} ${desc}`;
      })
      .join(', ');
  }

  private getUsageHelp(): string {
    return `  1. 简单任务:
     > 读取 test.txt 文件内容
     > 分析 data.csv 中的数据
     > 调用 API 获取天气信息

  2. 复杂任务:
     > 读取 test.txt，然后总结内容
     > 下载 Excel 文件并分析前10行数据

  3. 自定义任务:
     > 帮我完成 IC 验证相关的数据分析`;
  }

  getToolsList(): string {
    const tools = this.toolManager.getAllTools();
    let help = '\n【可用工具列表】\n\n';
    
    help += '  序号    工具名称              描述\n';
    help += '  ' + '-'.repeat(60) + '\n';
    
    tools.forEach((tool, index) => {
      const num = (index + 1).toString().padStart(3);
      const name = tool.name.padEnd(20);
      const desc = tool.description.substring(0, 30);
      help += `  ${num}    ${name}  ${desc}\n`;
    });
    
    help += '\n  输入 !help <工具名> 查看工具详情\n';
    
    return help;
  }

  getToolDetail(toolName: string): string {
    const tool = this.toolManager.getTool(toolName);
    
    if (!tool) {
      return `未找到工具: ${toolName}\n请使用 !tools 查看所有可用工具`;
    }
    
    const params = this.formatParameters(tool.parameters);
    
    return `
【工具详情】
  名称: ${tool.name}
  描述: ${tool.description}
  参数:
${params ? '    ' + params : '    无参数'}
`;
  }
}
