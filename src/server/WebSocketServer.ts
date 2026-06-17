/**
 * WebSocketServer - Manages connections with VSCode windows
 * // CN: WebSocket 服务器 - 管理与 VSCode 窗口的连接
 */

import * as crypto from "node:crypto";
import type { Server } from "node:http";
import { WebSocket, WebSocketServer as WSServer } from "ws";
import type { ClientMessage } from "../shared/protocol";
import type { ClientRegistry } from "./ClientRegistry";
import type { ShutdownManager } from "./ShutdownManager";
import type { TaskManager } from "./TaskManager";

export class WebSocketServer {
	private wss: WSServer;
	private restartCallback: (() => void) | null = null;
	private closed = false;

	constructor(
		server: Server,
		private registry: ClientRegistry,
		private taskManager: TaskManager,
		private shutdownManager: ShutdownManager,
	) {
		this.wss = new WSServer({ server, path: "/ws" });
		this.shutdownManager.onClientDisconnected();
		this.setupHandlers();
	}

	private setupHandlers(): void {
		this.wss.on("connection", (ws: WebSocket) => {
			const windowId = `win-${crypto.randomUUID().slice(0, 8)}`;
			console.log(`[WebSocket] New connection: ${windowId}`);

			ws.on("message", (data) => {
				this.handleMessage(windowId, ws, data.toString());
			});

			ws.on("close", () => {
				console.log(`[WebSocket] Connection closed: ${windowId}`);
				this.registry.unregister(windowId);
				this.shutdownManager.onClientDisconnected();
			});

			ws.on("error", (err) => {
				console.error(`[WebSocket] Error on ${windowId}:`, err.message);
			});
		});
	}

	private handleMessage(windowId: string, ws: WebSocket, data: string): void {
		try {
			const msg = JSON.parse(data) as ClientMessage;
			switch (msg.type) {
				case "register":
					this.registry.register(windowId, ws, msg.folders);
					this.shutdownManager.onClientConnected();
					ws.send(JSON.stringify({ type: "registered", windowId }));
					break;
				case "result":
					this.taskManager.handleResult(msg.requestId, msg.data);
					break;
				case "error":
					this.taskManager.handleError(msg.requestId, msg.error);
					break;
				case "restart":
					this.handleRestart();
					break;
			}
		} catch (err) {
			console.error(
				`[WebSocket] Failed to parse message from ${windowId}:`,
				err,
			);
		}
	}

	/**
	 * Set restart callback
	 * // CN: 设置重启回调
	 */
	onRestart(callback: () => void): void {
		this.restartCallback = callback;
	}

	async close(): Promise<void> {
		if (this.closed) {
			return;
		}
		this.closed = true;

		await new Promise<void>((resolve) => {
			this.wss.clients.forEach((ws) => {
				ws.close();
			});
			this.wss.close(() => resolve());
		});
	}

	/**
	 * Handle restart request
	 * // CN: 处理重启请求
	 */
	private handleRestart(): void {
		if (this.closed) {
			return;
		}
		this.broadcast({ type: "restarting" });
		this.restartCallback?.();
	}

	/**
	 * Broadcast message to all clients
	 * // CN: 广播消息给所有客户端
	 */
	private broadcast(msg: unknown): void {
		const data = JSON.stringify(msg);
		this.wss.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(data);
			}
		});
	}
}
