import { LLMClient, Message } from './llm';
import { ToolManager } from '../tools/manager';
import { I18n } from '../i18n';
import { Memory } from './memory';
import { ConfigManager } from '../config';

export interface SubTask {
  id: string;
  description: string;
  tool?: string;
  args?: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  workerId?: string;
}

export interface TaskResult {
  success: boolean;
  subTasks: SubTask[];
  aggregatedResult?: any;
  executionTime: number;
  totalTasks?: number;
  completedTasks?: number;
  failedTasks?: number;
  errorMessage?: string;
}

export class WorkerAgent {
  readonly id: string;
  private llm: LLMClient;
  private toolManager: ToolManager;
  private i18n: I18n;
  private debug: boolean;

  constructor(workerId: string) {
    this.id = workerId;
    this.llm = LLMClient.getInstance();
    this.toolManager = ToolManager.getInstance();
    this.i18n = I18n.getInstance();
    this.debug = ConfigManager.getInstance().isDebug;
  }

  private resolveStepReferences(args: Record<string, any>, previousResults: Map<string, any>): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        let resolvedValue = value;

        const patterns = [
          /\$\{step\.([^\.]+)(?:\.([^}]+))?\}/g,
          /\{step\.([^\.]+)(?:\.([^}]+))?\}/g
        ];

        for (const pattern of patterns) {
          resolvedValue = resolvedValue.replace(pattern, (match: string, ref: string, prop: string | undefined) => {
            const prevResult = previousResults.get(ref);

            if (prevResult !== undefined) {
              if (prop) {
                if (prevResult[prop] !== undefined) {
                  return String(prevResult[prop]);
                }
                if (prevResult.result && prevResult.result[prop] !== undefined) {
                  return String(prevResult.result[prop]);
                }
              }

              if (typeof prevResult === 'string') {
                return prevResult;
              } else if (prevResult.content !== undefined) {
                return String(prevResult.content);
              } else if (prevResult.result && prevResult.result.content !== undefined) {
                return String(prevResult.result.content);
              } else if (prevResult.result && prevResult.result.message !== undefined) {
                return String(prevResult.result.message);
              } else if (prevResult.result && prevResult.result.markdown !== undefined) {
                return String(prevResult.result.markdown);
              } else if (prevResult.result !== undefined) {
                if (typeof prevResult.result === 'object' && prevResult.result !== null) {
                  return JSON.stringify(prevResult.result);
                }
                return String(prevResult.result);
              } else {
                return JSON.stringify(prevResult);
              }
            }

            return match;
          });
        }

        resolved[key] = resolvedValue;
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
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

  async executeSubTask(subTask: SubTask, sharedResults: Map<string, any>): Promise<SubTask> {
    subTask.status = 'executing';
    subTask.workerId = this.id;

    if (this.debug) {
      console.log(`\n[Worker ${this.id}] 执行子任务: ${subTask.description}`);
    }

    try {
      if (subTask.tool) {
        const resolvedArgs = this.resolveStepReferences(subTask.args || {}, sharedResults);

        if (this.debug) {
          console.log(`[Worker ${this.id}] 使用工具: ${subTask.tool}`);
          console.log(`[Worker ${this.id}] 参数: ${JSON.stringify(resolvedArgs)}`);
        }

        const result = await this.toolManager.executeTool(subTask.tool, resolvedArgs);
        
        if (this.isMarkdownTool(subTask.tool)) {
          // 检查是否有多个 sheet 需要分别分析
          if (result.sheetResults && Array.isArray(result.sheetResults) && result.sheetResults.length > 0) {
            if (this.debug) {
              console.log(`[Worker ${this.id}] 检测到多 Sheet Excel 文件，共 ${result.sheetResults.length} 个工作表`);
            }
            
            const analysisResults: any[] = [];
            
            for (const sheet of result.sheetResults) {
              if (sheet.content && typeof sheet.content === 'string' && sheet.content.trim()) {
                if (this.debug) {
                  console.log(`[Worker ${this.id}] 正在分析工作表: ${sheet.sheetName}...`);
                }
                
                const sheetAnalysis = await this.analyzeMarkdownContent(sheet.content, subTask.description);
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
            
            subTask.result = {
              success: true,
              tool: subTask.tool,
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
                console.log(`[Worker ${this.id}] 检测到 Markdown 工具，正在分析内容...`);
              }
              
              const analysisResult = await this.analyzeMarkdownContent(mdContent, subTask.description);
              
              subTask.result = {
                success: true,
                tool: subTask.tool,
                originalContent: mdContent,
                analysis: analysisResult,
                content: analysisResult
              };
            } else {
              subTask.result = {
                success: true,
                tool: subTask.tool,
                content: mdContent
              };
            }
          }
        } else {
          subTask.result = result;
        }
        
        sharedResults.set(subTask.id, subTask.result);
      } else {
        subTask.result = { message: this.i18n.t('stepDone') };
        sharedResults.set(subTask.id, subTask.result);
      }

      subTask.status = 'completed';

      if (this.debug) {
        console.log(`[Worker ${this.id}] 子任务完成: ${subTask.id}`);
      }
    } catch (error) {
      subTask.status = 'failed';
      subTask.result = (error as Error).message;

      if (this.debug) {
        console.error(`[Worker ${this.id}] 子任务失败: ${subTask.id}`, error);
      }
    }

    return subTask;
  }
}

