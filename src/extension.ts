/**
 * IDE-LSP for MCP - VSCode 扩展入口
 */

import * as vscode from 'vscode';
import * as l10n from '@vscode/l10n';
import { ServerManager } from './client/ServerManager';
import { TaskExecutor } from './client/TaskExecutor';
import { ConnectionManager, ConnectionState } from './client/ConnectionManager';
import { NotificationManager } from './client/NotificationManager';

let serverManager: ServerManager;
let connectionManager: ConnectionManager;
let taskExecutor: TaskExecutor;
let statusBarItem: vscode.StatusBarItem;
let notifications: NotificationManager;

export async function activate(context: vscode.ExtensionContext) {
  console.log('[Extension] IDE-LSP for MCP is activating...');
  // 初始化组件
  notifications = new NotificationManager();
  serverManager = new ServerManager(context, notifications);
  taskExecutor = new TaskExecutor();
  // 创建状态栏
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(statusBarItem);
  updateStatusBar('disconnected');
  statusBarItem.show();
  // 创建连接管理器(使用默认端口，后续更新)
  connectionManager = new ConnectionManager(
    serverManager.getStateFile(),
    notifications,
    taskExecutor.executeWithFormat.bind(taskExecutor),
    0  // 端口待确定
  );
  // 监听连接状态变化
  connectionManager.onStateChange((state, port) => {
    updateStatusBar(state, port);
  });
  // 注册命令
  registerCommands(context);
  // 启动服务器并连接
  try {
    const port = await serverManager.ensureServerRunning();
    connectionManager.updatePort(port);
    await connectionManager.connect();
  } catch (error) {
    console.error('[Extension] Failed to start:', error);
    vscode.window.showWarningMessage(l10n.t('MCP Server: {0}', (error as Error).message));
  }
}

/**
 * 更新状态栏
 */
function updateStatusBar(state: ConnectionState, port?: number): void {
  switch (state) {
    case 'connected':
      statusBarItem.text = '$(check) MCP';
      statusBarItem.tooltip = l10n.t('已连接 - 端口 {0}', port || '');
      statusBarItem.command = 'ide-lsp-mcp.showStatus';
      statusBarItem.backgroundColor = undefined;
      break;
    case 'disconnected':
      statusBarItem.text = '$(error) MCP';
      statusBarItem.tooltip = l10n.t('未连接 - 点击重连');
      statusBarItem.command = 'ide-lsp-mcp.reconnect';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      break;
    case 'connecting':
    case 'reconnecting':
      statusBarItem.text = '$(sync~spin) MCP';
      statusBarItem.tooltip = l10n.t('正在连接...');
      statusBarItem.command = undefined;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      break;
  }
}

/**
 * 注册命令
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // 显示状态
  context.subscriptions.push(
    vscode.commands.registerCommand('ide-lsp-mcp.showStatus', () => {
      const state = connectionManager?.getState();
      if (state === 'connected') {
        vscode.window.showInformationMessage(l10n.t('MCP 服务器运行中'));
      } else {
        vscode.window.showWarningMessage(l10n.t('MCP 服务器未连接'));
      }
    })
  );

  // 手动重连
  context.subscriptions.push(
    vscode.commands.registerCommand('ide-lsp-mcp.reconnect', async () => {
      try {
        // 先尝试启动服务器
        const port = await serverManager.ensureServerRunning();
        connectionManager.updatePort(port);
        await connectionManager.manualReconnect();
      } catch (error) {
        vscode.window.showErrorMessage(l10n.t('重连失败: {0}', (error as Error).message));
      }
    })
  );

  // 重启服务器
  context.subscriptions.push(
    vscode.commands.registerCommand('ide-lsp-mcp.restartServer', async () => {
      const confirmed = await notifications.confirmRestart();
      if (!confirmed) {return;}

      try {
        // 请求服务器重启
        await connectionManager?.requestServerRestart();
        
        // 等待一段时间后重新启动
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 强制重启服务器
        const port = await serverManager.forceRestart();
        connectionManager.updatePort(port);
        await connectionManager.connect();
      } catch (error) {
        vscode.window.showErrorMessage(l10n.t('重启失败: {0}', (error as Error).message));
      }
    })
  );
}

export function deactivate() {
  console.log('[Extension] IDE-LSP for MCP is deactivating...');
  connectionManager?.dispose();
}
