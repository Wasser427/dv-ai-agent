import { DVAgent } from './core/agent';
import { ToolManager } from './tools/manager';
import { 
  FileReadTool, 
  FileWriteTool, 
  ExcelReadTool, 
  DocxReadTool, 
  CsvReadTool,
  ApiGetTool,
  ApiPostTool,
  AnalyzeTool,
  ExcelToMarkdownTool,
  CsvToMarkdownTool
} from './tools';
import { I18n } from './i18n';
import { HelpManager } from './utils/help';
import { Memory } from './core/memory';
import readline from 'readline';

console.log('=========================================');
console.log('        DV AI Agent - IC 验证助手        ');
console.log('=========================================\n');

const i18n = I18n.getInstance();
const helpManager = HelpManager.getInstance();
const memory = Memory.getInstance();

const toolManager = ToolManager.getInstance();
toolManager.registerTool(new FileReadTool());
toolManager.registerTool(new FileWriteTool());
toolManager.registerTool(new ExcelReadTool());
toolManager.registerTool(new DocxReadTool());
toolManager.registerTool(new CsvReadTool());
toolManager.registerTool(new ApiGetTool());
toolManager.registerTool(new ApiPostTool());
toolManager.registerTool(new AnalyzeTool());
toolManager.registerTool(new ExcelToMarkdownTool());
toolManager.registerTool(new CsvToMarkdownTool());

console.log(i18n.t('welcome') + '\n');

const agent = new DVAgent();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

function printResultSummary(results: any[]): void {
  console.log('\n========== [执行结果摘要] ==========\n');

  for (const r of results) {
    if (r.result && r.result.type === 'direct_answer') {
      console.log('\x1b[36m' + r.result.content + '\x1b[0m');
      console.log();
      continue;
    }

    const statusIcon = r.status === 'completed' ? '✓' : '✗';
    const statusColor = r.status === 'completed' ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(`${statusColor}${statusIcon} 步骤 ${r.step}: ${r.description}${reset}`);

    if (r.status === 'completed') {
      if (r.result && r.result.success !== undefined) {
        console.log(`   结果: ${r.result.success ? '成功' : '失败'}`);
        if (r.result.message) console.log(`   消息: ${r.result.message}`);
        if (r.result.filePath) console.log(`   文件: ${r.result.filePath}`);
        if (r.result.rowCount) console.log(`   行数: ${r.result.rowCount}`);
      } else if (r.result && r.result.message) {
        console.log(`   ${r.result.message}`);
      }
    } else {
      console.log(`   错误: ${r.result}`);
    }
    console.log();
  }

  const completedCount = results.filter(r => r.status === 'completed').length;
  console.log(`已完成: ${completedCount}/${results.length} 个步骤`);
  console.log('\n==========================================\n');
}

async function handleCommand(input: string): Promise<boolean> {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === '!exit') {
    console.log('\n感谢使用 DV AI Agent，再见！\n');
    rl.close();
    process.exit(0);
  }

  if (trimmed === '!mode') {
    agent.toggleMode();
    return true;
  }

  if (trimmed === '!plan') {
    agent.setMode('plan');
    return true;
  }

  if (trimmed === '!qa') {
    agent.setMode('qa');
    return true;
  }

  if (trimmed === '!clear' || trimmed === '!reset') {
    memory.clear();
    return true;
  }

  if (trimmed === '!history' || trimmed === '!mem') {
    const history = memory.getHistory();
    if (history.length === 0) {
      console.log('\n当前没有记忆记录\n');
    } else {
      console.log(`\n========== [记忆记录] (${history.length} 条) ==========\n`);
      history.forEach((entry, i) => {
        const role = entry.role === 'user' ? '用户' : '助手';
        const time = new Date(entry.timestamp).toLocaleTimeString();
        console.log(`[${time}] ${role}: ${entry.content.substring(0, 100)}${entry.content.length > 100 ? '...' : ''}`);
      });
      console.log('\n==========================================\n');
    }
    return true;
  }

  if (trimmed === '!help' || trimmed === 'help') {
    console.log(helpManager.getHelp());
    return true;
  }

  if (trimmed === '!tools' || trimmed === 'tools') {
    console.log(helpManager.getToolsList());
    return true;
  }

  if (trimmed.startsWith('!help ')) {
    const toolName = input.trim().substring(6).trim();
    console.log(helpManager.getToolDetail(toolName));
    return true;
  }

  return false;
}

async function handleInput(query: string) {
  if (!query.trim()) {
    rl.prompt();
    return;
  }

  console.log('\n用户查询: ' + query + '\n');

  try {
    memory.addUserMessage(query);

    const result = await agent.run(query);

    memory.addAssistantMessage(JSON.stringify(result));

    printResultSummary(result);

  } catch (error) {
    console.error('\n' + i18n.t('error'), error);
  }

  rl.prompt();
}

rl.on('line', async (line: string) => {
  const input = line.trim();

  const isCommand = await handleCommand(input);
  if (!isCommand) {
    await handleInput(input);
  } else {
    rl.prompt();
  }
});

rl.on('close', () => {
  process.exit(0);
});

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  当前模式: Plan-and-Execute  (复杂任务: 读取文件/分析等)    ║');
console.log('║  输入 !qa 切换到问答模式 (简单问答)                         ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log('命令说明:');
console.log('  !exit  退出程序');
console.log('  !mode  切换问答/Plan模式');
console.log('  !qa    切换到问答模式');
console.log('  !plan  切换到Plan-and-Execute模式');
console.log('  !clear 清空记忆');
console.log('  !help  查看帮助信息');
console.log('  !tools 查看所有工具\n');
console.log('请输入您的任务描述:\n');

rl.prompt();
