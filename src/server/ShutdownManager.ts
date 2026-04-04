/**
 * 关闭管理器 - 服务器自动关闭逻辑
 */

import { SHUTDOWN_DELAY } from "../shared/constants";
import type { ClientRegistry } from "./ClientRegistry";

export class ShutdownManager {
	private shutdownTimer: NodeJS.Timeout | null = null;

	constructor(
		private registry: ClientRegistry,
		private onIdle: () => void | Promise<void>,
	) {}

	/**
	 * 客户端断开连接时调用
	 */
	onClientDisconnected(): void {
		if (this.registry.size === 0) {
			this.scheduleShutdown();
		}
	}

	/**
	 * 客户端连接时调用
	 */
	onClientConnected(): void {
		this.cancelShutdown();
	}

	stop(): void {
		this.cancelShutdown();
	}

	/**
	 * 计划关闭
	 */
	private scheduleShutdown(): void {
		if (this.shutdownTimer) {
			return;
		}

		console.log(
			`[Shutdown] No clients connected. Shutting down in ${SHUTDOWN_DELAY / 1000}s...`,
		);

		this.shutdownTimer = setTimeout(() => {
			this.shutdownTimer = null;
			if (this.registry.size === 0) {
				void this.onIdle();
			}
		}, SHUTDOWN_DELAY);
	}

	/**
	 * 取消关闭
	 */
	private cancelShutdown(): void {
		if (this.shutdownTimer) {
			clearTimeout(this.shutdownTimer);
			this.shutdownTimer = null;
			console.log("[Shutdown] Shutdown cancelled - new client connected");
		}
	}
}
