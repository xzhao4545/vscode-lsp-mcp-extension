import * as fs from "node:fs";
import {
	RECONNECT_INITIAL_DELAY,
	RECONNECT_MAX_ATTEMPTS,
	RECONNECT_MAX_DELAY,
	RECONNECT_MULTIPLIER,
} from "../shared/constants";
import type { StateFile } from "../shared/stateFile";
import type { DebugLogEntry } from "../shared/types";
import { StateUtils } from "../shared/types";
import Config from "./Config";
import type { ServerManager } from "./ServerManager";
import type { DebugLogStore } from "./debug/DebugLogStore";
import type { NotificationManager } from "./NotificationManager";
import { ServerConnection } from "./ServerConnection";
import * as vscode from "vscode";

export type ConnectionState =
	| "disconnected"
	| "connecting"
	| "connected"
	| "reconnecting";

/**
 * ConnectionStateCallback - Callback for connection state change events
 * // CN: 连接状态变更回调
 */
export type ConnectionStateCallback = (
	state: ConnectionState,
	port?: number,
) => void;

/**
 * Sleep - Wait for specified duration
 * // CN: 等待指定时间
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ConnectionManager class - Manages client-server connections
 * // CN: 连接管理器
 */
export class ConnectionManager {
	private state: ConnectionState = "disconnected";
	private port: number;
	private reconnectAttempts: number = 0;
	private statusWatcher: fs.FSWatcher | null = null;
	private connection: ServerConnection | null = null;
	private stateCallback: ConnectionStateCallback | null = null;
	private isReconnecting: boolean = false;
	private shouldStop: boolean = false;
	private debugLogStore: DebugLogStore | null = null;
	// EN: Server manager reference for accessing stdio streams // CN: 服务器管理器引用，用于访问 stdio 流
	private serverManager: ServerManager | null = null;

	constructor(
		private stateFile: StateFile,
		private notifications: NotificationManager,
		private onTaskCallback: (tool: string, args: Record<string, unknown>, token: vscode.CancellationToken) => Promise<unknown>,
		initialPort: number,
		debugLogStore?: DebugLogStore,
	) {
		this.port = initialPort;
		this.debugLogStore = debugLogStore || null;
	}

	/**
	 * Set server manager - For accessing stdio streams from child process
	 * // CN: 设置服务器管理器 - 用于访问子进程的 stdio 流
	 */
	setServerManager(manager: ServerManager): void {
		this.serverManager = manager;
	}

	/**
	 * Set state change callback - Register callback for state changes
	 * // CN: 设置状态变更回调
	 */
	onStateChange(callback: ConnectionStateCallback): void {
		this.stateCallback = callback;
	}

	/**
	 * Get current connection state
	 * // CN: 获取当前连接状态
	 */
	getState(): ConnectionState {
		return this.state;
	}

	/**
	 * Get current connection port
	 * // CN: 获取当前连接端口
	 */
	getPort(): number {
		return this.port;
	}

	/**
	 * Get current connection instance
	 * // CN: 获取当前连接
	 */
	getConnection(): ServerConnection | null {
		return this.connection;
	}

	/**
	 * Update state and notify - Set state and trigger callback
	 * // CN: 更新状态并通知
	 */
	private setState(state: ConnectionState): void {
		this.state = state;
		this.stateCallback?.(state, this.port);
	}

	/**
	 * Connect to server - Establish connection with MCP server
	 * // CN: 连接到服务器
	 */
	async connect(): Promise<boolean> {
		if (this.state === "connected") {
			return true;
		}

		this.setState("connecting");

		try {
			// EN: Get stdio streams from server process // CN: 从服务器进程获取 stdio 流
			if (!this.serverManager) {
				throw new Error("Server manager not set");
			}
			const serverProcess = this.serverManager.getServerProcess();
			if (!serverProcess || !serverProcess.stdin || !serverProcess.stdout) {
				throw new Error("Server process not available with stdio streams");
			}

			// EN: Create stdio-based connection // CN: 创建基于 stdio 的连接
			this.connection = new ServerConnection(serverProcess.stdin, serverProcess.stdout);
			await this.connection.connect();
			this.connection.onTask(this.wrapTaskCallback());
			this.setState("connected");
			this.reconnectAttempts = 0;
			this.stopStatusWatching();
			this.notifications.show("connected");

			// EN: Listen for connection close // CN: 监听连接关闭
			this.setupCloseHandler();

			return true;
		} catch {
			this.setState("disconnected");
			this.connection = null;
			return false;
		}
	}

	/**
	 * Setup close handler - Register handler for connection close
	 * // CN: 设置连接关闭处理
	 */
	private setupCloseHandler(): void {
		if (!this.connection) {
			return;
		}
		this.connection.onClose(() => this.handleDisconnect());
	}

	/**
	 * Handle disconnect - Process disconnection and start reconnect if needed
	 * // CN: 处理断开连接
	 */
	private handleDisconnect(): void {
		if (this.state === "disconnected") {
			return;
		}

		this.setState("disconnected");
		this.connection = null;
		this.notifications.show("disconnected");

		if (!this.shouldStop) {
			this.startReconnect();
		}
	}

