import { BaseTool } from './base';
import fs from 'fs/promises';
import path from 'path';
import xlsx from 'xlsx';
import mammoth from 'mammoth';

export class FileReadTool extends BaseTool {
  name = 'file_read';
  description = '读取文本文件（代码文件、配置文档、芯片设计文件等）的内容，支持多种文本格式';
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
      const supportedExts = [
        '.txt', '.log', '.md', '.json', '.csv', '.xml', '.html', '.htm',
        '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.cts', '.mts',
        '.py', '.pyw', '.pyi',
        '.java', '.class', '.jar',
        '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.hh', '.hxx',
        '.go', '.rs', '.rb', '.erb', '.gemfile',
        '.php', '.phtml', '.php3', '.php4', '.php5',
        '.cs', '.fs', '.fsx', '.sln',
        '.swift', '.m', '.mm',
        '.kt', '.kts', '.scala', '.sc',
        '.r', '.R', '.rmd',
        '.lua', '.lua5',
        '.pl', '.pm', '.t',
        '.sh', '.bash', '.zsh', '.fish', '.ash', '.csh', '.tcsh',
        '.ps1', '.psm1', '.psd1',
        '.bat', '.cmd', '.btm',
        '.sql', '.ddl', '.dml',
        '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.config',
        '.properties', '.env', '.gitignore', '.dockerignore',
        '.vue', '.svelte',
        '.css', '.scss', '.sass', '.less', '.styl',
        '.graphql', '.gql', '.schema',
        '.proto', '.buf',
        '.makefile', '.mk', '.cmake', '.gradle',
        '.dockerfile', '.dockerignore',
        '.gitignore', '.gitattributes', '.gitconfig',
        '.editorconfig', '.eslintrc', '.prettierrc', '.babelrc',
        '.webpack', '.rollup', '.vite', '.esbuild',
        '.gradle', '.properties',
        '.rdf', '.ttl', '.nt',
        '.jwt', '.p12', '.pem', '.cer', '.crt', '.key',
        '.diff', '.patch',
        '.ex', '.exs', '.eex', '.leex',
        '.fs', '.fsx', '.fsscript',
        '.nim', '.nimble',
        '.zig', '.zap',
        '.v', '.vh', '.sv', '.svh',
        '.glsl', '.vert', '.frag', '.comp',
        '.ipynb',
        '.env', '.env.local', '.env.development', '.env.production',
        '.editorconfig', '.prettierrc', '.prettierrc.json', '.prettierrc.yaml',
        '.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yaml',
        '.babelrc', '.babelrc.json', '.babelrc.js',
        '.pylintrc', '.flake8', '.mypyrc', '.coverage',
        '.clang-format', '.clang-tidy',
        '.xlf', '.xliff',
        '.d.ts', '.d.tsx',
        '.v', '.sv', '.svh', '.vh', '.vlog', '.vams',
        '.sdc', '.xdc', '.ucf',
        '.lib', '.cel', '.mil', '.gds', '.oa',
        '.lef', '.def', '.sdf', '.cdl',
        '.vcd', '.fsdb', '.evcd', '.shm', '.raw',
        '.f', '.filelist', '.lst',
        '.tcl', '.do', '.scr',
        '.sp', '.cir', '.net', '.ckt',
        '.bin', '.hex', '.mif', '.rim',
        '.prj', '.pro', '.qsf', '.srf',
        '.dat', '.trn', '.rpt', '.out',
        '.waive', '.waivers'
      ];

      if (!supportedExts.includes(ext)) {
        return { 
          success: false, 
          message: `跳过不支持的文件类型: ${ext}`,
          skipped: true,
          unsupported: true
        };
      }

      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error: any) {
      return { 
        success: false, 
        message: `读取文件失败: ${error.message}`,
        skipped: true
      };
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
  description = '读取 Excel 文件内容并转换为 Markdown 表格格式，支持读取所有工作表';
  parameters = {
    filePath: { type: 'string', description: 'Excel 文件路径', required: true },
    sheetName: { type: 'string', description: '工作表名称（可选，不指定则读取所有工作表）', required: false },
    maxRows: { type: 'number', description: '每个工作表最大转换行数（可选，默认100）', required: false }
  };

  async execute(args: Record<string, any>): Promise<any> {
    try {
      const filePath = args.filePath;
      const sheetName = args.sheetName;
      const maxRows = args.maxRows || 100;

      const workbook = xlsx.readFile(filePath);
      const allSheetNames = workbook.SheetNames;
      const sheetsToRead = sheetName ? [sheetName] : allSheetNames;

      let fullMd = '';
      let totalRows = 0;
      const sheetResults: any[] = [];

      for (const sheet of sheetsToRead) {
        const worksheet = workbook.Sheets[sheet];
        if (!worksheet) {
          continue;
        }
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (data.length === 0) {
          sheetResults.push({ sheetName: sheet, rowCount: 0, content: '' });
          continue;
        }

        const headers = data[0] || [];
        const rows = data.slice(1, maxRows + 1);

        let sheetMd = `## ${sheet}\n\n`;
        sheetMd += '| ' + headers.join(' | ') + ' |\n';
        sheetMd += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

        for (const row of rows) {
          const cells = headers.map((_, i) => {
            const cell = row[i];
            if (cell === undefined || cell === null) return '';
            return String(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ');
          });
          sheetMd += '| ' + cells.join(' | ') + ' |\n';
        }

        if (data.length > maxRows) {
          sheetMd += `\n*... 共 ${data.length - 1} 行，显示前 ${maxRows} 行 *\n\n`;
        } else {
          sheetMd += '\n';
        }

        fullMd += sheetMd;
        totalRows += data.length - 1;
        sheetResults.push({ sheetName: sheet, rowCount: data.length - 1, content: sheetMd });
      }

      let message = `Excel 文件共 ${allSheetNames.length} 个工作表，已读取 ${sheetsToRead.length} 个`;
      if (totalRows > 0) {
        message += `，总计 ${totalRows} 行数据`;
      }

      return {
        success: true,
        content: fullMd,
        markdown: fullMd,
        totalRows,
        totalSheets: allSheetNames.length,
        sheetsRead: sheetsToRead.length,
        sheetResults,
        message
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: `跳过Excel文件: ${error.message}`,
        skipped: true
      };
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
        return { 
          success: false, 
          message: '跳过: 文件路径不能为空',
          skipped: true
        };
      }

      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });

      return { success: true, content: result.value };
    } catch (error: any) {
      return { 
        success: false, 
        message: `跳过Word文档: ${error.message}`,
        skipped: true
      };
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
      return { 
        success: false, 
        message: `跳过CSV文件: ${error.message}`,
        skipped: true
      };
    }
  }
}
