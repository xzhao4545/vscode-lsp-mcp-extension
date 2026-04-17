/**
 * IpcServer - Manages IPC connections with VSCode windows using Domain Sockets (Named Pipes)
 * // CN: IPC 服务器 - 使用域套接字(命名管道)管理与 VSCode 窗口的连接
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import {
	createMessageConnection,
	StreamMessageReader,
	StreamMessageWriter,
	type MessageConnection,
} from "vscode-jsonrpc/node";
import { registerNotification, restartNotification, registeredNotification } from "../shared/protocol";
import type { ClientRegistry } from "./ClientRegistry";
import type { ShutdownManager } from "./ShutdownManager";
import type { TaskManager } from "./TaskManager";

export class IpcServer {
	private server: net.Server;
	private restartCallback: (() => void) | null = null;
	private closed = false;
	private clients = new Set<MessageConnection>();

	constructor(
		private registry: ClientRegistry,
		private taskManager: TaskManager,
		private shutdownManager: ShutdownManager,
	) {
		this.server = net.createServer((socket) => this.handleConnection(socket));

		this.server.on("error", (err) => {
			console.error(`[IPC Server] Error:`, err);
		});

		this.shutdownManager.onClientDisconnected();
	}

	/**
	 * Listen on the IPC path
	 * // CN: 在 IPC 路径上监听
	 */
	listen(pipePath: string, callback?: () => void): void {
		try {
			if (!pipePath.startsWith("\\\\.\\pipe\\") && fs.existsSync(pipePath)) {
				fs.unlinkSync(pipePath);
			}
		} catch (err) {
			console.error(`[IPC Server] Failed to unlink stale socket:`, err);
		}

		this.server.listen(pipePath, () => {
			console.log(`[IPC Server] Listening on ${pipePath}`);
			if (callback) {
				callback();
			}
		});
	}

	private handleConnection(socket: net.Socket): void {
		const windowId = `win-${crypto.randomUUID().slice(0, 8)}`;
		console.log(`[IPC Server] New connection: ${windowId}`);

		const connection = createMessageConnection(
			new StreamMessageReader(socket),
			new StreamMessageWriter(socket),
		);

		this.clients.add(connection);

		// Handle registration
		connection.onNotification(registerNotification, (params) => {
			this.registry.register(windowId, connection, params.folders);
			this.shutdownManager.onClientConnected();
			connection.sendNotification(registeredNotification, { windowId }).catch(console.error);
		});

		// Handle restart requests
		connection.onNotification(restartNotification, () => {
			this.handleRestart();
		});

		connection.onClose(() => {
			console.log(`[IPC Server] Connection closed: ${windowId}`);
			this.registry.unregister(windowId);
			this.shutdownManager.onClientDisconnected();
			this.clients.delete(connection);
		});

		connection.onError((err) => {
			console.error(`[IPC Server] Error on ${windowId}:`, err);
			connection.dispose();
			this.clients.delete(connection);
		});

		connection.listen();
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

		// Close all active connections
		for (const client of this.clients) {
			client.dispose();
		}
		this.clients.clear();

		await new Promise<void>((resolve, reject) => {
			this.server.close((err) => {
				if (err && (err as any).code !== "ERR_SERVER_NOT_RUNNING") {
					console.error("[IPC Server] Error closing server:", err);
				}
				resolve();
			});
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
		// In a full implementation, you can broadcast `restartingNotification` here to all clients
		this.restartCallback?.();
	}
}
