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
import { ConfigManager } from './config';
import { LLMClient } from './core/llm';
import { renderMarkdown, isMarkdown } from './utils/markdown';
import readline from 'readline';

const i18n = I18n.getInstance();

const SEP = '=================================================';

printStartupBanner();

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

function printStartupBanner(): void {
  console.log('\n' + SEP);
  const title = i18n.t('bannerTitle');
  const pad = Math.floor((SEP.length - title.length) / 2);
  console.log(' '.repeat(Math.max(0, pad)) + title);
  console.log('     https://github.com/Wasser427/dv-ai-agent    ');
  console.log(SEP);
}

function printStartupInfo(): void {
  const isDebug = ConfigManager.getInstance().isDebug;
  const mode = agent.getMode();
  let modeBanner: string;
  let modeSwitchHint: string;

  switch (mode) {
    case 'plan':
      modeBanner = i18n.t('modeBannerPlan');
      modeSwitchHint = i18n.t('modeSwitchQA');
      break;
    case 'qa':
      modeBanner = i18n.t('modeBannerQA');
      modeSwitchHint = i18n.t('modeSwitchMulti') || 'Input !multi for Multi-Agent mode';
      break;
    case 'multi':
      modeBanner = i18n.t('modeBannerMulti') || 'Current mode: Multi-Agent (parallel execution)';
      modeSwitchHint = i18n.t('modeSwitchPlan') || 'Input !plan for Plan-and-Execute mode';
      break;
    default:
      modeBanner = i18n.t('modeBannerPlan');
      modeSwitchHint = i18n.t('modeSwitchQA');
  }

  const debugLabel = isDebug ? i18n.t('debugModeOn') : i18n.t('debugModeOff');

  console.log('');
  console.log('*'.repeat(55));
  console.log(`  ${debugLabel}`);
  console.log(`  ${modeBanner}`);
  console.log(`  ${modeSwitchHint}`);
  console.log(`  ${i18n.t('langSwitchHint')}`);
  console.log('*'.repeat(55));
  console.log('');
  console.log(i18n.t('commandsSection'));
  console.log('  !exit    ' + i18n.t('helpCmdExit'));
  console.log('  !mode    ' + i18n.t('helpCmdMode'));
  console.log('  !qa      ' + i18n.t('helpCmdQA'));
  console.log('  !plan    ' + i18n.t('helpCmdPlan'));
  console.log('  !multi   ' + i18n.t('helpCmdMulti') || 'Switch to Multi-Agent mode');
  console.log('  !debug   ' + i18n.t('helpCmdDebug') || 'Toggle debug mode');
  console.log('  !status  ' + i18n.t('helpCmdStatus') || 'Show current status');
  console.log('  !clear   ' + i18n.t('helpCmdClear'));
  console.log('  !help    ' + i18n.t('helpCmdHelp'));
  console.log('  !tools   ' + i18n.t('helpCmdTools'));
  console.log('  !v       ' + i18n.t('helpCmdVersion'));
  console.log('  !reload  ' + i18n.t('helpCmdReload'));
  console.log('  !eng / !zh\n');
  console.log(i18n.t('enterTask') + '\n');
}

function printResultSummary(results: any[]): void {
  console.log(`\n========== [${i18n.t('resultSummary')}] ==========\n`);

  for (const r of results) {
    if (r.result && r.result.type === 'direct_answer') {
      const content = r.result.content || '';
      if (isMarkdown(content)) {
        console.log(renderMarkdown(content));
      } else {
        console.log('\x1b[36m' + content + '\x1b[0m');
      }
      console.log();
      continue;
    }

    const statusIcon = r.status === 'completed' ? '✓' : '✗';
    const statusColor = r.status === 'completed' ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(`${statusColor}${statusIcon} ${i18n.t('stepLabel')} ${r.step}: ${r.description}${reset}`);

    if (r.status === 'completed') {
      if (r.result && r.result.success !== undefined) {
        console.log(`   ${i18n.t('resultLabel')}: ${r.result.success ? i18n.t('successLabel') : i18n.t('failLabel')}`);
        if (r.result.message) console.log(`   ${i18n.t('messageLabel')}: ${r.result.message}`);
        if (r.result.filePath) console.log(`   ${i18n.t('fileLabel')}: ${r.result.filePath}`);
        if (r.result.rowCount) console.log(`   ${i18n.t('rowsLabel')}: ${r.result.rowCount}`);
      } else if (r.result && r.result.message) {
        const msg = r.result.message;
        if (typeof msg === 'string' && isMarkdown(msg)) {
          console.log(renderMarkdown(msg));
        } else {
          console.log(`   ${msg}`);
        }
      }
    } else {
      console.log(`   ${i18n.t('errorLabel')}: ${r.result}`);
    }
    console.log();
  }

  const completedCount = results.filter(r => r.status === 'completed').length;
  console.log(i18n.format('completedCount', completedCount, results.length));
  console.log('\n==========================================\n');
}

