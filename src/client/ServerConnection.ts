/**
 * ServerConnection - Manages WebSocket connection to the MCP server
 * // CN: 服务器连接 - 管理与 MCP 服务器的 WebSocket 连接
 */

import { l10n } from "vscode";
import * as vscode from "vscode";
import WebSocket from "ws";
import type { ServerMessage, TaskMessage } from "../shared/protocol";

export class ServerConnection {
	private ws: WebSocket | null = null;
	private onTaskCallback: ((task: TaskMessage) => Promise<unknown>) | null =
		null;
	private onCloseCallback: (() => void) | null = null;

	constructor(private port: number) {}

	/**
	 * Connect to server - Establish WebSocket connection
	 * // CN: 连接到服务器
	 */
	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(`ws://localhost:${this.port}/ws`);

			this.ws.on("open", () => {
				this.register();
				resolve();
			});

			this.ws.on("message", (data) => this.handleMessage(data.toString()));
			this.ws.on("close", (code, reason) => {
				console.log(`ws closed code:${code} reason:${reason}`);
				this.handleClose();
			});
			this.ws.on("error", (error) => {
				console.log(`error ${error.message}`);
				reject();
			});
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
		this.send({ type: "register", folders });
	}

	/**
	 * Set task callback - Register callback for handling tasks from server
	 * // CN: 设置任务回调
	 */
	onTask(callback: (task: TaskMessage) => Promise<unknown>): void {
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
	 * Handle message - Process incoming WebSocket messages
	 * // CN: 处理消息
	 */
	private async handleMessage(data: string): Promise<void> {
		try {
			const msg = JSON.parse(data) as ServerMessage;
			switch (msg.type) {
				case "registered":
					console.log(`[Connection] Registered as ${msg.windowId}`);
					break;
				case "task":
					await this.executeTask(msg);
					break;
			}
		} catch (err) {
			console.error("[Connection] Failed to handle message:", err);
		}
	}

	/**
	 * Execute task - Run task received from server and send result
	 * // CN: 执行任务
	 */
	private async executeTask(msg: TaskMessage): Promise<void> {
		try {
			if (!this.onTaskCallback) {
				throw new Error(l10n.t("No task callback registered"));
			}
			const result = await this.onTaskCallback(msg);
			this.send({ type: "result", requestId: msg.requestId, data: result });
		} catch (error) {
			this.send({
				type: "error",
				requestId: msg.requestId,
				error: { message: (error as Error).stack },
			});
		}
	}

	/**
	 * Handle close - Process WebSocket connection close
	 * // CN: 连接关闭处理
	 */
	private handleClose(): void {
		console.log("[Connection] WebSocket closed");
		this.ws = null;
		this.onCloseCallback?.();
	}

	/**
	 * Send message - Send message to server via WebSocket
	 * // CN: 发送消息
	 */
	send(msg: unknown): void {
		this.ws?.send(JSON.stringify(msg));
	}

	/**
	 * Disconnect - Close the WebSocket connection
	 * // CN: 断开连接
	 */
	disconnect(): void {
		this.ws?.close();
	}
}
