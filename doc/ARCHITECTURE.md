# 架构设计

详细架构文档已按模块拆分，请查阅 [architecture](./architecture/) 子目录。

## 文档索引

| 文档 | 内容 |
|------|------|
| [概览](./architecture/OVERVIEW.md) | 整体架构图与进程模型 |
| [核心流程](./architecture/CORE-FLOWS.md) | 启动、关闭、请求处理流程 |
| [WebSocket 协议](./architecture/WEBSOCKET-PROTOCOL.md) | 窗口↔服务器消息协议 |
| [服务器实现](./architecture/SERVER-IMPL.md) | ClientRegistry、TaskManager、ShutdownManager |
| [窗口侧实现](./architecture/WINDOW-IMPL.md) | ServerConnection、TaskExecutor |
| [构建配置](./architecture/BUILD-CONFIG.md) | esbuild 双入口点打包 |

## 快速概览

```
┌─────────────────┐     HTTP/SSE      ┌─────────────────┐
│   MCP Client    │ ◄──────────────► │   MCP Server    │
│ (AI 模型)       │                   │ (独立 Node.js)  │
└─────────────────┘                   └────────┬────────┘
                                               │ WebSocket
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
             ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
             │  Window 1   │           │  Window 2   │           │  Window 3   │
             │  ExtHost    │           │  ExtHost    │           │  ExtHost    │
             └─────────────┘           └─────────────┘           └─────────────┘
```

详细说明请查阅各模块文档。
