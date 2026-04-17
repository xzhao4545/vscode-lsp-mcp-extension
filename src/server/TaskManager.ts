/**
 * TaskManager - Task dispatch and result collection
 * // CN: 任务管理器 - 任务分发与结果收集
 */

import { CancellationTokenSource } from "vscode-jsonrpc";
import { DEFAULT_TIMEOUT } from "../shared/constants";
import { taskRequest } from "../shared/protocol";
import type { ClientInfo } from "./ClientRegistry";

export class TaskManager {
	/**
	 * Dispatch task to specified client
	 * // CN: 分发任务到指定客户端
	 */
	async dispatch(
		client: ClientInfo,
		tool: string,
		args: Record<string, unknown>,
		timeout: number = DEFAULT_TIMEOUT,
	): Promise<unknown> {
		const tokenSource = new CancellationTokenSource();

		let timeoutHandle: NodeJS.Timeout | undefined;
		const timeoutPromise = new Promise((_, reject) => {
			timeoutHandle = setTimeout(() => {
				tokenSource.cancel();
				reject(new Error(`Task timeout after ${timeout}ms`));
			}, timeout);
		});

		// TODO: [race] Promise.race does not abort the underlying sendRequest when timeout fires - the request continues in background // CN: Promise.race 不会在超时触发时中止底层 sendRequest，请求仍在后台继续
		// TODO: [scope] CancellationToken is best-effort only - JSON-RPC request continues even after cancel() is called // CN: CancellationToken 仅提供尽力而为的取消机制 - 调用 cancel() 后 JSON-RPC 请求仍会继续执行
		try {
			console.log(
				`[TaskManager] Dispatched ${tool} to ${client.windowId}`,
			);

			// Send task in a Promise.race // CN: 在 Promise.race 中发送任务
			const result = await Promise.race([
				client.connection.sendRequest(
					taskRequest,
					{ tool, args },
					tokenSource.token
				),
				timeoutPromise
			]);

			console.log(`[TaskManager] Result received for ${client.windowId}`);
			return result;
		} catch (error) {
			console.log(
				`[TaskManager] Error received for ${client.windowId}: ${(error as Error).message}`,
			);
			throw error;
		} finally {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
			tokenSource.dispose();
		}
	}

	/**
	 * Cleanup all pending tasks
	 * // CN: 清理所有待处理任务
	 */
	cleanup(): void {
		// No longer needed as JSON-RPC handles its own pending states natively
	}
}
