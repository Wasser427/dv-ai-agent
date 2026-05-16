import { LLMClient, Message } from './llm';
import { ToolManager } from '../tools/manager';
import { I18n } from '../i18n';
import { Memory } from './memory';
import { ConfigManager } from '../config';

export interface TaskStep {
  id: number;
  description: string;
  tool?: string;
  args?: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
}

export interface TaskPlan {
  steps: TaskStep[];
}

export type AgentMode = 'plan' | 'qa';

export class DVAgent {
  private llm: LLMClient;
  private toolManager: ToolManager;
  private i18n: I18n;
  private memory: Memory;
  private debug: boolean;
  private mode: AgentMode = 'plan';

  constructor() {
    this.llm = LLMClient.getInstance();
    this.toolManager = ToolManager.getInstance();
    this.i18n = I18n.getInstance();
    this.memory = Memory.getInstance();
    this.debug = ConfigManager.getInstance().isDebug;
  }

  getMode(): AgentMode {
    return this.mode;
  }

  setMode(mode: AgentMode): void {
    this.mode = mode;
    const modeName = mode === 'plan'
      ? this.i18n.t('modePlan')
      : this.i18n.t('modeQA');
    console.log(`\n${this.i18n.format('modeSwitch', modeName)}\n`);
  }

  toggleMode(): void {
    if (this.mode === 'plan') {
      this.setMode('qa');
    } else {
      this.setMode('plan');
    }
  }

  reloadDebug(): void {
    this.debug = ConfigManager.getInstance().isDebug;
  }

  private cleanJSONResponse(response: string): string {
    let cleaned = response.trim();

    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');

    cleaned = cleaned.replace(/^\s+/, '');
    cleaned = cleaned.replace(/\s+$/, '');

    return cleaned;
  }

  private extractJSON(text: string): string | null {
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');

    if (firstBrace === -1 && firstBracket === -1) {
      return null;
    }

    if (firstBrace !== -1 && firstBracket !== -1) {
      const start = Math.min(firstBrace, firstBracket);
      return text.substring(start);
    }

    if (firstBrace !== -1) {
      return text.substring(firstBrace);
    }

    return text.substring(firstBracket);
  }

