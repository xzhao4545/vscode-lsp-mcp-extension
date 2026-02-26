/**
 * WebSocket 消息协议定义
 */

import type { Folder } from './types';

// ============ 窗口 → 服务器 消息 ============

/** 注册消息 */
export interface RegisterMessage {
  type: 'register';
  folders: Folder[];
}

/** 任务结果消息 */
export interface ResultMessage {
  type: 'result';
  requestId: string;
  data: unknown;
}

/** 任务错误消息 */
export interface ErrorMessage {
  type: 'error';
  requestId: string;
  error: {
    code?: string;
    message: string;
  };
}
/** 重启请求消息 */
export interface RestartMessage {
  type: 'restart';
}

/** 窗口发送的消息类型 */
export type ClientMessage = RegisterMessage | ResultMessage | ErrorMessage | RestartMessage;

// ============ 服务器 → 窗口 消息 ============

/** 注册确认消息 */
export interface RegisteredMessage {
  type: 'registered';
  windowId: string;
}

/** 任务下发消息 */
export interface TaskMessage {
  type: 'task';
  requestId: string;
  tool: string;
  args: Record<string, unknown>;
}
/** 服务器发送的消息类型 */
export type ServerMessage = RegisteredMessage | TaskMessage;

/** 所有消息类型 */
export type Message = ClientMessage | ServerMessage;