export interface MasterAgentConfig {
  maxParallelWorkers?: number;
  enableMultiAgent?: boolean;
}

export class MasterAgent {
  private llm: LLMClient;
  private toolManager: ToolManager;
  private i18n: I18n;
  private memory: Memory;
  private debug: boolean;
  private globalState: Map<string, any>;
  private workerPool: Map<string, WorkerAgent>;
  private config: MasterAgentConfig;

  constructor(config: MasterAgentConfig = {}) {
    this.llm = LLMClient.getInstance();
    this.toolManager = ToolManager.getInstance();
    this.i18n = I18n.getInstance();
    this.memory = Memory.getInstance();
    this.debug = ConfigManager.getInstance().isDebug;
    this.globalState = new Map();
    this.workerPool = new Map();
    this.config = {
      maxParallelWorkers: config.maxParallelWorkers || 5,
      enableMultiAgent: config.enableMultiAgent !== false
    };
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

  private getWorker(): WorkerAgent {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const worker = new WorkerAgent(workerId);
    this.workerPool.set(workerId, worker);
    return worker;
  }

  private releaseWorker(workerId: string): void {
    this.workerPool.delete(workerId);
  }

  private destroyAllWorkers(): void {
    this.workerPool.clear();
  }

  setGlobalState(key: string, value: any): void {
    this.globalState.set(key, value);
  }

  getGlobalState(key: string): any {
    return this.globalState.get(key);
  }

  clearGlobalState(): void {
    this.globalState.clear();
  }

  async decomposeTask(userQuery: string): Promise<SubTask[]> {
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

    const systemPrompt = `你是一个专业的 AI 任务规划专家，负责将复杂任务分解为可并行执行的子任务。

请分析用户查询，将任务分解为多个独立的子任务，这些子任务可以并行执行以提高效率。

${toolsDesc}

请严格按以下 JSON 格式返回子任务规划：
{
  "subTasks": [
    {
      "id": "task_1",
      "description": "子任务的详细描述",
      "tool": "使用的工具名称（如果有）",
      "args": {
        "参数名": "参数值"
      }
    }
  ]
}

【关键规则】
1. 如果子任务需要使用前一个子任务生成的内容，使用 {step.task_N.field} 引用
2. 可以并行的任务应该分配不同的 task id
3. 每个子任务应该是独立的，可以由不同的工作者并行执行
4. 只返回纯 JSON，不要包含任何其他文字`;

    const historyMessages = this.memory.getMessages();
    const messages: Message[] = [
      { role: 'system', content: systemPrompt }
    ];

    messages.push(...historyMessages);
    messages.push({ role: 'user', content: userQuery });

    const response = await this.llm.chat(messages);

    if (this.debug) {
      console.log(`\n========== [任务分解] ==========`);
      console.log(response.substring(0, 500) + (response.length > 500 ? '...' : ''));
      console.log('================================\n');
    }

    try {
      const plan = this.parseJSON(response);

      if (!plan.subTasks || !Array.isArray(plan.subTasks)) {
        throw new Error('无效的任务分解格式');
      }

      return plan.subTasks.map((task: any, index: number) => ({
        id: task.id || `task_${index + 1}`,
        description: task.description || '',
        tool: task.tool,
        args: task.args || {},
        status: 'pending' as const
      }));
    } catch (error) {
      if (this.debug) console.error('任务分解失败:', error);
      throw new Error('任务分解失败: ' + (error as Error).message);
    }
  }

  private resolveCrossTaskReferences(args: Record<string, any>, results: Map<string, any>): Record<string, any> {
    const resolved: Record<string, any> = {};

    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        let resolvedValue = value;

        const patterns = [
          /\$\{step\.([^\.]+)(?:\.([^}]+))?\}/g,
          /\{step\.([^\.]+)(?:\.([^}]+))?\}/g
        ];

