/**
 * 服务器管理器 - 管理服务器生命周期
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { FileLock } from '../shared/fileLock';
import { StateFile } from '../shared/stateFile';
import { NotificationManager } from './NotificationManager';
import {
  SERVER_LOCK_FILE,
  SERVER_STARTUP_TIMEOUT,
  HEALTH_CHECK_INTERVAL,
  ENV_DISABLE_AUTO_START
} from '../shared/constants';
import { StateUtils, ServerStateData } from '../shared/types';
import config from './Config';

/**
 * 等待指定时间
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class ServerManager {
  private stateFile: StateFile;
  private serverScript: string;
  private storagePath: string;
  private lockPath: string;

  constructor(
    private context: vscode.ExtensionContext,
    private notifications: NotificationManager
  ) {
    this.storagePath = context.globalStorageUri.fsPath;
    this.stateFile = new StateFile(this.storagePath);
    this.serverScript = path.join(context.extensionPath, 'dist', 'server', 'main.js');
    this.lockPath = path.join(this.storagePath, SERVER_LOCK_FILE);
  }

  /**
   * 获取状态文件实例
   */
  getStateFile(): StateFile {
    return this.stateFile;
  }

  /**
   * 确保服务器运行
   */
  async ensureServerRunning(): Promise<number> {
    // 检查环境变量是否禁用自动启动
    if (process.env[ENV_DISABLE_AUTO_START] === 'true'||!config.getAutoStart()) {
      console.log('[ServerManager] Auto-start disabled');
      const data = await this.stateFile.read();
      if (data && StateUtils.isReady(data.state) && await this.isServerAlive(data.port)) {
        return data.port;
      }
      throw new Error('Server not running and auto-start is disabled');
    }
    // 读取状态文件
    const data = await this.stateFile.read();
    if (data) {
      // 服务器已就绪，尝试连接
      if (StateUtils.isReady(data.state)) {
        if (await this.isServerAlive(data.port)) {
          console.log(`[ServerManager] Server running on port ${data.port}`);
          return data.port;
        }
        // 服务器不响应，尝试启动
      }
      // 服务器正在启动，等待就绪
      if (StateUtils.isRunning(data.state) && !StateUtils.isReady(data.state)) {
        return this.waitForServerReady(data.port);
      }
      // 有错误，处理错误状态
      if (StateUtils.hasError(data.state)) {
        await this.handleErrorState(data);
      }
    }
    // 尝试启动服务器
    return this.tryStartServer();
  }

  /**
   * 处理错误状态
   */
  private async handleErrorState(data: ServerStateData): Promise<void> {
    if (StateUtils.isPortConflict(data.state)) {
      const action = await this.notifications.showPortConflictDialog(data.port);
      switch (action) {
        case 'retry':
          break;
        case 'change':
          const newPort = await this.notifications.promptNewPort(data.port);
          if (newPort) {
            await config.getConfiguration().update('port', newPort, true);
          }
          break;
        case 'cancel':
          throw new Error('User cancelled');
      }
    } else if (StateUtils.isAlreadyRunning(data.state)) {
      if (await this.isServerAlive(data.port)) {
        return;
      }
    } else {
      this.notifications.show('serverError', data.errorMessage);
      throw new Error(data.errorMessage || 'Server startup failed');
    }
  }

  /**
   * 尝试启动服务器
   */
  private async tryStartServer(forceRestart: boolean = false): Promise<number> {
    const port = config.getPort();
    
    // 尝试获取锁
    const fileLock = new FileLock(this.lockPath);
    const lockAcquired = await fileLock.tryAcquire(0);

    if (!lockAcquired) {
      // 其他进程正在启动，等待服务器就绪
      console.log('[ServerManager] Another process is starting server, waiting...');
      return this.waitForServerReady(port);
    }

    try {
      // 启动服务器进程
      await this.spawnServer(port, forceRestart);
      
      // 等待服务器就绪
      return this.waitForServerReady(port);
    } finally {
      await fileLock.release();
    }
  }

  /**
   * 启动服务器进程
   */
  private async spawnServer(port: number, forceRestart: boolean): Promise<void> {
    console.log(`[ServerManager] Starting server on port ${port}...`);

    const nodePath = process.execPath;
    const args = [
      this.serverScript,
      '--port', String(port),
      '--storage', this.storagePath
    ];
    
    if (forceRestart) {
      args.push('--force');
    }

    if (config.getEnableCors()) {
      args.push('--cors');
    }

    const serverProcess = spawn(nodePath, args, {
      detached: true,
      stdio: 'ignore'
    });

    serverProcess.unref();
  }

  /**
   * 等待服务器就绪
   */
  private async waitForServerReady(port: number): Promise<number> {
    const start = Date.now();
    
    while (Date.now() - start < SERVER_STARTUP_TIMEOUT) {
      const data = await this.stateFile.read();
      
      if (data&& await this.isServerAlive(data.port)) {
        console.log(`[ServerManager] Server ready on port ${data.port}`);
        return data.port;
      } else if (data && StateUtils.hasError(data.state)) {
        await this.handleErrorState(data);
        return this.tryStartServer();
      }
      await sleep(HEALTH_CHECK_INTERVAL);
    }
    throw new Error('Server startup timeout');
  }

  /**
   * 强制重启服务器
   */
  async forceRestart(): Promise<number> {
    console.log('[ServerManager] Force restarting server...');
    return this.tryStartServer(true);
  }

  /**
   * 检查服务器是否存活
   */
  private async isServerAlive(port: number): Promise<boolean> {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
