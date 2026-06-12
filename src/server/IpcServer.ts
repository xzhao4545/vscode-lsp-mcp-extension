/**
 * StdioChannel - Manages IPC with VSCode extension via stdin/stdout
 * // CN: StdioChannel - 通过 stdin/stdout 与 VSCode 扩展进行 IPC 通信
 *
 * This class replaces the old IpcServer which used Unix domain sockets.
 * Communication now flows over stdio pipes instead of a socket file path.
 * // CN: 此类替换旧的 IpcServer，后者使用 Unix 域套接字。现在通过 stdio 管道而不是套接字文件路径进行通信。
 */

import * as crypto from "node:crypto";
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

/**
 * StdioChannel - Single stdio connection between server and extension
 * // CN: StdioChannel - 服务器和扩展之间的单个 stdio 连接
 */
export class StdioChannel {
	private connection: MessageConnection | null = null;
	private restartCallback: (() => void) | null = null;
	private closed = false;
	private windowId: string;

	constructor(
		private registry: ClientRegistry,
		private taskManager: TaskManager,
		private shutdownManager: ShutdownManager,
	) {
		// EN: Generate window ID for this connection // CN: 为此连接生成窗口 ID
		this.windowId = `win-${crypto.randomUUID().slice(0, 8)}`;

		// EN: Create MessageConnection wrapping stdin/stdout // CN: 创建包装 stdin/stdout 的 MessageConnection
		this.connection = createMessageConnection(
			new StreamMessageReader(process.stdin),
			new StreamMessageWriter(process.stdout),
		);

		// EN: Register protocol handlers // CN: 注册协议处理程序
		this.setupHandlers();
	}

	/**
	 * Setup protocol handlers for the stdio connection
	 * // CN: 设置 stdio 连接的协议处理程序
	 */
	private setupHandlers(): void {
		if (!this.connection) {
			return;
		}

		// EN: Handle workspace registration // CN: 处理工作区注册
		this.connection.onNotification(registerNotification, (params) => {
			if (!this.connection) {
				return;
			}
			// EN: Register this client with the registry // CN: 向注册表注册此客户端
			this.registry.register(this.windowId, this.connection, params.folders);
			this.shutdownManager.onClientConnected();
			// EN: Send registered confirmation // CN: 发送注册确认
			this.connection.sendNotification(registeredNotification, { windowId: this.windowId }).catch(console.error);
		});

		// EN: Handle restart requests // CN: 处理重启请求
		this.connection.onNotification(restartNotification, () => {
			this.handleRestart();
		});

		// EN: Handle connection close // CN: 处理连接关闭
		this.connection.onClose(() => {
			console.log(`[StdioChannel] Connection closed: ${this.windowId}`);
			this.registry.unregister(this.windowId);
			this.shutdownManager.onClientDisconnected();
		});

		// EN: Handle connection errors // CN: 处理连接错误
		this.connection.onError((err) => {
			console.error(`[StdioChannel] Error on ${this.windowId}:`, err);
			this.connection?.dispose();
		});
	}

	/**
	 * Start listening on stdin/stdout
	 * // CN: 开始监听 stdin/stdout
	 *
	 * Note: pipePath argument is kept for backward compatibility but ignored
	 * // CN: 注意：保留 pipePath 参数以保持向后兼容，但会被忽略
	 */
	listen(_pipePath?: string, callback?: () => void): void {
		if (!this.connection) {
			console.error("[StdioChannel] No connection to listen on");
			return;
		}

		console.log("[StdioChannel] Listening on stdin/stdout");

		// EN: Start the JSON-RPC message loop // CN: 启动 JSON-RPC 消息循环
		this.connection.listen();

		// EN: Invoke callback when ready // CN: 就绪时调用回调
		if (callback) {
			callback();
		}
	}

	/**
	 * Set restart callback - Called when restart is requested
	 * // CN: 设置重启回调 - 当收到重启请求时调用
	 */
	onRestart(callback: () => void): void {
		this.restartCallback = callback;
	}

	/**
	 * Close the stdio connection
	 * // CN: 关闭 stdio 连接
	 */
	async close(): Promise<void> {
		if (this.closed) {
			return;
		}
		this.closed = true;

		// EN: Dispose the JSON-RPC connection // CN: 释放 JSON-RPC 连接
		this.connection?.dispose();
		this.connection = null;

		console.log("[StdioChannel] Closed");
	}

	/**
	 * Handle restart request
	 * // CN: 处理重启请求
	 */
	private handleRestart(): void {
		if (this.closed) {
			return;
		}
		// EN: Trigger the restart callback // CN: 触发重启回调
		this.restartCallback?.();
	}
}

/**
 * @deprecated Alias for backward compatibility
 * // CN: 已弃用 - 为保持向后兼容的别名
 */
export const IpcServer = StdioChannel;