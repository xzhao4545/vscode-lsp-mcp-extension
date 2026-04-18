/**
 * DebugLogStore - Manages debug log entries for tool invocations
 * // CN: 调试日志存储 - 管理工具调用的调试日志
 */

import * as vscode from "vscode";
import { MAX_DEBUG_ENTRIES } from "../../shared/constants";
import type { DebugLogEntry } from "../../shared/types";

export class DebugLogStore {
	private entries: DebugLogEntry[] = [];
	private readonly _onDidChange = new vscode.EventEmitter<void>();
	readonly onDidChange = this._onDidChange.event;

	/**
	 * Add a log entry
	 * // CN: 添加日志条目
	 */
	add(entry: DebugLogEntry): void {
		this.entries.unshift(entry);
		if (this.entries.length > MAX_DEBUG_ENTRIES) {
			this.entries.pop();
		}
		this._onDidChange.fire();
	}

	/**
	 * Get all entries
	 * // CN: 获取所有条目
	 */
	getAll(): DebugLogEntry[] {
		return this.entries;
	}

	/**
	 * Get entry by timestamp
	 * // CN: 根据时间戳获取条目
	 */
	getByTimestamp(timestamp: number): DebugLogEntry | undefined {
		return this.entries.find((e) => e.timestamp === timestamp);
	}

	/**
	 * Clear all entries
	 * // CN: 清空所有条目
	 */
	clear(): void {
		this.entries = [];
		this._onDidChange.fire();
	}

	/**
	 * Get entry count
	 * // CN: 获取条目数量
	 */
	get size(): number {
		return this.entries.length;
	}

	dispose(): void {
		this._onDidChange.dispose();
	}
}
