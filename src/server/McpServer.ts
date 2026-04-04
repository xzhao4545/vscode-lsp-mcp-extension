/**
 * MCP 服务器 - HTTP/SSE 接口实现
 * 使用新的 McpServer + StreamableHTTPServerTransport API
 */

import * as crypto from "node:crypto";
import type * as http from "node:http";
import { McpServer as McpServerSDK } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { HEALTH_PATH } from "../shared/constants";
import { ClientRegistry } from "./ClientRegistry";
import toolSCHEMAS, { type ToolName } from "./MCPTools";
import type { TaskManager } from "./TaskManager";

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
	private closing = false;

	constructor(
		private registry: ClientRegistry,
		private taskManager: TaskManager,
		private enableCors: boolean = false,
	) {}

	/**
	 * 创建新的 MCP Server 实例并注册工具
	 */
	private createMcpServer(): McpServerSDK {
		const server = new McpServerSDK(
			{ name: "ide-lsp-mcp", version: "0.0.1" },
			{ capabilities: { tools: {} } },
		);

		for (const [name, tool] of Object.entries(toolSCHEMAS)) {
			const toolName = name as ToolName;
			server.registerTool(
				toolName,
				{
					description: tool.description,
					inputSchema: tool.inputSchema,
				},
				async (args: Record<string, unknown>) => {
					const result = await this.handleToolCall(
						toolName,
						args as Record<string, unknown>,
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
				},
			);
		}

		return server;
	}

	/**
	 * 处理工具调用
	 */
	async handleToolCall(
		tool: string,
		args: Record<string, unknown>,
	): Promise<unknown> {
		if (tool === "listOpenProjects") {
			return this.handleListOpenProjects(args);
		}

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
				.get(proj.windowId)
				?.folders.push({ name: proj.name, path: proj.path });
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

		if (projectPath) {
			const formatedPath = ClientRegistry.normalizePath(projectPath);
			const targetWorkspace = result.workspaces?.filter(
				(ws) => ws.folders.filter((f) => f.path === formatedPath).length > 0,
			);
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
	 * 处理 HTTP 请求
	 */
	async handleRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse,
	): Promise<void> {
		if (this.closing) {
			res.writeHead(503, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Server shutting down" }));
			return;
		}

		const url = new URL(req.url || "/", `http://${req.headers.host}`);

		if (this.enableCors) {
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader(
				"Access-Control-Allow-Methods",
				"GET, POST, DELETE, OPTIONS",
			);
			res.setHeader(
				"Access-Control-Allow-Headers",
				"Content-Type, mcp-session-id",
			);
		}

		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}

		if (url.pathname === HEALTH_PATH) {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "ok", clients: this.registry.size }));
			return;
		}

		if (url.pathname === MCP_ENDPOINT) {
			await this.handleMcpRequest(req, res);
			return;
		}

		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Not found" }));
	}

	/**
	 * 处理 MCP 请求 (Streamable HTTP)
	 */
	private async handleMcpRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse,
	): Promise<void> {
		const sessionId = req.headers["mcp-session-id"] as string | undefined;

		const session = sessionId ? this.sessions.get(sessionId) : undefined;
		if (session) {
			await session.transport.handleRequest(req, res);
			return;
		}

		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: () => crypto.randomUUID(),
		});

		const server = this.createMcpServer();

		await server.connect(transport);
		await transport.handleRequest(req, res);

		const newSessionId = transport.sessionId;
		if (newSessionId) {
			this.sessions.set(newSessionId, { server, transport });

			transport.onclose = () => {
				this.sessions.delete(newSessionId);
			};
		}
	}

	/**
	 * 关闭所有 session
	 */
	async close(): Promise<void> {
		this.closing = true;
		const sessions = Array.from(this.sessions.entries());
		this.sessions.clear();

		for (const [, session] of sessions) {
			await session.transport.close();
			await session.server.close();
		}
	}
}
