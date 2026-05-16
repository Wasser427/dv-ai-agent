import { BaseTool } from './base';
import fs from 'fs/promises';
import path from 'path';
import xlsx from 'xlsx';
import mammoth from 'mammoth';

export class FileReadTool extends BaseTool {
  name = 'file_read';
  description = '读取文本文件（txt, log, md, json, csv等）的内容';
  parameters = {
    filePath: { type: 'string', description: '文件路径', required: true }
  };

  async execute(args: Record<string, any>): Promise<any> {
    try {
      const filePath = args.filePath;

      if (!filePath) {
        throw new Error('文件路径不能为空');
      }

      const ext = path.extname(filePath).toLowerCase();
      const supportedExts = ['.txt', '.log', '.md', '.json', '.csv', '.xml', '.html', '.htm'];

      if (!supportedExts.includes(ext)) {
        throw new Error(`不支持的文件类型: ${ext}，支持的类型: ${supportedExts.join(', ')}`);
      }

      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error: any) {
      throw new Error(`读取文件失败: ${error.message}`);
    }
  }
}

export class FileWriteTool extends BaseTool {
  name = 'file_write';
  description = '写入内容到文本文件';
  parameters = {
    filePath: { type: 'string', description: '文件路径', required: true },
    content: { type: 'string', description: '要写入的内容', required: true }
  };

  async execute(args: Record<string, any>): Promise<any> {
    try {
      const filePath = args.filePath;
      const content = args.content;

      if (!filePath) {
        throw new Error('文件路径不能为空');
      }

      if (content === undefined || content === null) {
        throw new Error('文件内容不能为空');
      }

      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, message: '文件写入成功', filePath };
    } catch (error: any) {
      throw new Error(`写入文件失败: ${error.message}`);
    }
  }
}

export class ExcelReadTool extends BaseTool {
  name = 'excel_read';
  description = '读取 Excel 文件内容并转换为 Markdown 表格格式';
  parameters = {
    filePath: { type: 'string', description: 'Excel 文件路径', required: true },
    sheetName: { type: 'string', description: '工作表名称（可选）', required: false },
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
        return { success: true, markdown: '', content: '', rowCount: 0, sheetName: sheet };
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

      let message = `Excel 文件包含 ${data.length - 1} 行数据`;
      if (data.length > maxRows) {
        md += `\n*... 共 ${data.length - 1} 行，显示前 ${maxRows} 行 *`;
        message += `，已截断显示前 ${maxRows} 行`;
      }

      return {
        success: true,
        content: md,
        markdown: md,
        rowCount: data.length - 1,
        sheetName: sheet,
        message
      };
    } catch (error: any) {
      throw new Error(`读取Excel文件失败: ${error.message}`);
    }
  }
}

export class DocxReadTool extends BaseTool {
  name = 'docx_read';
  description = '读取 Word (docx) 文件内容';
  parameters = {
    filePath: { type: 'string', description: 'Word 文件路径', required: true }
  };

  async execute(args: Record<string, any>): Promise<any> {
    try {
      const filePath = args.filePath;

      if (!filePath) {
        throw new Error('文件路径不能为空');
      }

      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });

      return { success: true, content: result.value };
    } catch (error: any) {
      throw new Error(`读取Word文档失败: ${error.message}`);
    }
  }
}

export class CsvReadTool extends BaseTool {
  name = 'csv_read';
  description = '读取 CSV 文件内容并转换为 Markdown 表格格式';
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
        return { success: true, markdown: '', content: '', rowCount: 0 };
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

      let message = `CSV 文件包含 ${lines.length - 1} 行数据`;
      if (lines.length > maxRows) {
        md += `\n*... 共 ${lines.length - 1} 行，显示前 ${maxRows} 行 *`;
        message += `，已截断显示前 ${maxRows} 行`;
      }

      return {
        success: true,
        content: md,
        markdown: md,
        rowCount: lines.length - 1,
        message
      };
    } catch (error: any) {
      throw new Error(`读取CSV文件失败: ${error.message}`);
    }
  }
}
