/**
 * NotificationManager - Manages user notifications for connection and server events
 * // CN: 通知管理器
 */

import * as vscode from "vscode";

type NotificationType = "info" | "warning" | "error";

interface NotificationConfig {
	message: string;
	type: NotificationType;
}

const NOTIFICATIONS: Record<string, NotificationConfig> = {
	connected: { message: "已连接到 MCP 服务器", type: "info" },
	disconnected: { message: "与服务器断开连接", type: "warning" },
	reconnecting: { message: "正在尝试重新连接...", type: "info" },
	reconnectFailed: { message: "重连失败，请手动重试", type: "error" },
	serverRestarting: { message: "服务器即将重启", type: "warning" },
	portConflict: { message: "端口被占用", type: "error" },
	serverError: { message: "服务器启动失败", type: "error" },
};

export type NotificationKey = keyof typeof NOTIFICATIONS;

/**
 * NotificationManager class - Handles displaying notifications to the user
 * // CN: 通知管理器类
 */
export class NotificationManager {
	/**
	 * Show notification - Displays a notification message to the user
	 * // CN: 显示通知
	 */
	show(key: NotificationKey, extra?: string): void {
		const config = NOTIFICATIONS[key];
		const message = extra ? `${config.message}: ${extra}` : config.message;

		switch (config.type) {
			case "info":
				vscode.window.showInformationMessage(message);
				break;
			case "warning":
				vscode.window.showWarningMessage(message);
				break;
			case "error":
				vscode.window.showErrorMessage(message);
				break;
		}
	}

	/**
	 * Port conflict dialog - Interactive prompt when port is already in use
	 * // CN: 端口冲突时的交互式提示
	 */
	async showPortConflictDialog(
		port: number,
	): Promise<"retry" | "change" | "cancel"> {
		const result = await vscode.window.showErrorMessage(
			`端口 ${port} 已被占用`,
			"重试",
			"更换端口",
			"取消",
		);

		switch (result) {
			case "重试":
				return "retry";
			case "更换端口":
				return "change";
			default:
				return "cancel";
		}
	}

	/**
	 * Prompt for new port - Ask user to input a new port number
	 * // CN: 让用户输入新端口
	 */
	async promptNewPort(currentPort: number): Promise<number | null> {
		const input = await vscode.window.showInputBox({
			prompt: "请输入新端口号",
			value: String(currentPort + 1),
			validateInput: (value) => {
				const port = parseInt(value, 10);
				if (Number.isNaN(port) || port < 1024 || port > 65535) {
					return "请输入 1024-65535 之间的端口号";
				}
				return null;
			},
		});

		return input ? parseInt(input, 10) : null;
	}

	/**
	 * Confirm restart - Ask user to confirm server restart
	 * // CN: 确认重启服务器
	 */
	async confirmRestart(): Promise<boolean> {
		const result = await vscode.window.showWarningMessage(
			"确定要重启 MCP 服务器吗？所有连接将断开。",
			"确定",
			"取消",
		);
		return result === "确定";
	}
}
