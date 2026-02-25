/**
 * MCP 服务器 - HTTP/SSE 接口实现
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as http from 'http';
import { ClientRegistry } from './ClientRegistry';
import { TaskManager } from './TaskManager';
import type { DebugLogEntry } from '../shared/types';
import { HEALTH_PATH, SSE_PATH, MESSAGE_PATH } from '../shared/constants';

/** MCP 工具定义 */
const TOOLS = [
  {
    name: 'listOpenProjects',
    description: 'List all open workspaces and their directories',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string', description: 'Optional current directory path' }
      }
    }
  },
  {
    name: 'goToDefinition',
    description: 'Jump to symbol definition location',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string', description: 'Project directory absolute path' },
        filePath: { type: 'string', description: 'File path (absolute or relative)' },
        line: { type: 'number', description: 'Line number (1-based)' },
        character: { type: 'number', description: 'Column offset (0-based)' },
        symbolName: { type: 'string', description: 'Optional symbol name for validation' }
      },
      required: ['projectPath', 'filePath', 'line', 'character']
    }
  },
  {
    name: 'findReferences',
    description: 'Find all references to a symbol',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        filePath: { type: 'string' },
        line: { type: 'number' },
        character: { type: 'number' },
        page: { type: 'number', description: 'Page number (1-based)' }
      },
      required: ['projectPath', 'filePath', 'line', 'character']
    }
  },
  {
    name: 'hover',
    description: 'Get hover information for a symbol',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        filePath: { type: 'string' },
        line: { type: 'number' },
        character: { type: 'number' }
      },
      required: ['projectPath', 'filePath', 'line', 'character']
    }
  },
  {
    name: 'getFileStruct',
    description: 'Get all symbol structures in a file',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        filePath: { type: 'string' }
      },
      required: ['projectPath', 'filePath']
    }
  },
  {
    name: 'searchSymbolInWorkspace',
    description: 'Search symbols in workspace',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        query: { type: 'string', description: 'Search keyword' },
        symbolType: { type: 'string', enum: ['class', 'method', 'field', 'all'] },
        page: { type: 'number' }
      },
      required: ['projectPath', 'query']
    }
  },
  {
    name: 'goToImplementation',
    description: 'Find implementations of interface/abstract class',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        filePath: { type: 'string' },
        line: { type: 'number' },
        character: { type: 'number' },
        page: { type: 'number' }
      },
      required: ['projectPath', 'filePath', 'line', 'character']
    }
  },
  {
    name: 'incomingCalls',
    description: 'Find callers of a method',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        filePath: { type: 'string' },
        line: { type: 'number' },
        page: { type: 'number' }
      },
      required: ['projectPath', 'filePath', 'line']
    }
  },
  {
    name: 'renameSymbol',
    description: 'Prepare rename edits',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        filePath: { type: 'string' },
        line: { type: 'number' },
        character: { type: 'number' },
        symbolName: { type: 'string' },
        newName: { type: 'string' }
      },
      required: ['projectPath', 'filePath', 'line', 'character', 'newName']
    }
  },
  {
    name: 'getDiagnostics',
    description: 'Get file diagnostics (warnings, errors)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        filePath: { type: 'string' },
        severity: { type: 'string' },
        page: { type: 'number' }
      },
      required: ['projectPath', 'filePath']
    }
  },
  {
    name: 'getDefinitionText',
    description: 'Get symbol definition text',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        filePath: { type: 'string' },
        line: { type: 'number' },
        character: { type: 'number' },
        symbolName: { type: 'string' }
      },
      required: ['projectPath', 'filePath', 'line', 'character']
    }
  },
  {
    name: 'syncFiles',
    description: 'Refresh VSCode index, sync external file changes',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        paths: { type: 'array', items: { type: 'string' } }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'searchFiles',
    description: 'Search files by name regex',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        pattern: { type: 'string', description: 'Filename regex' },
        directory: { type: 'string' },
        recursive: { type: 'boolean' },
        page: { type: 'number' }
      },
      required: ['projectPath', 'pattern']
    }
  },
  {
    name: 'moveFile',
    description: 'Move file/directory, auto-update references',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        sourcePath: { type: 'string' },
        targetDir: { type: 'string' }
      },
      required: ['projectPath', 'sourcePath', 'targetDir']
    }
  },
  {
    name: 'deleteFile',
    description: 'Safely delete file, check references',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        filePath: { type: 'string' },
        force: { type: 'boolean' }
      },
      required: ['projectPath', 'filePath']
    }
  },
  {
    name: 'getScopeParent',
    description: 'Find parent symbol at position',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: { type: 'string' },
        filePath: { type: 'string' },
        line: { type: 'number' }
      },
      required: ['projectPath', 'filePath', 'line']
    }
  }
];

