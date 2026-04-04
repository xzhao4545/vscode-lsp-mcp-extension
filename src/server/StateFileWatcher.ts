/**
 * 状态文件监听器 - 服务器端监听状态文件变化
 */

import * as fs from "node:fs";
import type { StateFile } from "../shared/stateFile";
import type { ServerStateData } from "../shared/types";
import { StateUtils } from "../shared/types";

/**
 * 状态文件监听器
 */
export class StateFileWatcher {
	private watcher: fs.FSWatcher | null = null;
	private shuttingDown = false;

	constructor(
		private stateFile: StateFile,
		private currentState: ServerStateData,
		private onShouldShutdown: () => void | Promise<void>,
	) {}

	/**
	 * 开始监听
	 */
	start(): void {
		const stateFilePath = this.stateFile.getPath();

		try {
			this.watcher = fs.watch(stateFilePath, async (eventType) => {
				if (eventType === "change") {
					await this.checkShouldShutdown();
				}
			});
		} catch {
			// 文件可能不存在，忽略
		}
	}

	/**
	 * 检查是否应该关闭
	 */
	private async checkShouldShutdown(): Promise<void> {
		if (this.shuttingDown) {
			return;
		}

		try {
			const data = await this.stateFile.read();
			if (!data) {
				return;
			}
			if (StateUtils.isStopped(data.state)) {
				this.shuttingDown = true;
				await this.onShouldShutdown();
				return;
			}
			if (
				data.instanceId !== this.currentState.instanceId &&
				StateUtils.isRunning(data.state)
			) {
				this.shuttingDown = true;
				await this.onShouldShutdown();
			}
		} catch {
			// 文件读取失败，忽略
		}
	}

	/**
	 * 停止监听
	 */
	stop(): void {
		this.watcher?.close();
		this.watcher = null;
	}
}
