/**
 * JSON-RPC over IPC message protocol definitions
 * // CN: 基于 IPC 的 JSON-RPC 消息协议定义
 */

import { NotificationType, RequestType } from "vscode-jsonrpc/node";
import type { Folder } from "./types";

// ============ Window → Server Messages ============
// EN: 窗口 → 服务器 消息

/** Register message // CN: 注册消息 */
export const registerNotification = new NotificationType<{ folders: Folder[] }>("register");

/** Restart request message // CN: 重启请求消息 */
export const restartNotification = new NotificationType<void>("restart");

// ============ Server → Window Messages ============
// EN: 服务器 → 窗口 消息

/** Registration confirmation message // CN: 注册确认消息 */
export const registeredNotification = new NotificationType<{ windowId: string }>("registered");

/** Task dispatch message // CN: 任务下发消息 */
export const taskRequest = new RequestType<{ tool: string, args: Record<string, unknown> }, unknown, Error>("task");