	/**
	 * Start reconnect flow - Begin reconnection attempts
	 * // CN: 开始重连流程
	 */
	async startReconnect(): Promise<void> {
		if (this.isReconnecting || this.state === "connected") {
			return;
		}

		this.isReconnecting = true;
		this.shouldStop = false;
		this.setState("reconnecting");
		this.startStatusWatching();
		this.notifications.show("reconnecting");

		while (
			this.reconnectAttempts < RECONNECT_MAX_ATTEMPTS &&
			!this.shouldStop
		) {
			// TODO: [logic] The delay calculation has RECONNECT_MULTIPLIER but the effect is lost because startReconnect always starts from attempt 0 // CN: 延迟计算有 RECONNECT_MULTIPLIER 但效果丢失了，因为 startReconnect 总是从 attempt 0 开始
			const delay = Math.min(
				RECONNECT_INITIAL_DELAY *
					RECONNECT_MULTIPLIER ** this.reconnectAttempts,
				RECONNECT_MAX_DELAY,
			);

			await sleep(delay);

			if (this.shouldStop) {
				break;
			}

			this.reconnectAttempts++;

			const success = await this.connect();
			if (success) {
				this.isReconnecting = false;
				return;
			}
		}

		this.isReconnecting = false;
		this.setState("disconnected");
		this.notifications.show("reconnectFailed");
	}

	/**
	 * Stop reconnect - Cancel reconnection attempts
	 * // CN: 停止重连
	 */
	stopReconnect(): void {
		this.shouldStop = true;
		this.isReconnecting = false;
	}

	/**
	 * Manual reconnect - Trigger manual reconnection
	 * // CN: 手动重连
	 */
	async manualReconnect(): Promise<void> {
		if (this.state === "connected" || this.isReconnecting) {
			return;
		}

		// TODO: [logic] manualReconnect() resets reconnectAttempts to 0, losing the benefit of exponential backoff // CN: manualReconnect() 将 reconnectAttempts 重置为 0，失去了指数退避的好处
		this.reconnectAttempts = 0;
		this.shouldStop = false;

		const success = await this.connect();
		if (!success) {
			this.notifications.show("reconnectFailed");
		}
	}

	/**
	 * Start status file watching - Watch state file for changes
	 * // CN: 开始监听状态文件
	 */
	private startStatusWatching(): void {
		if (this.statusWatcher) {
			return;
		}

		const stateFilePath = this.stateFile.getPath();

		try {
			this.statusWatcher = fs.watch(stateFilePath, async (eventType) => {
				if (eventType === "change") {
					await this.handleStateFileChange();
				}
			});
		} catch {
			// EN: File may not exist, ignore // CN: 文件可能不存在，忽略
		}
	}

	/**
	 * Stop status file watching - Stop watching state file
	 * // CN: 停止监听状态文件
	 */
	private stopStatusWatching(): void {
		this.statusWatcher?.close();
		this.statusWatcher = null;
	}

	/**
	 * Handle state file change - Process changes to state file
	 * // CN: 处理状态文件变化
	 */
	private async handleStateFileChange(): Promise<void> {
		const data = await this.stateFile.read();
		if (!data) {
			return;
		}
		// EN: Port changed // CN: 端口变更
		if (StateUtils.isReady(data.state) && data.port !== this.port) {
			this.port = data.port;
			this.notifications.show("connected", `端口已变更为 ${data.port}`);
			if (this.state !== "connected") {
				await this.connect();
			}
		}
		// EN: Server restart notification // CN: 服务器重启通知
		if (StateUtils.isRestarting(data.state)) {
			this.notifications.show("serverRestarting");
		}
	}

	/**
	 * Request server restart - Send restart request to server
	 * // CN: 请求服务器重启
	 */
	async requestServerRestart(): Promise<void> {
		if (!this.connection) {
			return;
		}
		this.connection.sendRestart();
	}

	/**
	 * Update port - Update the connection port
	 * // CN: 更新端口
	 */
	updatePort(port: number): void {
		this.port = port;
	}

	/**
	 * Wrap task callback - Wrap callback to log debug information
	 * // CN: 包装任务回调，记录调试日志
	 */
	private wrapTaskCallback(): (tool: string, args: Record<string, unknown>, token: vscode.CancellationToken) => Promise<unknown> {
		return async (tool: string, args: Record<string, unknown>, token: vscode.CancellationToken): Promise<unknown> => {
			const startTime = Date.now();
			let success = true;
			let result: string = "";
			try {
				const r = await this.onTaskCallback(tool, args, token);
				result = String(r);
				return r;
			} catch (error) {
				success = false;
				result = (error as Error).stack ?? (error as Error).message;
				throw error;
			} finally {
				if (Config.getEnableDebug() && this.debugLogStore) {
					const entry: DebugLogEntry = {
						timestamp: startTime,
						tool: tool,
						args: args,
						result: result,
						duration: Date.now() - startTime,
						success,
					};
					this.debugLogStore.add(entry);
				}
			}
		};
	}
	/**
	 * Dispose - Clean up resources
	 * // CN: 销毁
	 */
	dispose(): void {
		this.shouldStop = true;
		this.stopStatusWatching();
		this.connection?.disconnect();
		this.connection = null;
	}
}
