/**
 * DebugPanelProvider - TreeDataProvider implementation for debug panel
 * // CN: 调试面板 - TreeDataProvider 实现
 */

import * as vscode from "vscode";
import type { DebugLogEntry } from "../../shared/types";
import type { DebugLogStore } from "./DebugLogStore";

export class DebugLogItem extends vscode.TreeItem {
	constructor(public readonly entry: DebugLogEntry) {
		const time = new Date(entry.timestamp);
		const timeStr =
			time.toTimeString().split(" ")[0] +
			"." +
			String(time.getMilliseconds()).padStart(3, "0");

		super(`${timeStr} ${entry.tool}`, vscode.TreeItemCollapsibleState.None);

		this.description = `${entry.duration}ms ${entry.success ? "✓" : "✗"}`;
		this.tooltip = this.buildTooltip();
		this.iconPath = new vscode.ThemeIcon(
			entry.success ? "pass" : "error",
			entry.success
				? new vscode.ThemeColor("testing.iconPassed")
				: new vscode.ThemeColor("testing.iconFailed"),
		);
		this.contextValue = "debugLogEntry";

		// EN: Double-click to open details // CN: 双击打开详情
		this.command = {
			command: "ide-lsp-mcp.showDebugDetail",
			title: "View Details", // CN: 查看详情
			arguments: [entry.timestamp],
		};
	}

	private buildTooltip(): vscode.MarkdownString {
		const md = new vscode.MarkdownString();
		md.appendMarkdown(`**Tool**: ${this.entry.tool}\n\n`); // EN: 工具
		md.appendMarkdown(`**Duration**: ${this.entry.duration}ms\n\n`); // EN: 耗时
		md.appendMarkdown(`**Status**: ${this.entry.success ? "Success" : "Failed"}\n\n`); // EN: 状态
		md.appendMarkdown(
			`**Args**: \`${JSON.stringify(this.entry.args).slice(0, 100)}...\``,
		);
		return md;
	}
}

export class DebugPanelProvider
	implements vscode.TreeDataProvider<DebugLogItem>
{
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<
		DebugLogItem | undefined
	>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(private store: DebugLogStore) {
		store.onDidChange(() => this.refresh());
	}

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: DebugLogItem): vscode.TreeItem {
		return element;
	}

	getChildren(): DebugLogItem[] {
		return this.store.getAll().map((entry) => new DebugLogItem(entry));
	}

	dispose(): void {
		this._onDidChangeTreeData.dispose();
	}
}