        for (const pattern of patterns) {
          // 使用 replace 方法替换所有匹配的引用
          resolvedValue = resolvedValue.replace(pattern, (match: string, stepId: string, prop: string | undefined) => {
            const prevResult = results.get(stepId);

            if (prevResult !== undefined) {
              // 如果指定了属性
              if (prop) {
                if (prevResult[prop] !== undefined) {
                  return String(prevResult[prop]);
                }
                // 尝试在 result 对象中查找
                if (prevResult.result && prevResult.result[prop] !== undefined) {
                  return String(prevResult.result[prop]);
                }
              }

              // 默认提取内容
              if (typeof prevResult === 'string') {
                return prevResult;
              } else if (prevResult.content !== undefined) {
                return String(prevResult.content);
              } else if (prevResult.result && prevResult.result.content !== undefined) {
                return String(prevResult.result.content);
              } else if (prevResult.result && prevResult.result.message !== undefined) {
                return String(prevResult.result.message);
              } else if (prevResult.result && prevResult.result.markdown !== undefined) {
                return String(prevResult.result.markdown);
              } else if (prevResult.result !== undefined) {
                if (typeof prevResult.result === 'object' && prevResult.result !== null) {
                  return JSON.stringify(prevResult.result);
                }
                return String(prevResult.result);
              } else {
                return JSON.stringify(prevResult);
              }
            }

            // 如果 prevResult 未定义，保留原始引用
            return match;
          });
        }

