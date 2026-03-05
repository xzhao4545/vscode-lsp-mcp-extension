# AGENTS.md - IDE-LSP for MCP (VSCode)

## Agent 规则

- 对用户的描述或需求有任何疑问，必须主动询问用户以获取更多信息
- 若用户回复的描述仍不清晰，则继续询问直到足够清晰为止

## 项目简介

IDE-LSP for MCP 是一个 VSCode 扩展，通过 MCP (Model Context Protocol) 协议将 IDE 的代码智能能力暴露为可调用的工具接口。

只要 VSCode 本身支持解析某种语言，该扩展即可为 AI 模型提供该语言的 LSP 服务。

## 技术栈

- **Language**: TypeScript
- **Runtime**: Node.js
- **Platform**: VSCode 1.109.0+
- **Build**: esbuild
- **Package Manager**: pnpm

## 文档索引

| 文档 | 内容 |
|------|------|
| [功能说明](./doc/FEATURES.md) | MCP Tools 详细参数与返回值 |
| [架构设计](./doc/ARCHITECTURE.md) | 系统架构图与核心流程 |
| [项目结构](./doc/STRUCTURE.md) | 目录结构与模块说明 |
| [待办事项](./doc/TODO.md) | 待实现功能列表 |
| [设置与调试](./doc/SETTINGS.md) | 配置项与调试面板 |

## 核心架构

本扩展采用**独立进程架构**：

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

**为什么需要独立进程？**
- VSCode 扩展运行在 Extension Host，每个窗口独立
- 扩展无法在 Main Process / Shared Process 注册服务
- 扩展无法直接跨窗口调用 `vscode.commands.executeCommand`

## 文档维护规则

1. **不要主动更新文档** — 仅当用户明确要求时才更新
2. **任务完成后询问** — 可询问用户是否需要更新相关文档
3. **需求记录** — 新功能需求添加到 [TODO.md](./doc/TODO.md)
