import { BaseTool } from './base';
import fs from 'fs/promises';
import path from 'path';
import xlsx from 'xlsx';

export class ExcelToMarkdownTool extends BaseTool {
  name = 'excel_to_md';
  description = '将 Excel 文件转换为 Markdown 表格格式';
  parameters = {
    filePath: { type: 'string', description: 'Excel 文件路径', required: true },
    sheetName: { type: 'string', description: '工作表名称（可选，默认第一个）', required: false },
    maxRows: { type: 'number', description: '最大转换行数（可选，默认100）', required: false }
  };

  async execute(args: Record<string, any>): Promise<any> {
    try {
      const filePath = args.filePath;
      const sheetName = args.sheetName;
      const maxRows = args.maxRows || 100;

      const workbook = xlsx.readFile(filePath);
      const sheet = sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheet];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (data.length === 0) {
        return { success: true, markdown: '', message: 'Excel 文件为空' };
      }

      const headers = data[0] || [];
      const rows = data.slice(1, maxRows + 1);

      let md = `## ${sheet}\n\n`;

      md += '| ' + headers.join(' | ') + ' |\n';
      md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

      for (const row of rows) {
        const cells = headers.map((_, i) => {
          const cell = row[i];
          if (cell === undefined || cell === null) return '';
          return String(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ');
        });
        md += '| ' + cells.join(' | ') + ' |\n';
      }

      if (data.length > maxRows) {
        md += `\n*... 共 ${data.length - 1} 行，显示前 ${maxRows} 行 *`;
      }

      return {
        success: true,
        markdown: md,
        rowCount: data.length - 1,
        sheetName: sheet
      };
    } catch (error: any) {
      throw new Error(`Excel转Markdown失败: ${error.message}`);
    }
  }
}

export class CsvToMarkdownTool extends BaseTool {
  name = 'csv_to_md';
  description = '将 CSV 文件转换为 Markdown 表格格式';
  parameters = {
    filePath: { type: 'string', description: 'CSV 文件路径', required: true },
    maxRows: { type: 'number', description: '最大转换行数（可选，默认100）', required: false }
  };

  async execute(args: Record<string, any>): Promise<any> {
    try {
      const filePath = args.filePath;
      const maxRows = args.maxRows || 100;

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      if (lines.length === 0) {
        return { success: true, markdown: '', message: 'CSV 文件为空' };
      }

      const headers = lines[0].split(',').map((h: string) => h.trim());
      const rows = lines.slice(1, maxRows + 1);

      let md = `## CSV 文件\n\n`;

      md += '| ' + headers.join(' | ') + ' |\n';
      md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

      for (const line of rows) {
        const cells = line.split(',').map((c: string) => c.trim().replace(/\|/g, '\\|'));
        md += '| ' + cells.join(' | ') + ' |\n';
      }

      if (lines.length > maxRows) {
        md += `\n*... 共 ${lines.length - 1} 行，显示前 ${maxRows} 行 *`;
      }

      return {
        success: true,
        markdown: md,
        rowCount: lines.length - 1
      };
    } catch (error: any) {
      throw new Error(`CSV转Markdown失败: ${error.message}`);
    }
  }
}
