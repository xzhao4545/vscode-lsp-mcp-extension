/**
 * ServerConnection - Manages stdio connection to the MCP server
 * // CN: ServerConnection - 管理与 MCP 服务器的 stdio 连接
 *
 * This class replaces the old socket-based connection. Communication
 * flows over stdin/stdout pipes instead of a Unix domain socket.
 * // CN: 此类替换旧的基于套接字的连接。通信通过 stdin/stdout 管道而不是 Unix 域套接字进行。
 */

import { l10n } from "vscode";
import * as vscode from "vscode";
import {
	createMessageConnection,
	StreamMessageReader,
	StreamMessageWriter,
	type MessageConnection,
} from "vscode-jsonrpc/node";
import {
	registerNotification,
	registeredNotification,
	taskRequest,
	restartNotification,
} from "../shared/protocol";

/**
 * StdioConnection - Connection via stdin/stdout pipes
 * // CN: StdioConnection - 通过 stdin/stdout 管道的连接
 */
export class ServerConnection {
	private connection: MessageConnection | null = null;
	private onTaskCallback:
		| ((tool: string, args: Record<string, unknown>, token: vscode.CancellationToken) => Promise<unknown>)
		| null = null;
	private onCloseCallback: (() => void) | null = null;

	/**
	 * Constructor - Takes stdin and stdout streams from child process
	 * // CN: 构造函数 - 接收子进程的 stdin 和 stdout 流
	 */
	constructor(
		private stdin: NodeJS.WritableStream,
		private stdout: NodeJS.ReadableStream,
	) {}

	/**
	 * Connect to server - Establish IPC JSON-RPC connection via stdio
	 * // CN: 连接到服务器 - 通过 stdio 建立 IPC JSON-RPC 连接
	 */
	async connect(): Promise<void> {
		// TODO: [scope] No timeout handling on client side - request can hang indefinitely if server doesn't respond // CN: 客户端没有超时处理 - 如果服务器不响应，请求可能会无限挂起

		// EN: Create JSON-RPC connection using stdio streams // CN: 使用 stdio 流创建 JSON-RPC 连接
		this.connection = createMessageConnection(
			new StreamMessageReader(this.stdout),
			new StreamMessageWriter(this.stdin),
		);

		// EN: Setup notification and request handlers // CN: 设置通知和请求处理程序
		this.setupJsonRpc();

		// EN: Send registration to server // CN: 向服务器发送注册
		this.register();

		// EN: Start listening for messages // CN: 开始监听消息
		this.connection.listen();
	}

	/**
	 * Setup JSON-RPC handlers
	 * // CN: 设置 JSON-RPC 处理程序
	 */
	private setupJsonRpc(): void {
		if (!this.connection) {
			return;
		}

		// EN: Handle registered confirmation from server // CN: 处理来自服务器的注册确认
		this.connection.onNotification(registeredNotification, (params) => {
			console.log(`[Connection] Registered as ${params.windowId}`);
		});

		// EN: Handle task requests from server // CN: 处理来自服务器的任务请求
		this.connection.onRequest(taskRequest, async (params, token) => {
			if (!this.onTaskCallback) {
				throw new Error(l10n.t("No task callback registered"));
			}
			// EN: Pass cancellation token to callback // CN: 将取消令牌传递给回调
			return await this.onTaskCallback(params.tool, params.args, token);
		});

		// EN: Handle connection close // CN: 处理连接关闭
		this.connection.onClose(() => {
			console.log("[Connection] IPC closed via stdio");
			this.handleClose();
		});

		// EN: Handle connection errors // CN: 处理连接错误
		this.connection.onError((err) => {
			console.log(`[Connection] IPC error: ${JSON.stringify(err)}`);
			this.handleClose();
		});
	}

	/**
	 * Register window - Send workspace folders to server for registration
	 * // CN: 注册窗口
	 */
	private register(): void {
		const folders =
			vscode.workspace.workspaceFolders?.map((f) => ({
				name: f.name,
				path: f.uri.fsPath,
			})) || [];

		this.connection?.sendNotification(registerNotification, { folders }).catch(console.error);
	}

	/**
	 * Set task callback - Register callback for handling tasks from server
	 * // CN: 设置任务回调
	 */
	onTask(
		callback: (tool: string, args: Record<string, unknown>, token: vscode.CancellationToken) => Promise<unknown>,
	): void {
		this.onTaskCallback = callback;
	}

	/**
	 * Set close callback - Register callback for connection close events
	 * // CN: 设置连接关闭回调
	 */
	onClose(callback: () => void): void {
		this.onCloseCallback = callback;
	}

	/**
	 * Handle close - Clean up resources on connection close
	 * // CN: 处理关闭 - 关闭时清理资源
	 */
	private handleClose(): void {
		console.log("[Connection] IPC stdio closed");
		this.connection?.dispose();
		this.connection = null;
		this.onCloseCallback?.();
	}

	/**
	 * Send Restart request - Notify server to restart
	 * // CN: 发送重启请求
	 */
	sendRestart(): void {
		this.connection?.sendNotification(restartNotification).catch(console.error);
	}

	/**
	 * Disconnect - Close the stdio connection
	 * // CN: 断开连接
	 */
	disconnect(): void {
		this.handleClose();
	}
}