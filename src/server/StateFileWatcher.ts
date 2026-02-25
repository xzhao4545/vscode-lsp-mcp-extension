/**
 * 状态文件监听器 - 服务器端监听状态文件变化
 */

import * as fs from 'fs';
import { StateFile } from '../shared/stateFile';
import { StateUtils } from '../shared/types';

/**
 * 状态文件监听器
 */
export class StateFileWatcher {
  private watcher: fs.FSWatcher | null = null;
  private myStartTime: number;

  constructor(
    private stateFile: StateFile,
    private onShouldShutdown: () => void
  ) {
    this.myStartTime = Date.now();
  }

  /**
   * 开始监听
   */
  start(): void {
    const stateFilePath = this.stateFile.getPath();

    try {
      this.watcher = fs.watch(stateFilePath, async (eventType) => {
        if (eventType === 'change') {
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
    try {
      const data = await this.stateFile.read();
      if (!data) { return; }
      // 情况1: 状态为 stopped，应关闭
      if (StateUtils.isStopped(data.state)) {
        this.onShouldShutdown();
        return;
      }
      // 情况2: 有更新的服务器启动了
      if (StateUtils.isReady(data.state) && data.startTime > this.myStartTime) {
        this.onShouldShutdown();
        return;
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
