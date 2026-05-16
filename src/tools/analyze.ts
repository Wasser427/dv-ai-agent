import { BaseTool } from './base';
import { LLMClient, Message } from '../core/llm';

export class AnalyzeTool extends BaseTool {
  name = 'analyze';
  description = '使用 LLM 分析文本内容并生成结果（用于生成测试点分解等）';
  parameters = {
    task: { type: 'string', description: '分析任务描述', required: true },
    content: { type: 'string', description: '需要分析的文本内容', required: true }
  };

  private llm: LLMClient;

  constructor() {
    super();
    this.llm = LLMClient.getInstance();
  }

  async execute(args: Record<string, any>): Promise<any> {
    const { task, content } = args;

    const systemPrompt = `你是一个专业的 IC 验证工程师，擅长分析文档内容并生成测试点分解。

请根据给定的分析任务和内容，生成专业的分析结果。

分析任务：${task}

内容：
${content}

请直接返回分析结果，不要包含任何解释或额外文字。`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请按照任务要求分析上述内容并返回结果。' }
    ];

    try {
      const result = await this.llm.chat(messages);
      return {
        success: true,
        task,
        content: result
      };
    } catch (error: any) {
      throw new Error(`分析失败: ${error.message}`);
    }
  }
}