        resolved[key] = resolvedValue;
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  async executeSubTasksParallel(subTasks: SubTask[]): Promise<SubTask[]> {
    const sharedResults = new Map<string, any>();
    const completedTasks: SubTask[] = [];
    let pendingTasks = [...subTasks];

    if (this.debug) {
      console.log(`\n========== [并行执行模式] ==========`);
      console.log(`总子任务数: ${subTasks.length}`);
      console.log(`最大并行工作者数: ${this.config.maxParallelWorkers}`);
      console.log('===================================\n');
    }

    const executeTask = async (subTask: SubTask): Promise<SubTask> => {
      const worker = this.getWorker();

      try {
        let resolvedArgs = this.resolveCrossTaskReferences(subTask.args || {}, sharedResults);
        
        // 检查是否有未解析的引用
        const hasUnresolvedRef = Object.values(resolvedArgs).some(v => 
          typeof v === 'string' && (v.includes('{step.') || v.includes('${step.'))
        );
        
        if (hasUnresolvedRef) {
          // 等待一下再尝试解析
          await new Promise(resolve => setTimeout(resolve, 100));
          resolvedArgs = this.resolveCrossTaskReferences(subTask.args || {}, sharedResults);
        }
        
        subTask.args = resolvedArgs;

        const result = await worker.executeSubTask(subTask, sharedResults);

        // 工具执行结果存储在 subTask.result 中
        const toolResult = result.result;
        if (toolResult) {
          sharedResults.set(subTask.id, toolResult);
          // 同时用数字ID字符串存储，支持 {step.N.content} 格式引用
          const numId = parseInt(subTask.id.replace(/\D/g, ''));
          if (!isNaN(numId)) {
            sharedResults.set(numId.toString(), toolResult);
          }
        }

        return result;
      } finally {
        this.releaseWorker(worker.id);
      }
    };

    let retryCount = 0;
    const maxRetries = 3;
    
    while (pendingTasks.length > 0 && retryCount < maxRetries) {
      const batch = pendingTasks.splice(0, this.config.maxParallelWorkers!);
      const batchPromises = batch.map(task => executeTask(task));
      const batchResults = await Promise.all(batchPromises);
      
      // 分离成功完成的任务和需要重试的任务
      const successfulTasks = batchResults.filter(t => {
        if (t.status === 'completed' && t.args) {
          const argsStr = JSON.stringify(t.args);
          return !argsStr.includes('{step.') && !argsStr.includes('${step.');
        }
        return t.status === 'completed' || t.status === 'failed';
      });
      
      const needRetryTasks = batchResults.filter(t => {
        if (t.status === 'completed' && t.args) {
          const argsStr = JSON.stringify(t.args);
          return argsStr.includes('{step.') || argsStr.includes('${step.');
        }
        return false;
      });
      
      completedTasks.push(...successfulTasks);
      
      // 如果还有未完成的依赖任务，将需要重试的任务放回队列
      if (needRetryTasks.length > 0) {
        pendingTasks = [...needRetryTasks, ...pendingTasks];
        retryCount++;
        
        if (this.debug) {
          console.log(`\n[重试] 第 ${retryCount} 次，${needRetryTasks.length} 个任务需要重试`);
        }
      } else {
        retryCount = 0; // 重置重试计数
      }

      if (this.debug) {
        const completed = completedTasks.filter(t => t.status === 'completed').length;
        const failed = completedTasks.filter(t => t.status === 'failed').length;
        console.log(`\n[进度] 已完成: ${completed}, 失败: ${failed}, 剩余: ${pendingTasks.length}`);
      }
    }

    // 最后将剩余的任务也加入完成列表
    if (pendingTasks.length > 0) {
      completedTasks.push(...pendingTasks);
    }

    return completedTasks;
  }

  async aggregateResults(subTasks: SubTask[]): Promise<TaskResult> {
    const aggregated: any = {
      success: true,
      subTasks: subTasks,
      totalTasks: subTasks.length,
      completedTasks: subTasks.filter(t => t.status === 'completed').length,
      failedTasks: subTasks.filter(t => t.status === 'failed').length,
      results: [] as any[]
    };

    for (const task of subTasks) {
      aggregated.results.push({
        id: task.id,
        description: task.description,
        status: task.status,
        result: task.result
      });

      if (task.status === 'completed' && task.result) {
        this.setGlobalState(`result_${task.id}`, task.result);
      }
    }

    if (aggregated.failedTasks > 0) {
      aggregated.success = false;
      aggregated.errorMessage = `${aggregated.failedTasks} 个子任务失败`;
    } else {
      aggregated.success = true;
    }

    return aggregated as TaskResult;
  }

  async run(userQuery: string): Promise<TaskResult> {
    const startTime = Date.now();

    if (this.debug) {
      console.log(`\n========== [Master Agent 启动] ==========`);
      console.log(`多Agent模式: ${this.config.enableMultiAgent ? '启用' : '禁用'}`);
      console.log('==========================================\n');
    }

    try {
      const subTasks = await this.decomposeTask(userQuery);

      console.log(`\n========== [任务分解结果] ==========`);
      subTasks.forEach((task, index) => {
        console.log(`  ${index + 1}. [${task.id}] ${task.description}`);
        if (task.tool) {
          console.log(`     工具: ${task.tool}`);
        }
      });
      console.log('======================================\n');

      const executedTasks = await this.executeSubTasksParallel(subTasks);

      const aggregated = await this.aggregateResults(executedTasks);

      aggregated.executionTime = Date.now() - startTime;

      console.log(`\n========== [执行完成] ==========`);
      console.log(`总任务数: ${aggregated.totalTasks}`);
      console.log(`成功: ${aggregated.completedTasks}`);
      console.log(`失败: ${aggregated.failedTasks}`);
      console.log(`耗时: ${aggregated.executionTime}ms`);
      console.log('==============================\n');

      return aggregated;
    } finally {
      this.destroyAllWorkers();
    }
  }
}

export { MasterAgent as default };
