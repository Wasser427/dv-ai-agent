import { LLMClient, Message } from './llm';
import { ToolManager } from '../tools/manager';
import { I18n } from '../i18n';
import { Memory } from './memory';
import { ConfigManager } from '../config';
import { MasterAgent, TaskResult } from './multi-agent';

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

export type AgentMode = 'plan' | 'qa' | 'multi';

export class DVAgent {
  private llm: LLMClient;
  private toolManager: ToolManager;
  private i18n: I18n;
  private memory: Memory;
  private debug: boolean;
  private mode: AgentMode = 'multi';
  private masterAgent: MasterAgent | null = null;

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
    let modeName: string;
    switch (mode) {
      case 'plan':
        modeName = this.i18n.t('modePlan');
        this.masterAgent = null;
        break;
      case 'qa':
        modeName = this.i18n.t('modeQA');
        this.masterAgent = null;
        break;
      case 'multi':
        modeName = this.i18n.t('modeMulti') || 'Multi-Agent';
        this.masterAgent = new MasterAgent({ enableMultiAgent: true, maxParallelWorkers: 5 });
        break;
      default:
        modeName = this.i18n.t('modePlan');
        this.masterAgent = null;
    }
    console.log(`\n${this.i18n.format('modeSwitch', modeName)}\n`);
  }

  toggleMode(): void {
    if (this.mode === 'plan') {
      this.setMode('qa');
    } else if (this.mode === 'qa') {
      this.setMode('multi');
    } else {
      this.setMode('plan');
    }
  }

  reloadDebug(): void {
    this.debug = ConfigManager.getInstance().isDebug;
  }

  private isMarkdownTool(toolName: string): boolean {
    const mdTools = ['file_to_md', 'excel_to_md', 'csv_to_md', 'md_to_md', 'docx_to_md', 'pptx_to_md', 'pdf_to_md'];
    return mdTools.includes(toolName);
  }

  private async analyzeMarkdownContent(content: string, task: string): Promise<string> {
    const systemPrompt = `你是一个专业的文档分析助手，负责根据用户需求分析文档内容。

【用户分析需求】
${task}

【文档内容】
${content}

请直接返回分析结果，不要包含任何解释或额外文字。如果文档内容与分析需求无关，请明确说明。`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: '请按照用户需求分析上述文档内容。' }
    ];

    try {
      const result = await this.llm.chat(messages);
      return result;
    } catch (error: any) {
      throw new Error(`文档分析失败: ${error.message}`);
    }
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
              if (typeof prevResult === 'string') {
                resolvedValue = prevResult;
              } else if (prevResult.content !== undefined) {
                resolvedValue = prevResult.content;
              } else if (prevResult.result && prevResult.result.content !== undefined) {
                resolvedValue = prevResult.result.content;
              } else if (prop && prevResult[prop] !== undefined) {
                resolvedValue = prevResult[prop];
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
          
          // 如果是 xxx_to_md 工具，自动分析 Markdown 内容
          if (this.isMarkdownTool(step.tool)) {
            // 检查是否有多个 sheet 需要分别分析
            if (result.sheetResults && Array.isArray(result.sheetResults) && result.sheetResults.length > 0) {
              if (this.debug) {
                console.log(`[分析] 检测到多 Sheet Excel 文件，共 ${result.sheetResults.length} 个工作表`);
              }
              
              const analysisResults: any[] = [];
              
              for (const sheet of result.sheetResults) {
                if (sheet.content && typeof sheet.content === 'string' && sheet.content.trim()) {
                  if (this.debug) {
                    console.log(`[分析] 正在分析工作表: ${sheet.sheetName}...`);
                  }
                  
                  const sheetAnalysis = await this.analyzeMarkdownContent(sheet.content, step.description);
                  analysisResults.push({
                    sheetName: sheet.sheetName,
                    rowCount: sheet.rowCount,
                    content: sheet.content,
                    analysis: sheetAnalysis
                  });
                } else {
                  analysisResults.push({
                    sheetName: sheet.sheetName,
                    rowCount: sheet.rowCount,
                    content: sheet.content || ''
                  });
                }
              }
              
              step.result = {
                success: true,
                tool: step.tool,
                totalSheets: result.totalSheets,
                sheetsAnalyzed: analysisResults.length,
                sheetResults: analysisResults,
                analysis: analysisResults.map(r => `## ${r.sheetName}\n\n${r.analysis || r.content}`).join('\n\n'),
                content: analysisResults.map(r => `## ${r.sheetName}\n\n${r.analysis || r.content}`).join('\n\n')
              };
            } else {
              // 单个内容（CSV 或其他单 sheet 文件）
              const mdContent = result.markdown || result.content || result;
              
              if (mdContent && typeof mdContent === 'string' && mdContent.trim()) {
                if (this.debug) {
                  console.log(`[分析] 检测到 Markdown 工具，正在分析内容...`);
                }
                
                const analysisResult = await this.analyzeMarkdownContent(mdContent, step.description);
                
                step.result = {
                  success: true,
                  tool: step.tool,
                  originalContent: mdContent,
                  analysis: analysisResult,
                  content: analysisResult
                };
              } else {
                step.result = {
                  success: true,
                  tool: step.tool,
                  content: mdContent
                };
              }
            }
          } else {
            step.result = result;
          }
          
          previousResults.set(step.id, step.result);
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

    if (this.mode === 'multi') {
      if (!this.masterAgent) {
        this.masterAgent = new MasterAgent({ enableMultiAgent: true, maxParallelWorkers: 5 });
      }

      const multiResult: TaskResult = await this.masterAgent.run(userQuery);

      const results = multiResult.subTasks.map(s => ({
        step: s.id,
        description: s.description,
        status: s.status,
        result: s.result
      }));

      console.log('\n' + this.i18n.t('taskComplete'));
      return results;
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
