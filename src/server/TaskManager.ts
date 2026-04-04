/**
 * 任务管理器 - 任务分发与结果收集
 */

import * as crypto from "node:crypto";
import { DEFAULT_TIMEOUT } from "../shared/constants";
import type { ClientInfo } from "./ClientRegistry";

interface PendingTask {
	resolve: (data: unknown) => void;
	reject: (error: Error) => void;
	timeout: NodeJS.Timeout;
}

export class TaskManager {
	private pending = new Map<string, PendingTask>();

	/**
	 * 分发任务到指定客户端
	 */
	async dispatch(
		client: ClientInfo,
		tool: string,
		args: Record<string, unknown>,
		timeout: number = DEFAULT_TIMEOUT,
	): Promise<unknown> {
		const requestId = crypto.randomUUID();

		return new Promise((resolve, reject) => {
			// 设置超时
			const timeoutHandle = setTimeout(() => {
				this.pending.delete(requestId);
				reject(new Error(`Task timeout after ${timeout}ms`));
			}, timeout);

			this.pending.set(requestId, { resolve, reject, timeout: timeoutHandle });

			// 发送任务
			client.ws.send(
				JSON.stringify({
					type: "task",
					requestId,
					tool,
					args,
				}),
			);

			console.log(
				`[TaskManager] Dispatched ${tool} to ${client.windowId} (${requestId})`,
			);
		});
	}

	/**
	 * 处理成功结果
	 */
	handleResult(requestId: string, data: unknown): void {
		const task = this.pending.get(requestId);
		if (task) {
			clearTimeout(task.timeout);
			this.pending.delete(requestId);
			task.resolve(data);
			console.log(`[TaskManager] Result received for ${requestId}`);
		}
	}

	/**
	 * 处理错误
	 */
	handleError(
		requestId: string,
		error: { message: string; code?: string },
	): void {
		const task = this.pending.get(requestId);
		if (task) {
			clearTimeout(task.timeout);
			this.pending.delete(requestId);
			task.reject(new Error(error.message || "Task failed"));
			console.log(
				`[TaskManager] Error received for ${requestId}: ${error.message}`,
			);
		}
	}

	/**
	 * 清理所有待处理任务
	 */
	cleanup(): void {
		for (const [, task] of this.pending) {
			clearTimeout(task.timeout);
			task.reject(new Error("Server shutting down"));
		}
		this.pending.clear();
	}
}
