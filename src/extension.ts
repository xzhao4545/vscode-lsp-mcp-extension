/**
 * IDE-LSP for MCP - VSCode extension entry point
 * // CN: IDE-LSP for MCP - VSCode 扩展入口
 */

import * as vscode from "vscode";
import { l10n } from "vscode";
import {
	ConnectionManager,
	type ConnectionState,
} from "./client/ConnectionManager";
import registerCommands from "./client/commands";
import { DebugLogStore } from "./client/debug/DebugLogStore";
import { DebugPanelProvider } from "./client/debug/DebugPanelProvider";
import { NotificationManager } from "./client/NotificationManager";
import { ServerManager } from "./client/ServerManager";
import { TaskExecutor } from "./client/TaskExecutor";

let serverManager: ServerManager;
let connectionManager: ConnectionManager;
let taskExecutor: TaskExecutor;
let statusBarItem: vscode.StatusBarItem;
let notifications: NotificationManager;
let debugLogStore: DebugLogStore;
let debugPanelProvider: DebugPanelProvider;

export async function activate(context: vscode.ExtensionContext) {
	console.log("[Extension] IDE-LSP for MCP is activating...");
	// EN: Initialize components // CN: 初始化组件
	notifications = new NotificationManager();
	serverManager = new ServerManager(context, notifications);
	taskExecutor = new TaskExecutor();
	debugLogStore = new DebugLogStore();
	debugPanelProvider = new DebugPanelProvider(debugLogStore);
	// EN: Create status bar // CN: 创建状态栏
	statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		100,
	);
	context.subscriptions.push(statusBarItem);
	updateStatusBar("disconnected");
	statusBarItem.show();
	// EN: Create connection manager (default port, will update later) // CN: 创建连接管理器(使用默认端口，后续更新)
	connectionManager = new ConnectionManager(
		serverManager.getStateFile(),
		notifications,
		taskExecutor.executeWithFormat.bind(taskExecutor),
		0, // EN: Port to be determined // CN: 端口待确定
		debugLogStore,
	);
	// EN: Set server manager for stdio stream access // CN: 设置服务器管理器以访问 stdio 流
	connectionManager.setServerManager(serverManager);
	// EN: Listen for connection state changes // CN: 监听连接状态变化
	connectionManager.onStateChange((state, port) => {
		updateStatusBar(state, port);
	});
	// EN: Register commands // CN: 注册命令
	registerCommands(context, {
		connectionManager,
		serverManager,
		notifications,
		debugLogStore,
		debugPanelProvider,
	});
	// EN: Start server and connect // CN: 启动服务器并连接
	try {
		const port = await serverManager.ensureServerRunning();
		connectionManager.updatePort(port);
		await connectionManager.connect();
	} catch (error) {
		console.error("[Extension] Failed to start:", error);
		vscode.window.showWarningMessage(
			l10n.t("MCP Server: {0}", (error as Error).message),
		);
	}
}

/**
 * Update status bar display
 * // CN: 更新状态栏
 */
function updateStatusBar(state: ConnectionState, port?: number): void {
	switch (state) {
		case "connected":
			statusBarItem.text = "$(check) MCP";
			statusBarItem.tooltip = l10n.t("Connected - Port {0}", port || "");
			statusBarItem.command = "ide-lsp-mcp.showStatus";
			statusBarItem.backgroundColor = undefined;
			break;
		case "disconnected":
			statusBarItem.text = "$(error) MCP";
			statusBarItem.tooltip = l10n.t("Disconnected - Click to reconnect");
			statusBarItem.command = "ide-lsp-mcp.reconnect";
			statusBarItem.backgroundColor = new vscode.ThemeColor(
				"statusBarItem.errorBackground",
			);
			break;
		case "connecting":
		case "reconnecting":
			statusBarItem.text = "$(sync~spin) MCP";
			statusBarItem.tooltip = l10n.t("Connecting...");
			statusBarItem.command = undefined;
			statusBarItem.backgroundColor = new vscode.ThemeColor(
				"statusBarItem.warningBackground",
			);
			break;
	}
}

export function deactivate() {
	console.log("[Extension] IDE-LSP for MCP is deactivating...");
	connectionManager?.dispose();
}
