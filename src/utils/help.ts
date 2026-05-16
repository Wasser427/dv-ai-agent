import { ToolManager } from '../tools/manager';
import { I18n } from '../i18n';

export class HelpManager {
  private static instance: HelpManager;
  private toolManager: ToolManager;
  private i18n: I18n;

  private constructor() {
    this.toolManager = ToolManager.getInstance();
    this.i18n = I18n.getInstance();
  }

  static getInstance(): HelpManager {
    if (!HelpManager.instance) {
      HelpManager.instance = new HelpManager();
    }
    return HelpManager.instance;
  }

  getHelp(): string {
    const i18n = this.i18n;
    const sep = i18n.t('separator');

    return `
${'='.repeat(41)}
           ${i18n.t('helpTitle')}          
${'='.repeat(41)}

【${i18n.t('helpCommands')}】
  !help    - ${i18n.t('helpCmdHelp')}
  !exit    - ${i18n.t('helpCmdExit')}
  !mode    - ${i18n.t('helpCmdMode')}
  !qa      - ${i18n.t('helpCmdQA')}
  !plan    - ${i18n.t('helpCmdPlan')}
  !clear   - ${i18n.t('helpCmdClear')}
  !reset   - ${i18n.t('helpCmdReset')}
  !history - ${i18n.t('helpCmdHistory')}
  !mem     - ${i18n.t('helpCmdMem')}
  !zh      - ${i18n.t('helpLangChinese')}
  !eng     - ${i18n.t('helpLangEnglish')}
  !v       - ${i18n.t('helpCmdVersion')}
  !reload  - ${i18n.t('helpCmdReload')}
  !tools   - ${i18n.t('helpCmdTools')}
  !help <${i18n.t('toolName')}> - ${i18n.t('helpCmdToolDetail')}

【${i18n.t('helpTools')}】
${this.getToolsHelpInternal()}

【${i18n.t('helpExamples')}】
  ${i18n.t('helpUsage1')}
     > ${i18n.t('helpUsage1a')}
     > ${i18n.t('helpUsage1b')}
     > ${i18n.t('helpUsage1c')}

  ${i18n.t('helpUsage2')}
     > ${i18n.t('helpUsage2a')}
     > ${i18n.t('helpUsage2b')}

  ${i18n.t('helpUsage3')}
     > ${i18n.t('helpUsage3a')}

【${i18n.t('helpTips')}】
  - ${i18n.t('helpTip1')}
  - ${i18n.t('helpTip2')}
  - ${i18n.t('helpTip3')}
`;
  }

  private getCommandsHelp(): string {
    const i18n = this.i18n;
    return `  !help    - ${i18n.t('helpCmdHelp')}
  !exit    - ${i18n.t('helpCmdExit')}
  !mode    - ${i18n.t('helpCmdMode')}
  !qa      - ${i18n.t('helpCmdQA')}
  !plan    - ${i18n.t('helpCmdPlan')}
  !clear   - ${i18n.t('helpCmdClear')}
  !reset   - ${i18n.t('helpCmdReset')}
  !history - ${i18n.t('helpCmdHistory')}
  !mem     - ${i18n.t('helpCmdMem')}
  !zh      - ${i18n.t('helpLangChinese')}
  !eng     - ${i18n.t('helpLangEnglish')}
  !v       - ${i18n.t('helpCmdVersion')}
  !reload  - ${i18n.t('helpCmdReload')}
  !tools   - ${i18n.t('helpCmdTools')}
  !help <${i18n.t('toolName')}> - ${i18n.t('helpCmdToolDetail')}`;
  }

  private getToolsHelpInternal(): string {
    const tools = this.toolManager.getAllTools();
    const i18n = this.i18n;
    let help = '';

    for (const tool of tools) {
      const params = this.formatParameters(tool.parameters);
      help += `\n  ${tool.name}`;
      help += `\n    ${i18n.t('helpDesc')}: ${tool.description}`;
      if (params) {
        help += `\n    ${i18n.t('helpParams')}: ${params}`;
      }
      help += '\n';
    }

    return help;
  }

  private formatParameters(params: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }

    const i18n = this.i18n;
    return Object.entries(params)
      .map(([key, value]: [string, any]) => {
        const required = value.required ? `(${i18n.t('helpRequired')})` : `(${i18n.t('helpOptional')})`;
        const type = value.type || 'any';
        const desc = value.description || '';
        return `${key}: ${type} ${required} ${desc}`;
      })
      .join(', ');
  }

  getToolsList(): string {
    const tools = this.toolManager.getAllTools();
    const i18n = this.i18n;
    let help = `\n【${i18n.t('helpToolListTitle')}】\n\n`;

    help += `${i18n.t('helpToolListHeader')}\n`;
    help += '  ' + '-'.repeat(60) + '\n';

    tools.forEach((tool, index) => {
      const num = (index + 1).toString().padStart(3);
      const name = tool.name.padEnd(20);
      const desc = tool.description.substring(0, 30);
      help += `  ${num}    ${name}  ${desc}\n`;
    });

    help += `\n  ${i18n.t('helpToolListFooter')}\n`;

    return help;
  }

  getToolDetail(toolName: string): string {
    const tool = this.toolManager.getTool(toolName);
    const i18n = this.i18n;

    if (!tool) {
      return `${i18n.format('helpToolNotFound', toolName)}\n${i18n.t('helpToolListFooter')}`;
    }

    const params = this.formatParameters(tool.parameters);

    return `
【${i18n.t('helpToolDetailTitle')}】
  ${i18n.t('helpDesc')}: ${tool.description}
  ${i18n.t('helpParams')}:
${params ? '    ' + params : `    ${i18n.t('helpNone')}`}
`;
  }
}
