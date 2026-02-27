# 核心流程

## 1. 服务器启动流程

```
窗口 activate()
    │
    ▼
初始化 ConnectionManager (端口待定)
    │
    ▼
调用 serverManager.ensureServerRunning()
    │
    ▼
读取 globalStorageUri/server.json
    │
    ├── isReady() 且可连接？ → 直接连接 WebSocket
    │
    ├── isRunning() 但未 Ready？ → 等待服务器就绪
    │
    ├── hasError()？ → 处理错误状态
    │   ├── 端口冲突 → 提示用户重试/更换端口/取消
    │   └── 其他错误 → 显示错误信息
    │
    └── 其他 → 尝试获取锁并启动服务器
             │
             ▼
        获取 server.lock 文件锁
             │
             ├── 失败 → 等待其他进程启动完成
             │
             └── 成功 → spawn 服务器进程
                      │
                      ▼
                 node main.js --port 53221 --storage <path>
                      │
                      ▼
                 等待服务器就绪 (轮询状态文件)
                      │
                      ▼
                 状态变为 RUNNING (state=3)
    │
    ▼
更新 connectionManager 端口
    │
    ▼
连接 WebSocket: ws://localhost:53221/ws
    │
    ▼
发送注册消息: { type: 'register', folders: [...] }
```

## 2. 服务器关闭流程

```
窗口 deactivate() 或 崩溃
    │
    ▼
WebSocket 连接断开
    │
    ▼
服务器收到 'close' 事件
    │
    ▼
ClientRegistry.delete(windowId)
    │
    ▼
clients.size === 0 ?
    │
    ├── 否 → 继续运行
    │
    └── 是 → 启动 30 秒倒计时
             │
             ▼
        30 秒内有新连接？
             │
             ├── 是 → 取消倒计时，继续运行
             │
             └── 否 → 删除 server.json
                      │
                      ▼
                  process.exit(0)
```

## 3. MCP 请求处理流程

```
MCP Client 发送请求
    │
    ▼
POST /message { tool: 'goToDefinition', args: { projectPath, ... } }
    │
    ▼
服务器解析请求
    │
    ▼
ClientRegistry.findByProjectPath(projectPath)
    │
    ├── 未找到 → 返回错误: "Project not found in any open window"
    │
    └── 找到 windowId
             │
             ▼
        生成 requestId (UUID)
             │
             ▼
        通过 WebSocket 发送任务到目标窗口:
        { type: 'task', requestId, tool, args }
             │
             ▼
        等待结果 (Promise + 超时 30s)
             │
             ▼
        窗口执行 vscode.commands.executeCommand(...)
             │
             ▼
        窗口返回结果:
        { type: 'result', requestId, data } 或
        { type: 'error', requestId, error }
             │
             ▼
        服务器返回 MCP Response
```
