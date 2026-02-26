# 架构概览

## 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Client (Claude/Cursor/Copilot)           │
│                    HTTP/SSE 请求                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 MCP Server (独立 Node.js 进程)                  │
│                 端口 53122                                      │
│  ┌───────────────────────┬────────────────────────────────┐    │
│  │   HTTP/SSE 对外接口   │   WebSocket 对内接口           │    │
│  │   - GET /sse          │   - ws://localhost:53122/ws    │    │
│  │   - POST /message     │   - 窗口注册/任务分发/结果回收 │    │
│  │   - GET /health       │                                │    │
│  └───────────────────────┴────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                  ClientRegistry                        │    │
│  │   windowId → { ws, folders[], lastSeen }               │    │
│  │   projectPath → windowId 映射                          │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
              WebSocket 双向通信 (任务下发 / 结果返回)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Window 1   │       │  Window 2   │       │  Window 3   │
│  ExtHost    │       │  ExtHost    │       │  ExtHost    │
│  - proj/a   │       │  - proj/c   │       │  - proj/e   │
│  - proj/b   │       │  - proj/d   │       │             │
└─────────────┘       └─────────────┘       └─────────────┘
```

## 进程模型

### 为什么需要独立进程？

VSCode 扩展运行在 Extension Host 进程中，每个窗口有独立的 Extension Host：
- 扩展**无法**在 Main Process 或 Shared Process 注册服务
- 扩展**无法**直接跨窗口调用 `vscode.commands.executeCommand`
- `globalState` 只能共享数据，不能共享"服务"

因此采用独立进程方案：扩展 spawn 一个 Node.js 进程作为全局 MCP Server。

### 进程关系

```
VSCode Main Process
    │
    ├── Shared Process (VSCode 内部，扩展无法访问)
    │
    ├── Window 1
    │   └── Extension Host 1 ──WebSocket──┐
    │                                      │
    ├── Window 2                           │
    │   └── Extension Host 2 ──WebSocket──┼──→ MCP Server (独立进程)
    │                                      │    由首个窗口 spawn
    └── Window 3                           │    使用 VSCode 内置 Node.js
        └── Extension Host 3 ──WebSocket──┘
```
