/**
 * 服务器连接 - 管理与 MCP 服务器的 WebSocket 连接
 */

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
	 * 连接到服务器
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
				console.log(`errpr ${error.message}`);
				reject();
			});
		});
	}

	/**
	 * 注册窗口
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
	 * 设置任务回调
	 */
	onTask(callback: (task: TaskMessage) => Promise<unknown>): void {
		this.onTaskCallback = callback;
	}

	/**
	 * 设置连接关闭回调
	 */
	onClose(callback: () => void): void {
		this.onCloseCallback = callback;
	}

	/**
	 * 处理消息
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
	 * 执行任务
	 */
	private async executeTask(msg: TaskMessage): Promise<void> {
		try {
			if (!this.onTaskCallback) {
				throw new Error("No task callback registered");
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
	 * 连接关闭处理
	 */
	private handleClose(): void {
		console.log("[Connection] WebSocket closed");
		this.ws = null;
		this.onCloseCallback?.();
	}

	/**
	 * 发送消息
	 */
	send(msg: unknown): void {
		this.ws?.send(JSON.stringify(msg));
	}

	/**
	 * 断开连接
	 */
	disconnect(): void {
		this.ws?.close();
	}
}
