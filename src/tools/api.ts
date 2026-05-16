import { BaseTool } from './base';
import axios from 'axios';

export class ApiGetTool extends BaseTool {
  name = 'api_get';
  description = '发送 GET 请求到 API';
  parameters = {
    url: { type: 'string', description: 'API 地址', required: true },
    headers: { type: 'object', description: '请求头（可选）', required: false }
  };

  async execute(args: Record<string, any>): Promise<any> {
    const response = await axios.get(args.url, { headers: args.headers || {} });
    return { success: true, status: response.status, data: response.data };
  }
}

export class ApiPostTool extends BaseTool {
  name = 'api_post';
  description = '发送 POST 请求到 API';
  parameters = {
    url: { type: 'string', description: 'API 地址', required: true },
    data: { type: 'object', description: '请求数据', required: true },
    headers: { type: 'object', description: '请求头（可选）', required: false }
  };

  async execute(args: Record<string, any>): Promise<any> {
    const response = await axios.post(args.url, args.data, { headers: args.headers || {} });
    return { success: true, status: response.status, data: response.data };
  }
}
