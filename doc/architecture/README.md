# 架构设计文档

本目录包含 IDE-LSP for MCP 的详细架构设计文档，按模块拆分便于查阅。

## 文档索引

| 文档 | 内容 |
|------|------|
| [概览](./OVERVIEW.md) | 整体架构图与进程模型 |
| [核心流程](./CORE-FLOWS.md) | 启动、关闭、请求处理流程 |
| [WebSocket 协议](./WEBSOCKET-PROTOCOL.md) | 窗口↔服务器消息协议 |
| [服务器实现](./SERVER-IMPL.md) | ClientRegistry、TaskManager、ShutdownManager |
| [窗口侧实现](./WINDOW-IMPL.md) | ServerConnection、TaskExecutor |
| [构建配置](./BUILD-CONFIG.md) | esbuild 双入口点打包 |

## 快速导航

- 想了解系统整体设计？→ [概览](./OVERVIEW.md)
- 想了解请求如何处理？→ [核心流程](./CORE-FLOWS.md)
- 想了解通信协议？→ [WebSocket 协议](./WEBSOCKET-PROTOCOL.md)
- 想修改服务器代码？→ [服务器实现](./SERVER-IMPL.md)
- 想修改扩展代码？→ [窗口侧实现](./WINDOW-IMPL.md)
- 想修改构建配置？→ [构建配置](./BUILD-CONFIG.md)
