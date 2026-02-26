# 服务器实现细节

## 状态文件

位置: `globalStorageUri/server.json`

```json
{
  "port": 53122,
  "pid": 12345,
  "startTime": 1708771200000
}
```

## 单例保证逻辑

```typescript
async function ensureServerRunning(context: ExtensionContext): Promise<number> {
  const stateFile = path.join(context.globalStorageUri.fsPath, 'server.json');
  
  // 1. 检查状态文件
  if (fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    
    // 2. 检查服务器是否存活
    if (await isServerAlive(state.port)) {
      return state.port; // 服务器已运行
    }
  }
  
  // 3. 启动新服务器
  const port = await startServer(context);
  
  // 4. 写入状态文件
  fs.writeFileSync(stateFile, JSON.stringify({
    port,
    pid: serverProcess.pid,
    startTime: Date.now()
  }));
  
  return port;
}
```

## 服务器进程启动

```typescript
async function startServer(context: ExtensionContext): Promise<number> {
  const serverScript = path.join(context.extensionPath, 'dist', 'server', 'main.js');
  const port = 53122;
  
  // 使用 VSCode 内置的 Node.js
  const nodePath = process.execPath;
  
  const serverProcess = spawn(nodePath, [serverScript], {
    detached: true,      // 独立于父进程
    stdio: 'ignore',     // 不继承 stdio
    env: {
      ...process.env,
      MCP_PORT: String(port),
      MCP_STORAGE_PATH: context.globalStorageUri.fsPath
    }
  });
  
  serverProcess.unref(); // 允许父进程独立退出
  
  // 等待服务器就绪
  await waitForServer(port, 5000);
  
  return port;
}
```


## 服务器存活检测

```typescript
async function waitForServer(port: number, timeout: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await isServerAlive(port)) {
      return;
    }
    await sleep(100);
  }
  throw new Error('Server startup timeout');
}

async function isServerAlive(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
```

## ClientRegistry 数据结构

```typescript
interface ClientInfo {
  ws: WebSocket;
  windowId: string;
  folders: Array<{ name: string; path: string }>;
  connectedAt: number;
}

class ClientRegistry {
  private clients = new Map<string, ClientInfo>();
  private projectIndex = new Map<string, string>(); // projectPath -> windowId
  
  register(windowId: string, ws: WebSocket, folders: Folder[]): void {
    this.clients.set(windowId, { ws, windowId, folders, connectedAt: Date.now() });
    
    // 建立 projectPath 索引
    for (const folder of folders) {
      this.projectIndex.set(this.normalizePath(folder.path), windowId);
    }
  }
  
  unregister(windowId: string): void {
    const client = this.clients.get(windowId);
    if (client) {
      // 清理 projectPath 索引
      for (const folder of client.folders) {
        this.projectIndex.delete(this.normalizePath(folder.path));
      }
      this.clients.delete(windowId);
    }
  }
  
  findByProjectPath(projectPath: string): ClientInfo | undefined {
    const normalized = this.normalizePath(projectPath);
    const windowId = this.projectIndex.get(normalized);
    return windowId ? this.clients.get(windowId) : undefined;
  }
  
  getAllProjects(): ProjectInfo[] {
    const result: ProjectInfo[] = [];
    for (const client of this.clients.values()) {
      for (const folder of client.folders) {
        result.push({ ...folder, windowId: client.windowId });
      }
    }
    return result;
  }
  
  get size(): number {
    return this.clients.size;
  }
  
  private normalizePath(p: string): string {
    return p.toLowerCase().replace(/\\/g, '/');
  }
}
```

## TaskManager 任务分发

```typescript
class TaskManager {
  private pending = new Map<string, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  
  async dispatch(client: ClientInfo, tool: string, args: any): Promise<any> {
    const requestId = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Task timeout'));
      }, 30000);
      
      this.pending.set(requestId, { resolve, reject, timeout });
      
      // 发送任务
      client.ws.send(JSON.stringify({
        type: 'task',
        requestId,
        tool,
        args
      }));
    });
  }
  
  handleResult(requestId: string, data: any): void {
    const task = this.pending.get(requestId);
    if (task) {
      clearTimeout(task.timeout);
      this.pending.delete(requestId);
      task.resolve(data);
    }
  }
  
  handleError(requestId: string, error: any): void {
    const task = this.pending.get(requestId);
    if (task) {
      clearTimeout(task.timeout);
      this.pending.delete(requestId);
      task.reject(new Error(error.message || 'Task failed'));
    }
  }
}
```

## ShutdownManager 自动关闭

```typescript
class ShutdownManager {
  private shutdownTimer: NodeJS.Timeout | null = null;
  private readonly SHUTDOWN_DELAY = 30000; // 30秒
  
  constructor(
    private registry: ClientRegistry,
    private stateFile: string
  ) {}
  
  onClientDisconnected(): void {
    if (this.registry.size === 0) {
      this.scheduleShutdown();
    }
  }
  
  onClientConnected(): void {
    this.cancelShutdown();
  }
  
  private scheduleShutdown(): void {
    if (this.shutdownTimer) return;
    
    console.log(`No clients connected. Shutting down in ${this.SHUTDOWN_DELAY / 1000}s...`);
    
    this.shutdownTimer = setTimeout(() => {
      if (this.registry.size === 0) {
        this.cleanup();
        process.exit(0);
      }
    }, this.SHUTDOWN_DELAY);
  }
  
  private cancelShutdown(): void {
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = null;
      console.log('Shutdown cancelled - new client connected');
    }
  }
  
  private cleanup(): void {
    if (fs.existsSync(this.stateFile)) {
      fs.unlinkSync(this.stateFile);
    }
  }
}
```