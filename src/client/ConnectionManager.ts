/**
 * 连接管理器 - 管理客户端与服务器的连接、重连逻辑
 */

import * as fs from 'fs';
import { ServerConnection } from './ServerConnection';
import { NotificationManager } from './NotificationManager';
import type { TaskMessage } from '../shared/protocol';
import type { DebugLogEntry } from '../shared/types';
import { StateFile } from '../shared/stateFile';
import { StateUtils } from '../shared/types';
import {
  RECONNECT_INITIAL_DELAY,
  RECONNECT_MAX_DELAY,
  RECONNECT_MULTIPLIER,
  RECONNECT_MAX_ATTEMPTS
} from '../shared/constants';
import Config from './Config';
import type { DebugLogStore } from './debug/DebugLogStore';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * 连接状态变更回调
 */
export type ConnectionStateCallback = (state: ConnectionState, port?: number) => void;

/**
 * 等待指定时间
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 连接管理器
 */
export class ConnectionManager {
  private state: ConnectionState = 'disconnected';
  private port: number;
  private reconnectAttempts: number = 0;
  private statusWatcher: fs.FSWatcher | null = null;
  private connection: ServerConnection | null = null;
  private stateCallback: ConnectionStateCallback | null = null;
  private isReconnecting: boolean = false;
  private shouldStop: boolean = false;
  private debugLogStore: DebugLogStore | null = null;

  constructor(
    private stateFile: StateFile,
    private notifications: NotificationManager,
    private onTaskCallback: (task:TaskMessage) => Promise<unknown>,
    initialPort: number,
    debugLogStore?: DebugLogStore
  ) {
    this.port = initialPort;
    this.debugLogStore = debugLogStore || null;
  }

  /**
   * 设置状态变更回调
   */
  onStateChange(callback: ConnectionStateCallback): void {
    this.stateCallback = callback;
  }

  /**
   * 获取当前连接状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 获取当前连接
   */
  getConnection(): ServerConnection | null {
    return this.connection;
  }

  /**
   * 更新状态并通知
   */
  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateCallback?.(state, this.port);
  }

  /**
   * 连接到服务器
   */
  async connect(): Promise<boolean> {
    if (this.state === 'connected') {
      return true;
    }

    this.setState('connecting');

    try {
      this.connection = new ServerConnection(this.port);
      await this.connection.connect();
      this.connection.onTask(this.wrapTaskCallback());
      this.setState('connected');
      this.reconnectAttempts = 0;
      this.stopStatusWatching();
      this.notifications.show('connected');
      
      // 监听连接关闭
      this.setupCloseHandler();
      
      return true;
    } catch (err) {
      this.setState('disconnected');
      this.connection = null;
      return false;
    }
  }

  /**
   * 设置连接关闭处理
   */
  private setupCloseHandler(): void {
    if (!this.connection) {return;}
    this.connection.onClose(() => this.handleDisconnect());
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(): void {
    if (this.state === 'disconnected') {return;}
    
    this.setState('disconnected');
    this.connection = null;
    this.notifications.show('disconnected');
    
    if (!this.shouldStop) {
      this.startReconnect();
    }
  }

  /**
   * 开始重连流程
   */
  async startReconnect(): Promise<void> {
    if (this.isReconnecting || this.state === 'connected') {
      return;
    }

    this.isReconnecting = true;
    this.shouldStop = false;
    this.setState('reconnecting');
    this.startStatusWatching();
    this.notifications.show('reconnecting');

    while (this.reconnectAttempts < RECONNECT_MAX_ATTEMPTS && !this.shouldStop) {
      const delay = Math.min(
        RECONNECT_INITIAL_DELAY * Math.pow(RECONNECT_MULTIPLIER, this.reconnectAttempts),
        RECONNECT_MAX_DELAY
      );

      await sleep(delay);
      
      if (this.shouldStop) {break;}
      
      this.reconnectAttempts++;

      const success = await this.connect();
      if (success) {
        this.isReconnecting = false;
        return;
      }
    }

    this.isReconnecting = false;
    this.setState('disconnected');
    this.notifications.show('reconnectFailed');
  }

  /**
   * 停止重连
   */
  stopReconnect(): void {
    this.shouldStop = true;
    this.isReconnecting = false;
  }

  /**
   * 手动重连
   */
  async manualReconnect(): Promise<void> {
    if (this.state === 'connected' || this.isReconnecting) {
      return;
    }

    this.reconnectAttempts = 0;
    this.shouldStop = false;
    
    const success = await this.connect();
    if (!success) {
      this.notifications.show('reconnectFailed');
    }
  }

  /**
   * 开始监听状态文件
   */
  private startStatusWatching(): void {
    if (this.statusWatcher) {return;}

    const stateFilePath = this.stateFile.getPath();
    
    try {
      this.statusWatcher = fs.watch(stateFilePath, async (eventType) => {
        if (eventType === 'change') {
          await this.handleStateFileChange();
        }
      });
    } catch {
      // 文件可能不存在，忽略
    }
  }

  /**
   * 停止监听状态文件
   */
  private stopStatusWatching(): void {
    this.statusWatcher?.close();
    this.statusWatcher = null;
  }

  /**
   * 处理状态文件变化
   */
  private async handleStateFileChange(): Promise<void> {
    const data = await this.stateFile.read();
    if (!data) { return; }
    // 端口变更
    if (StateUtils.isReady(data.state) && data.port !== this.port) {
      this.port = data.port;
      this.notifications.show('connected', `端口已变更为 ${data.port}`);
      if (this.state !== 'connected') {
        await this.connect();
      }
    }
    // 服务器重启通知
    if (StateUtils.isRestarting(data.state)) {
      this.notifications.show('serverRestarting');
    }
  }

  /**
   * 请求服务器重启
   */
  async requestServerRestart(): Promise<void> {
    if (!this.connection) {
      return;
    }
    (this.connection as any).send({ type: 'restart' });
  }

  /**
   * 更新端口
   */
  updatePort(port: number): void {
    this.port = port;
  }

  /**
   * 包装任务回调，记录调试日志
   */
  private wrapTaskCallback(): (task: TaskMessage) => Promise<unknown> {
    return async (task: TaskMessage): Promise<unknown> => {
      const startTime = Date.now();
      let success = true;
      let result: unknown;
      try {
        result = await this.onTaskCallback(task);
        return result;
      } catch (error) {
        success = false;
        result = { error: (error as Error).message };
        throw error;
      } finally {
        if (Config.getEnableDebug() && this.debugLogStore) {
          const entry: DebugLogEntry = {
            timestamp: startTime,
            tool: task.tool,
            args: task.args,
            result: JSON.stringify(result),
            duration: Date.now() - startTime,
            success
          };
          this.debugLogStore.add(entry);
        }
      }
    };
  }
  /**
   * 销毁
   */
  dispose(): void {
    this.shouldStop = true;
    this.stopStatusWatching();
    this.connection?.disconnect();
    this.connection = null;
  }
}
