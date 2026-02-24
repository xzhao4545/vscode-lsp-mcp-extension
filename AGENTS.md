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

## 与 IntelliJ 版本的差异

| 方面 | IntelliJ | VSCode |
|------|----------|--------|
| 项目单位 | Project | WorkspaceFolder |
| 语言能力 | PSI API | vscode.commands.executeCommand |
| 多窗口 | 每窗口独立服务器 | 全局单例服务器 |
| 服务发现 | projectPath 映射 | listOpenProjects + projectPath |

## 文档维护规则

1. **不要主动更新文档** — 仅当用户明确要求时才更新
2. **任务完成后询问** — 可询问用户是否需要更新相关文档
3. **需求记录** — 新功能需求添加到 [TODO.md](./doc/TODO.md)
