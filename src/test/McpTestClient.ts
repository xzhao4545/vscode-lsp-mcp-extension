/**
 * MCP 测试客户端
 *
 * 使用官方 @modelcontextprotocol/sdk 连接 MCP 服务器，用于集成测试。
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_SERVER_URL = "http://127.0.0.1:53221/mcp";
const SERVER_START_TIMEOUT = 10000;
const SERVER_POLL_INTERVAL = 200;
const MCP_TOOL_PREFIX = "IDE-";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface McpToolResult {
	content: string;
	isError: boolean;
}

export interface TestCase {
	name: string;
	args: Record<string, unknown>;
	expectedFile: string;
}

export function toServerToolName(toolName: string): string {
	return toolName.startsWith(MCP_TOOL_PREFIX)
		? toolName
		: `${MCP_TOOL_PREFIX}${toolName}`;
}

export class McpTestClient {
	private client: Client;
	private transport: StreamableHTTPClientTransport | null = null;

	constructor() {
		this.client = new Client({
			name: "mcp-test-client",
			version: "1.0.0",
		});

		this.client.onerror = (error) => {
			console.error("MCP Client error:", error);
		};
	}

	/**
	 * 检查服务器是否运行
	 */
	async isServerRunning(): Promise<boolean> {
		try {
			const response = await fetch("http://127.0.0.1:53221/health", {
				signal: AbortSignal.timeout(2000),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * 连接到 MCP 服务器
	 */
	async connect(): Promise<void> {
		const start = Date.now();
		while (!(await this.isServerRunning())) {
			if (Date.now() - start >= SERVER_START_TIMEOUT) {
				throw new Error(
					`MCP server did not become ready within ${SERVER_START_TIMEOUT}ms`,
				);
			}
			await sleep(SERVER_POLL_INTERVAL);
		}

		this.transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL));
		await this.client.connect(this.transport);
		console.log("Connected to MCP server");
	}

	/**
	 * 断开连接
	 */
	async disconnect(): Promise<void> {
		await this.client.close();
		this.transport = null;
		console.log("Disconnected from MCP server");
	}

	/**
	 * 调用 MCP 工具
	 */
	async callTool(
		toolName: string,
		args: Record<string, unknown>,
	): Promise<McpToolResult> {
		const serverToolName = toServerToolName(toolName);
		console.log(
			`Calling tool: ${serverToolName}, args: ${JSON.stringify(args).substring(0, 500)}...`,
		);

		try {
			const result = await this.client.callTool({
				name: serverToolName,
				arguments: args,
			});

			// 提取文本内容
			const contentArray = result.content as Array<{
				type: string;
				text?: string;
			}>;
			const textContent =
				contentArray
					?.filter((item) => item.type === "text")
					?.map((item) => item.text)
					?.join("\n") || JSON.stringify(result.content);

			return {
				content: textContent,
				isError: !!result.isError,
			};
		} catch (error) {
			return {
				content: error instanceof Error ? error.message : String(error),
				isError: true,
			};
		}
	}
}
