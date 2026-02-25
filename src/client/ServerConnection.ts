/**
 * 服务器连接 - 管理与 MCP 服务器的 WebSocket 连接
 */

import * as vscode from 'vscode';
import WebSocket from 'ws';
import type { ServerMessage, TaskMessage } from '../shared/protocol';
import type { DebugLogEntry } from '../shared/types';
import { MAX_DEBUG_ENTRIES } from '../shared/constants';

export class ServerConnection {
  private ws: WebSocket | null = null;
  private windowId: string | null = null;
  private debugEntries: DebugLogEntry[] = [];
  private onTaskCallback: ((task: TaskMessage) => Promise<unknown>) | null = null;
  private onDebugLogCallback: (() => void) | null = null;

  constructor(private port: number) {}

  /**
   * 连接到服务器
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:${this.port}/ws`);

      this.ws.on('open', () => {
        this.register();
        resolve();
      });

      this.ws.on('message', (data) => this.handleMessage(data.toString()));
      this.ws.on('close', () => this.handleClose());
      this.ws.on('error', reject);
    });
  }
  /**
   * 注册窗口
   */
  private register(): void {
    const folders = vscode.workspace.workspaceFolders?.map(f => ({
      name: f.name,
      path: f.uri.fsPath
    })) || [];
    this.send({ type: 'register', folders });
  }

  /**
   * 设置任务回调
   */
  onTask(callback: (task: TaskMessage) => Promise<unknown>): void {
    this.onTaskCallback = callback;
  }

  /**
   * 设置调试日志回调
   */
  onDebugLog(callback: () => void): void {
    this.onDebugLogCallback = callback;
  }
  /**
   * 处理消息
   */
  private async handleMessage(data: string): Promise<void> {
    try {
      const msg = JSON.parse(data) as ServerMessage;
      switch (msg.type) {
        case 'registered':
          this.windowId = msg.windowId;
          console.log(`[Connection] Registered as ${msg.windowId}`);
          break;
        case 'task':
          await this.executeTask(msg);
          break;
        case 'debugLog':
          this.addDebugEntry(msg.entry);
          break;
      }
    } catch (err) {
      console.error('[Connection] Failed to handle message:', err);
    }
  }
  /**
   * 执行任务
   */
  private async executeTask(msg: TaskMessage): Promise<void> {
    try {
      if (!this.onTaskCallback) {
        throw new Error('No task callback registered');
      }
      const result = await this.onTaskCallback(msg);
      this.send({ type: 'result', requestId: msg.requestId, data: result });
    } catch (error) {
      this.send({
        type: 'error',
        requestId: msg.requestId,
        error: { message: (error as Error).message }
      });
    }
  }
  /**
   * 添加调试日志条目
   */
  private addDebugEntry(entry: DebugLogEntry): void {
    this.debugEntries.unshift(entry);
    if (this.debugEntries.length > MAX_DEBUG_ENTRIES) {
      this.debugEntries.pop();
    }
    this.onDebugLogCallback?.();
  }
  /**
   * 获取调试日志条目
   */
  getDebugEntries(): DebugLogEntry[] {
    return this.debugEntries;
  }
  /**
   * 清空调试日志
   */
  clearDebugEntries(): void {
    this.debugEntries = [];
    this.onDebugLogCallback?.();
  }
  /**
   * 连接关闭处理
   */
  private handleClose(): void {
    console.log('[Connection] WebSocket closed');
    this.ws = null;
    this.windowId = null;
  }
  /**
   * 发送消息
   */
  private send(msg: unknown): void {
    this.ws?.send(JSON.stringify(msg));
  }
  /**
   * 断开连接
   */
  disconnect(): void {
    this.ws?.close();
  }
}
