/**
 * ServerConnection - Manages WebSocket connection to the MCP server
 * // CN: 服务器连接 - 管理与 MCP 服务器的 WebSocket 连接
 */

import { l10n } from "vscode";
import * as vscode from "vscode";
import * as net from "node:net";
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

export class ServerConnection {
	private socket: net.Socket | null = null;
	private connection: MessageConnection | null = null;
	private onTaskCallback:
		| ((tool: string, args: Record<string, unknown>, token: vscode.CancellationToken) => Promise<unknown>)
		| null = null;
	private onCloseCallback: (() => void) | null = null;

	constructor(private pipePath: string) {}

	/**
	 * Connect to server - Establish IPC JSON-RPC connection
	 * // CN: 连接到服务器
	 */
	async connect(): Promise<void> {
		// TODO: [scope] No timeout handling on client side - request can hang indefinitely if server doesn't respond // CN: 客户端没有超时处理 - 如果服务器不响应，请求可能会无限挂起
		return new Promise((resolve, reject) => {
			this.socket = net.createConnection(this.pipePath);

			this.socket.on("connect", () => {
				this.setupJsonRpc();
				this.register();
				resolve();
			});

			this.socket.on("close", (hadError) => {
				console.log(`IPC socket closed. hadError: ${hadError}`);
				this.handleClose();
			});

			this.socket.on("error", (error) => {
				console.log(`error ${error.message}`);
				this.handleClose();
				reject(error);
			});
		});
	}

	private setupJsonRpc(): void {
		if (!this.socket) { return; }

		this.connection = createMessageConnection(
			new StreamMessageReader(this.socket),
			new StreamMessageWriter(this.socket),
		);

		this.connection.onNotification(registeredNotification, (params) => {
			console.log(`[Connection] Registered as ${params.windowId}`);
		});

		this.connection.onRequest(taskRequest, async (params, token) => {
			if (!this.onTaskCallback) {
				throw new Error(l10n.t("No task callback registered"));
			}
			// TODO: [scope] CancellationToken is passed to callback but no mechanism exists to actually use it for cancellation // CN: CancellationToken 被传递给回调，但没有机制实际使用它进行取消
			return await this.onTaskCallback(params.tool, params.args, token);
		});

		this.connection.listen();
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
	 * Handle close - Process WebSocket connection close
	 * // CN: 连接关闭处理
	 */
	private handleClose(): void {
		console.log("[Connection] IPC closed");
		this.connection?.dispose();
		this.connection = null;
		this.socket?.destroy();
		this.socket = null;
		this.onCloseCallback?.();
	}

	/**
	 * Send Restart request
	 */
	sendRestart(): void {
		this.connection?.sendNotification(restartNotification).catch(console.error);
	}

	/**
	 * Disconnect - Close the WebSocket connection
	 * // CN: 断开连接
	 */
	disconnect(): void {
		this.handleClose();
	}
}
