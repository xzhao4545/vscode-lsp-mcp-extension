import * as vscode from "vscode";
import { l10n } from "vscode";
import type { DebugLogEntry } from "../../shared";
import type { ConnectionManager } from "../ConnectionManager";
import type { DebugLogStore } from "../debug/DebugLogStore";
import type { DebugPanelProvider } from "../debug/DebugPanelProvider";
import type { NotificationManager } from "../NotificationManager";
import type { ServerManager } from "../ServerManager";

type RegisterProps = {
	connectionManager: ConnectionManager;
	serverManager: ServerManager;
	notifications: NotificationManager;
	debugLogStore: DebugLogStore;
	debugPanelProvider: DebugPanelProvider;
};

const DEBUG_DETAIL_SCHEME = "ide-lsp-mcp-debug";
const debugDetailContents = new Map<string, string>();

/**
 * Register commands
 * // CN: 注册命令
 */
export default function registerCommands(
	context: vscode.ExtensionContext,
	props: RegisterProps,
): void {
	const {
		connectionManager,
		serverManager,
		notifications,
		debugLogStore,
		debugPanelProvider,
	} = props;
	// EN: Show status // CN: 显示状态
	context.subscriptions.push(
		vscode.commands.registerCommand("ide-lsp-mcp.showStatus", () => {
			const state = connectionManager.getState();
			if (state === "connected") {
				vscode.window.showInformationMessage(
					l10n.t("MCP Server is running on port: {0}", connectionManager.getPort()),
				);
			} else {
				vscode.window.showWarningMessage(l10n.t("MCP Server is not connected"));
			}
		}),
	);

	// EN: Manual reconnect // CN: 手动重连
	context.subscriptions.push(
		vscode.commands.registerCommand("ide-lsp-mcp.reconnect", async () => {
			try {
				// EN: Try to start server first // CN: 先尝试启动服务器
				const port = await serverManager.ensureServerRunning();
				connectionManager.updatePort(port);
				await connectionManager.manualReconnect();
			} catch (error) {
				vscode.window.showErrorMessage(
					l10n.t("Reconnect failed: {0}", (error as Error).message),
				);
			}
		}),
	);

	// EN: Restart server // CN: 重启服务器
	context.subscriptions.push(
		vscode.commands.registerCommand("ide-lsp-mcp.restartServer", async () => {
			const confirmed = await notifications.confirmRestart();
			if (!confirmed) {
				return;
			}

			try {
				// EN: Request server restart // CN: 请求服务器重启
				await connectionManager?.requestServerRestart();

				// EN: Wait before restarting // CN: 等待一段时间后重新启动
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// EN: Force restart server // CN: 强制重启服务器
				const port = await serverManager.forceRestart();
				connectionManager.updatePort(port);
				await connectionManager.connect();
			} catch (error) {
				vscode.window.showErrorMessage(
					l10n.t("Restart failed: {0}", (error as Error).message),
				);
			}
		}),
	);

	// EN: Register debug panel // CN: 注册调试面板
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider(
			"ideLspMcpDebug",
			debugPanelProvider,
		),
	);
	// EN: Register virtual document provider (read-only) // CN: 注册虚拟文档提供者 (只读)
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DEBUG_DETAIL_SCHEME, {
			provideTextDocumentContent(uri: vscode.Uri): string {
				return debugDetailContents.get(uri.path) || "";
			},
		}),
	);

	context.subscriptions.push(
		vscode.window.registerTreeDataProvider(
			"ideLspMcpDebug",
			debugPanelProvider,
		),
	);

	// EN: Clear debug log // CN: 清空调试日志
	context.subscriptions.push(
		vscode.commands.registerCommand("ide-lsp-mcp.clearDebugLog", () => {
			debugLogStore.clear();
			debugDetailContents.clear();
		}),
	);

	// EN: Show debug detail // CN: 显示调试详情
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"ide-lsp-mcp.showDebugDetail",
			async (timestamp: number) => {
				const entry = debugLogStore.getByTimestamp(timestamp);
				if (!entry) {
					return;
				}
				const content = buildDebugDetailContent(entry);
				const docPath = `/${entry.tool}-${timestamp}.md`;
				debugDetailContents.set(docPath, content);
				const uri = vscode.Uri.parse(`${DEBUG_DETAIL_SCHEME}:${docPath}`);
				const doc = await vscode.workspace.openTextDocument(uri);
				await vscode.window.showTextDocument(doc, { preview: true });
			},
		),
	);
}

/**
 * Build debug detail content
 * // CN: 构建调试详情内容
 */
function buildDebugDetailContent(entry: DebugLogEntry): string {
	const time = new Date(entry.timestamp);
	const timeStr = time.toLocaleString();
	let result = entry.result;
	try {
		result = JSON.stringify(JSON.parse(entry.result), null, 2);
	} catch {
		/* EN: Keep original // CN: 保持原样 */
	}
	return `# Input Parameters

- **Tool**: ${entry.tool}
- **Time**: ${timeStr}
- **Duration**: ${entry.duration}ms
- **Status**: ${
		entry.success ? `✓ Success` : `✗ Failed`
	}

\`\`\`json
${JSON.stringify(entry.args, null, 2)}
\`\`\`

---

# Output Result

${result}
`;
}
