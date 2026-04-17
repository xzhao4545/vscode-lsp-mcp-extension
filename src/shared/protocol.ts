/**
 * WebSocket message protocol definitions
 * // CN: WebSocket 消息协议定义
 */

import type { Folder } from "./types";

// ============ Window → Server Messages ============
// EN: 窗口 → 服务器 消息

/** Register message // CN: 注册消息 */
export interface RegisterMessage {
	type: "register";
	folders: Folder[];
}

/** Task result message // CN: 任务结果消息 */
export interface ResultMessage {
	type: "result";
	requestId: string;
	data: unknown;
}

/** Task error message // CN: 任务错误消息 */
export interface ErrorMessage {
	type: "error";
	requestId: string;
	error: {
		code?: string;
		message: string;
	};
}
/** Restart request message // CN: 重启请求消息 */
export interface RestartMessage {
	type: "restart";
}

/** Messages sent from window // CN: 窗口发送的消息类型 */
export type ClientMessage =
	| RegisterMessage
	| ResultMessage
	| ErrorMessage
	| RestartMessage;

// ============ Server → Window Messages ============
// EN: 服务器 → 窗口 消息

/** Registration confirmation message // CN: 注册确认消息 */
export interface RegisteredMessage {
	type: "registered";
	windowId: string;
}

/** Task dispatch message // CN: 任务下发消息 */
export interface TaskMessage {
	type: "task";
	requestId: string;
	tool: string;
	args: Record<string, unknown>;
}
/** Messages sent from server // CN: 服务器发送的消息类型 */
export type ServerMessage = RegisteredMessage | TaskMessage;

/** All message types // CN: 所有消息类型 */
export type Message = ClientMessage | ServerMessage;