export class McpServer {
  private server: Server;
  private transports = new Map<string, SSEServerTransport>();

  constructor(
    private registry: ClientRegistry,
    private taskManager: TaskManager
  ) {
    this.server = new Server(
      { name: 'ide-lsp-mcp', version: '0.0.1' },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 列出工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS
    }));

    // 调用工具
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const result = await this.handleToolCall(name, args as Record<string, unknown>);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    });
  }

  /**
   * 处理工具调用
   */
  async handleToolCall(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const startTime = Date.now();
    let success = true;
    let result: unknown;

    try {
      // listOpenProjects 特殊处理 - 不需要路由到窗口
      if (tool === 'listOpenProjects') {
        result = this.handleListOpenProjects(args);
        return result;
      }

      // 其他工具需要路由到对应窗口
      const projectPath = args.projectPath as string;
      if (!projectPath) {
        throw new Error('projectPath is required');
      }

      const client = this.registry.findByProjectPath(projectPath);
      if (!client) {
        throw new Error(`Project not found in any open window: ${projectPath}`);
      }

      result = await this.taskManager.dispatch(client, tool, args);
      return result;
    } catch (error) {
      success = false;
      result = { error: (error as Error).message };
      throw error;
    } finally {
      // 广播调试日志
      const entry: DebugLogEntry = {
        timestamp: startTime,
        tool,
        args,
        result: JSON.stringify(result),
        duration: Date.now() - startTime,
        success
      };
      this.broadcastDebugLog(entry);
    }
  }

  /**
   * 处理 listOpenProjects
   */
  private handleListOpenProjects(args: Record<string, unknown>): unknown {
    const projects = this.registry.getAllProjects();
    const projectPath = args.projectPath as string | undefined;

    // 按窗口分组
    const workspaces = new Map<string, { id: string; name: string; folders: Array<{ name: string; path: string }> }>();
    for (const proj of projects) {
      if (!workspaces.has(proj.windowId)) {
        workspaces.set(proj.windowId, {
          id: proj.windowId,
          name: proj.name,
          folders: []
        });
      }
      workspaces.get(proj.windowId)!.folders.push({ name: proj.name, path: proj.path });
    }

    const result: {
      workspaces: Array<{ id: string; name: string; folders: Array<{ name: string; path: string }> }>;
      currentWorkspace?: { id: string; folder: { name: string; path: string } };
    } = {
      workspaces: Array.from(workspaces.values())
    };

    // 如果提供了 projectPath，找到对应的 workspace
    if (projectPath) {
      const normalizedPath = projectPath.toLowerCase().replace(/\\/g, '/');
      for (const proj of projects) {
        if (proj.path.toLowerCase().replace(/\\/g, '/') === normalizedPath) {
          result.currentWorkspace = {
            id: proj.windowId,
            folder: { name: proj.name, path: proj.path }
          };
          break;
        }
      }
    }

    return result;
  }

  /**
   * 广播调试日志
   */
  private broadcastDebugLog(entry: DebugLogEntry): void {
    const message = JSON.stringify({ type: 'debugLog', entry });
    for (const client of this.registry.getAllClients()) {
      client.ws.send(message);
    }
  }

  /**
   * 处理 HTTP 请求
   */
  async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // 健康检查
    if (url.pathname === HEALTH_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', clients: this.registry.size }));
      return;
    }

    // SSE 连接
    if (url.pathname === SSE_PATH && req.method === 'GET') {
      const transport = new SSEServerTransport(MESSAGE_PATH, res);
      const sessionId = transport.sessionId;
      this.transports.set(sessionId, transport);

      res.on('close', () => {
        this.transports.delete(sessionId);
      });

      await this.server.connect(transport);
      return;
    }

    // MCP 消息
    if (url.pathname === MESSAGE_PATH && req.method === 'POST') {
      // 找到对应的 transport
      const sessionId = url.searchParams.get('sessionId');
      if (sessionId && this.transports.has(sessionId)) {
        const transport = this.transports.get(sessionId)!;
        await transport.handlePostMessage(req, res);
        return;
      }

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid session' }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

// 需要 crypto 模块
import * as crypto from 'crypto';
