/**
 * NotificationManager - Manages user notifications for connection and server events
 * // CN: 通知管理器
 */

import { l10n, window } from "vscode";

type NotificationType = "info" | "warning" | "error";

interface NotificationConfig {
	messageKey: string;
	type: NotificationType;
}

const NOTIFICATIONS: Record<string, NotificationConfig> = {
	connected: { messageKey: "Connected to MCP server", type: "info" },
	disconnected: { messageKey: "Disconnected from server", type: "warning" },
	reconnecting: { messageKey: "Attempting to reconnect...", type: "info" },
	reconnectFailed: {
		messageKey: "Reconnect failed, please retry manually",
		type: "error",
	},
	serverRestarting: { messageKey: "Server is restarting", type: "warning" },
	portConflict: { messageKey: "Port {0} is already in use", type: "error" },
	serverError: { messageKey: "Server startup failed", type: "error" },
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
		const message = l10n.t(config.messageKey);
		const fullMessage = extra ? `${message}: ${extra}` : message;

		switch (config.type) {
			case "info":
				window.showInformationMessage(fullMessage);
				break;
			case "warning":
				window.showWarningMessage(fullMessage);
				break;
			case "error":
				window.showErrorMessage(fullMessage);
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
		const result = await window.showErrorMessage(
			l10n.t("Port {0} is already in use", port),
			l10n.t("Retry"),
			l10n.t("Change port"),
			l10n.t("Cancel"),
		);

		switch (result) {
			case "Retry":
				return "retry";
			case "Change port":
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
		const input = await window.showInputBox({
			prompt: l10n.t("Enter new port number"),
			value: String(currentPort + 1),
			validateInput: (value) => {
				const port = parseInt(value, 10);
				if (Number.isNaN(port) || port < 1024 || port > 65535) {
					return l10n.t("Port must be between 1024-65535");
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
		const result = await window.showWarningMessage(
			l10n.t(
				"Are you sure you want to restart MCP server? All connections will be disconnected.",
			),
			l10n.t("Confirm"),
			l10n.t("Cancel"),
		);
		return result === l10n.t("Confirm");
	}
}