  private parseJSON(text: string): any {
    const cleaned = this.cleanJSONResponse(text);
    const jsonStr = this.extractJSON(cleaned);

    if (!jsonStr) {
      throw new Error(this.i18n.t('parseErrorNoJSON'));
    }

    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      let tryCleaned = jsonStr;

      tryCleaned = tryCleaned.replace(/,\s*([\]}])/g, '$1');

      tryCleaned = tryCleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

      try {
        return JSON.parse(tryCleaned);
      } catch (e) {
        throw new Error(this.i18n.t('parseErrorJSON') + ' ' + (error as Error).message);
      }
    }
  }

  private resolveStepReferences(args: Record<string, any>, previousResults: Map<number, any>): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        let resolvedValue = value;

        const patterns = [
          /\$\{step\.(\d+)(?:\.([^}]+))?\}/g,
          /\{step\.(\d+)(?:\.([^}]+))?\}/g
        ];

        for (const pattern of patterns) {
          const match = resolvedValue.match(pattern);
          if (match) {
            const stepId = parseInt(match[0].match(/step\.(\d+)/)![1]);
            const propMatch = match[0].match(/step\.\d+(?:\.([^}]+))?/);
            const prop = propMatch && propMatch[1] ? propMatch[1] : null;
            const prevResult = previousResults.get(stepId);

            if (prevResult) {
              if (prop && prevResult[prop] !== undefined) {
                resolvedValue = prevResult[prop];
              } else if (typeof prevResult === 'string') {
                resolvedValue = prevResult;
              } else if (prevResult.content !== undefined) {
                resolvedValue = prevResult.content;
              } else if (prevResult.result && prevResult.result.content !== undefined) {
                resolvedValue = prevResult.result.content;
              } else {
                resolvedValue = value;
              }
            } else {
              resolvedValue = value;
            }
            break;
          }
        }

        resolved[key] = resolvedValue;
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  async ask(query: string): Promise<any> {
    console.log(this.i18n.t('qaGettingAnswer') + '\n');

    const historyMessages = this.memory.getMessages();

    const messages: Message[] = [];

    if (historyMessages.length > 0) {
      messages.push(...historyMessages);
    }

    messages.push({ role: 'user', content: query });

    const response = await this.llm.chat(messages);

    if (this.debug) {
      console.log(`\n========== [${this.i18n.t('llmAnswer')}] ==========\n`);
      console.log(response);
      console.log(`\n${'='.repeat(41)}\n`);
    }

    return [{
      step: 1,
      description: '直接回答',
      status: 'completed',
      result: {
        success: true,
        content: response,
        type: 'direct_answer'
      }
    }];
  }

  async plan(userQuery: string): Promise<TaskPlan> {
    console.log(this.i18n.t('planning'));

    const tools = this.toolManager.getAllTools();
    let toolsDesc = '可用工具及其参数格式：\n\n';

    for (const tool of tools) {
      const params = Object.entries(tool.parameters)
        .map(([key, val]: [string, any]) => {
          return `      - ${key}: ${val.type} ${val.required ? '(必需)' : '(可选)'} ${val.description}`;
        })
        .join('\n');

      toolsDesc += `${tool.name}\n${tool.description}\n参数:\n${params}\n\n`;
    }

    const lang = this.i18n.getCurrentLang();
    const fileAnalysisHint = lang === 'zh'
      ? '对于Excel或CSV文件分析任务，应使用 excel_to_md 或 csv_to_md 工具先转换为Markdown格式，再用 analyze 工具分析。'
      : 'For Excel or CSV file analysis tasks, use excel_to_md or csv_to_md tools to convert to Markdown format first, then use the analyze tool.';

    const systemPrompt = `你是一个专业的 AI 助手，专门帮助用户完成 IC 验证相关的任务。请根据用户的查询，规划执行步骤。

${toolsDesc}

请严格按以下 JSON 格式返回计划（不要有任何其他内容）：
{
  "steps": [
    {
      "id": 1,
      "description": "步骤的详细描述",
      "tool": "使用的工具名称",
      "args": {
        "参数名": "参数值"
      }
    }
  ]
}

【关键规则 - 步骤间数据传递】
如果某个步骤需要使用前一个步骤生成的内容，请使用占位符引用，语法为：{step.N.field}
- {step.1.content} 表示引用步骤1的结果中的content字段
- {step.2.result.content} 表示引用步骤2的结果中的content字段

例如：
- 步骤2需要读取步骤1的文件内容: "filePath": "{step.1.result.filePath}"
- 步骤4需要使用步骤3生成的内容: "content": "{step.3.result.content}"

【${fileAnalysisHint}】

【重要规则】
1. 如果步骤需要使用工具，args 字段必须包含该工具的所有必需参数
2. 可以使用 {step.N.field} 引用前序步骤的结果
3. 只返回纯 JSON，不要包含任何其他文字
4. Windows 路径使用反斜杠，如 D:\\Download\\file.docx
5. 占位符必须使用 {step.N.field} 格式，不要使用 $ 符号`;

    const historyMessages = this.memory.getMessages();
    const messages: Message[] = [
      { role: 'system', content: systemPrompt }
    ];

    messages.push(...historyMessages);

    messages.push({ role: 'user', content: userQuery });

    const response = await this.llm.chat(messages);

    if (this.debug) {
      console.log(`\n========== [${this.i18n.t('debugLLMResponse')}] ==========`);
      console.log(response.substring(0, 500) + (response.length > 500 ? '...' : ''));
      console.log('====================================\n');
    }

    try {
      const plan = this.parseJSON(response) as TaskPlan;

      if (!plan.steps || !Array.isArray(plan.steps)) {
        throw new Error(this.i18n.t('formatError'));
      }

      let validSteps: TaskStep[] = [];
      const seenDescriptions = new Set<string>();

      for (const step of plan.steps) {
        if (seenDescriptions.has(step.description)) {
          continue;
        }
        seenDescriptions.add(step.description);

        validSteps.push({
          id: step.id || (validSteps.length + 1),
          description: step.description || '',
          tool: step.tool,
          args: step.args || {},
          status: 'pending' as const
        });
      }

      plan.steps = validSteps;
      return plan;
    } catch (error) {
      if (this.debug) console.error(this.i18n.t('debugJSONError'), error);
      throw new Error(this.i18n.t('planGenerationFailed') + ' ' + (error as Error).message);
    }
  }

  async execute(plan: TaskPlan): Promise<TaskPlan> {
    console.log(this.i18n.t('executing'));

    const previousResults = new Map<number, any>();

    for (const step of plan.steps) {
      step.status = 'executing';

      try {
        if (step.tool) {
          console.log(`\n${this.i18n.format('stepUsingTool', step.id, step.tool)}`);

          const resolvedArgs = this.resolveStepReferences(step.args || {}, previousResults);
          if (this.debug) {
            console.log(`${this.i18n.t('stepParams')} ${JSON.stringify(resolvedArgs)}`);
          }

          const result = await this.toolManager.executeTool(step.tool, resolvedArgs);
          step.result = result;
          previousResults.set(step.id, result);
        } else {
          if (this.debug) {
            console.log(`\n[${this.i18n.t('stepLabel')} ${step.id}] ${step.description}`);
          }
          step.result = { message: this.i18n.t('stepDone') };
          previousResults.set(step.id, step.result);
        }
        step.status = 'completed';
      } catch (error) {
        step.status = 'failed';
        step.result = (error as Error).message;
        console.error(`${this.i18n.format('stepError', step.id)}`, error);
      }
    }

    return plan;
  }

  async run(userQuery: string): Promise<any> {
    if (this.mode === 'qa') {
      return await this.ask(userQuery);
    }

    const plan = await this.plan(userQuery);
    console.log(`\n========== [${this.i18n.t('planBox')}] ==========`);
    plan.steps.forEach(s => {
      console.log(`  ${s.id}. ${s.description}`);
      if (s.tool) {
        console.log(`     ${this.i18n.t('toolLabel')} ${s.tool}`);
      }
    });
    console.log('============================\n');

    const executedPlan = await this.execute(plan);

    const results = executedPlan.steps.map(s => ({
      step: s.id,
      description: s.description,
      status: s.status,
      result: s.result
    }));

    console.log('\n' + this.i18n.t('taskComplete'));
    return results;
  }
}
