export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute(args: Record<string, any>): Promise<any>;
}

export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: Record<string, any>;
  abstract execute(args: Record<string, any>): Promise<any>;
}