async function handleCommand(input: string): Promise<boolean> {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === '!exit') {
    console.log('\n' + i18n.t('goodbye') + '\n');
    rl.close();
    process.exit(0);
  }

  if (trimmed === '!v') {
    const pkg = require('../package.json');
    console.log(`\nVersion ${pkg.version}\n`);
    return true;
  }

  if (trimmed === '!eng') {
    i18n.setLanguage('en');
    printStartupBanner();
    console.log(`\n${i18n.t('languageSwitched')} ${i18n.t('langName')}\n`);
    printStartupInfo();
    return true;
  }

  if (trimmed === '!zh') {
    i18n.setLanguage('zh');
    printStartupBanner();
    console.log(`\n${i18n.t('languageSwitched')} ${i18n.t('langName')}\n`);
    printStartupInfo();
    return true;
  }

  if (trimmed === '!mode') {
    agent.toggleMode();
    printStartupInfo();
    return true;
  }

  if (trimmed === '!plan') {
    agent.setMode('plan');
    printStartupInfo();
    return true;
  }

  if (trimmed === '!qa') {
    agent.setMode('qa');
    printStartupInfo();
    return true;
  }

  if (trimmed === '!multi') {
    agent.setMode('multi');
    printStartupInfo();
    return true;
  }

  if (trimmed === '!debug') {
    const cfg = ConfigManager.getInstance();
    const isDebug = cfg.toggleDebug();
    console.log(`\n[调试模式] ${isDebug ? '已启用' : '已禁用'}\n`);
    printStartupInfo();
    return true;
  }

  if (trimmed === '!status') {
    const mode = agent.getMode();
    const isDebug = ConfigManager.getInstance().isDebug;
    const modeNames: Record<string, string> = {
      'qa': i18n.t('modeQA') || '问答模式',
      'plan': i18n.t('modePlan') || '计划执行模式',
      'multi': i18n.t('modeMulti') || '多Agent协同模式'
    };
    console.log(`\n========== [${i18n.t('statusTitle') || '状态信息'}] ==========\n`);
    console.log(`  ${i18n.t('currentMode') || 'Agent模式'}: ${modeNames[mode] || mode}`);
    console.log(`  ${i18n.t('debugMode') || '运行模式'}: ${isDebug ? (i18n.t('developerMode') || '开发者模式') : (i18n.t('userMode') || '用户模式')}`);
    console.log('\n============================================\n');
    return true;
  }

  if (trimmed === '!clear' || trimmed === '!reset') {
    memory.clear();
    return true;
  }

  if (trimmed === '!reload') {
    const cfg = ConfigManager.getInstance();
    cfg.reload();
    agent.reloadDebug();
    LLMClient.getInstance().reloadConfig();
    i18n.reload();
    printStartupBanner();
    console.log(i18n.t('welcome') + '\n');
    console.log(`\n${i18n.t('reloadEnvOk')}\n`);
    printStartupInfo();
    return true;
  }

  if (trimmed === '!history' || trimmed === '!mem') {
    const history = memory.getHistory();
    if (history.length === 0) {
      console.log('\n' + i18n.t('noMemory') + '\n');
    } else {
      console.log(`\n========== [${i18n.t('memoryTitle')}] (${i18n.format('memoryCount', history.length)}) ==========\n`);
      history.forEach((entry, i) => {
        const role = entry.role === 'user' ? i18n.t('roleUser') : i18n.t('roleAssistant');
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

  if (trimmed.startsWith('!') && trimmed.length > 1) {
    console.log(`\n${i18n.format('undefinedCommand', trimmed)}\n`);
    return true;
  }

  return false;
}

async function handleInput(query: string) {
  if (!query.trim()) {
    rl.prompt();
    return;
  }

  console.log('\n' + i18n.t('userQueryLabel') + ' ' + query + '\n');

  try {
    memory.addUserMessage(query);

    const result = await agent.run(query);

    // 根据模式保存不同的记忆内容
    let responseContent = JSON.stringify(result);
    if (agent.getMode() === 'qa' && result.length > 0 && result[0].result?.content) {
      // 问答模式保存实际回答内容
      responseContent = result[0].result.content;
    }
    memory.addAssistantMessage(responseContent);

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

printStartupInfo();
rl.prompt();
