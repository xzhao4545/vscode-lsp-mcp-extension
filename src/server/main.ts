/**
 * MCP 服务器入口
 */

import * as http from 'http';
import * as path from 'path';
import { ClientRegistry } from './ClientRegistry';
import { TaskManager } from './TaskManager';
import { ShutdownManager } from './ShutdownManager';
import { WebSocketServer } from './WebSocketServer';
import { McpServer } from './McpServer';
import { StateFileWatcher } from './StateFileWatcher';
import { FileLock, isProcessAlive } from '../shared/fileLock';
import { StateFile } from '../shared/stateFile';
import {
  DEFAULT_PORT,
  SERVER_LOCK_FILE
} from '../shared/constants';
import { ServerStateData, StateUtils } from '../shared/types';

// 解析命令行参数
function parseArgs(): { port: number; storagePath: string; forceRestart: boolean } {
  const args = process.argv.slice(2);
  let port = DEFAULT_PORT;
  let storagePath = '';
  let forceRestart = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
      case '-p':
        port = parseInt(args[++i], 10);
        break;
      case '--storage':
      case '-s':
        storagePath = args[++i];
        break;
      case '--force':
      case '-f':
        forceRestart = true;
        break;
    }
  }

  return { port, storagePath, forceRestart };
}

const { port, storagePath, forceRestart } = parseArgs();
// 默认存储路径: 用户主目录下的 .ide-lsp-mcp
if(storagePath.length===0){
  console.log('[Server] --storage <path> is required');
  process.exit(1);
}
const lockPath = path.join(storagePath, SERVER_LOCK_FILE);
const stateFile = new StateFile(storagePath);
const fileLock = new FileLock(lockPath);

let httpServer: http.Server | null = null;
let wsServer: WebSocketServer|null=null;
let stateFileWatcher: StateFileWatcher | null = null;
let taskManager: TaskManager | null = null;

/**
 * 主启动函数
 */
async function main(): Promise<void> {
  console.log(`[Server] Starting MCP server on port ${port}...`);

  // 1. 尝试获取文件锁
  const lockAcquired = await fileLock.tryAcquire(0);
  if (!lockAcquired) {
    console.log('[Server] Another process is starting the server, exiting...');
    process.exit(0);
  }
  // 2. 检查状态文件
  const currentState = await stateFile.read();
  try {
    
    // 服务器正在运行且非强制模式
    if (currentState && StateUtils.isRunning(currentState.state) && isProcessAlive(currentState.pid) && !forceRestart) {
      console.log('[Server] Server already running, exiting...');
      await stateFile.writeAlreadyRunning(currentState);
      await fileLock.release();
      process.exit(0);
    }
    // 3. 写入进程已启动状态
    await stateFile.writeStarting(port);
    // 4. 启动服务器
    await startServer();
  } catch (err) {
    await handleStartupError(err, currentState);
  }
}

/**
 * 启动 HTTP 服务器
 */
async function startServer(): Promise<void> {
  const registry = new ClientRegistry();
  taskManager = new TaskManager();
  const shutdownManager = new ShutdownManager(registry, stateFile.getPath());
  const mcpServer = new McpServer(registry, taskManager);

  httpServer = http.createServer((req, res) => {
    mcpServer.handleRequest(req, res).catch(err => {
      console.error('[Server] Request error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
  });

  // 创建 WebSocket 服务器
  wsServer = new WebSocketServer(httpServer, registry, taskManager, shutdownManager);
  
  // 设置重启处理
  wsServer.onRestart(handleRestartRequest);

  return new Promise((resolve, reject) => {
    httpServer!.on('error', (err: NodeJS.ErrnoException) => {
      reject(err);
    });

    httpServer!.listen(port, async () => {
      console.log(`[Server] MCP server listening on port ${port}`);

      // 写入运行中状态
      await stateFile.writeRunning(port);
      
      // 释放锁
      await fileLock.release();

      // 启动状态文件监听
      stateFileWatcher = new StateFileWatcher(stateFile, handleShouldShutdown);
      stateFileWatcher.start();

      console.log(`[Server] State file written, lock released`);
      resolve();
    });
  });
}

/**
 * 处理启动错误
 */
async function handleStartupError(err: unknown, rawState: ServerStateData|null): Promise<void> {
  const error = err as NodeJS.ErrnoException;
  
  if (error.code === 'EADDRINUSE') {
    console.error(`[Server] Port ${port} is already in use`);
    await stateFile.writePortConflict(port, rawState, `Port ${port} is already in use`);
  } else {
    console.error('[Server] Failed to start:', error.message);
    await stateFile.writeError(port, rawState, error.message);
  }
  await fileLock.release();
  process.exit(1);
}

/**
 * 处理重启请求
 */
async function handleRestartRequest(): Promise<void> {
  console.log('[Server] Restart requested...');
  
  // 写入重启中状态
  await stateFile.writeRestarting(port);
  
  // 等待客户端准备
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 写入已停止状态
  await stateFile.writeStopped(port);
  
  // 关闭服务器
  await shutdown();
}

/**
 * 处理应该关闭的情况
 */
function handleShouldShutdown(): void {
  console.log('[Server] Should shutdown detected...');
  shutdown();
}

/**
 * 关闭服务器
 */
async function shutdown(): Promise<void> {
  console.log('[Server] Shutting down...');
  
  stateFileWatcher?.stop();
  taskManager?.cleanup();
  
  if (httpServer) {
    wsServer?.close();
    httpServer.close(()=> process.exit(0));
  } else {
    process.exit(0);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[Server] Received SIGTERM');
  await stateFile.writeStopped(port);
  await shutdown();
});

process.on('SIGINT', async () => {
  console.log('[Server] Received SIGINT');
  await stateFile.writeStopped(port);
  await shutdown();
});

// 启动
main().catch(err => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
