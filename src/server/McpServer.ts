/**
 * MCP 服务器 - HTTP/SSE 接口实现
 * 使用新的 McpServer + StreamableHTTPServerTransport API
 */

import { McpServer as McpServerSDK } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as http from "http";
import * as crypto from "crypto";
import { ClientRegistry } from "./ClientRegistry";
import { TaskManager } from "./TaskManager";
import { HEALTH_PATH } from "../shared/constants";
import toolSCHEMAS, { type ToolName } from "./MCPTools";

/** MCP 端点路径 */
const MCP_ENDPOINT = "/mcp";

export class McpServer {
  /** 存储每个 session 的 transport 和 server 实例 */
  private sessions = new Map<
    string,
    {
      server: McpServerSDK;
      transport: StreamableHTTPServerTransport;
    }
  >();

  constructor(
    private registry: ClientRegistry,
    private taskManager: TaskManager
  ) {}

  /**
   * 创建新的 MCP Server 实例并注册工具
   */
  private createMcpServer(): McpServerSDK {
    const server = new McpServerSDK(
      { name: "ide-lsp-mcp", version: "0.0.1" },
      { capabilities: { tools: {} } }
    );

    // 注册所有工具 (使用新的 registerTool API + Zod schema)
    for (const [name, tool] of Object.entries(toolSCHEMAS)) {
      const toolName = name as ToolName;
      server.registerTool(
        "IDE-"+toolName,
        {
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        async (args: Record<string, unknown>) => {
          const result = await this.handleToolCall(
            toolName,
            args as Record<string, unknown>
          );
          const res = {
            content: [
              {
                type: "text" as const,
                text:
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2),
              },
            ],
          };
          return res;
        }
      );
    }

    return server;
  }

  /**
   * 处理工具调用
   */
  async handleToolCall(
    tool: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    // listOpenProjects 特殊处理 - 不需要路由到窗口
    if (tool === "listOpenProjects") {
      return this.handleListOpenProjects(args);
    }

    // 其他工具需要路由到对应窗口
    const projectPath = args.projectPath as string;
    if (!projectPath) {
      throw new Error("projectPath is required");
    }

    const client = this.registry.findByProjectPath(projectPath);
    if (!client) {
      throw new Error(`Project not found in any open window: ${projectPath}`);
    }

    return this.taskManager.dispatch(client, tool, args);
  }

  /**
   * 处理 listOpenProjects
   */
  private handleListOpenProjects(args: Record<string, unknown>): unknown {
    const projects = this.registry.getAllProjects();
    const projectPath = args.projectPath as string | undefined;

    // 按窗口分组
    const workspaces = new Map<
      string,
      {
        id: string;
        name: string;
        folders: Array<{ name: string; path: string }>;
      }
    >();
    for (const proj of projects) {
      if (!workspaces.has(proj.windowId)) {
        workspaces.set(proj.windowId, {
          id: proj.windowId,
          name: proj.name,
          folders: [],
        });
      }
      workspaces
        .get(proj.windowId)!
        .folders.push({ name: proj.name, path: proj.path });
    }

    const result: {
      workspaces?: Array<{
        id: string;
        name: string;
        folders: Array<{ name: string; path: string }>;
      }>;
      targetWorkspace?: Array<{
        id: string;
        name: string;
        folders: Array<{ name: string; path: string }>;
      }>;
    } = {
      workspaces: Array.from(workspaces.values()),
    };

    // 如果提供了 projectPath，找到对应的 workspace
    if (projectPath) {
      const formatedPath=ClientRegistry.normalizePath(projectPath);
      const targetWorkspace = result.workspaces?.filter( ws => ws.folders.filter((f) => f.path === formatedPath).length > 0);
      if (targetWorkspace && targetWorkspace.length <= 0) {
        return `The workspace corresponding to the specified \`${formatedPath}\` cannot be found.`;
      } else {
        result.targetWorkspace = targetWorkspace;
        delete result.workspaces;
      }
    }

    return result;
  }

  /**
  /**
   * 处理 HTTP 请求
   */
  async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // 健康检查
    if (url.pathname === HEALTH_PATH) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", clients: this.registry.size }));
      return;
    }

    // MCP 端点 - 处理所有 MCP 请求
    if (url.pathname === MCP_ENDPOINT) {
      await this.handleMcpRequest(req, res);
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }

  /**
   * 处理 MCP 请求 (Streamable HTTP)
   */
  private async handleMcpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // 从请求头获取 session ID
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // 如果有 session ID，尝试复用现有 session
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res);
      return;
    }

    // 创建新的 session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    const server = this.createMcpServer();

    // 连接 server 和 transport
    await server.connect(transport);

    // 处理请求
    await transport.handleRequest(req, res);

    // 存储 session（如果 transport 生成了 session ID）
    const newSessionId = transport.sessionId;
    if (newSessionId) {
      this.sessions.set(newSessionId, { server, transport });

      // 设置清理回调
      transport.onclose = () => {
        this.sessions.delete(newSessionId);
      };
    }
  }

  /**
   * 关闭所有 session
   */
  async close(): Promise<void> {
    for (const [sessionId, session] of this.sessions) {
      await session.transport.close();
      await session.server.close();
      this.sessions.delete(sessionId);
    }
  }
}
