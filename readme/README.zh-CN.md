# IDE-LSP for MCP

VSCode 扩展，通过 MCP (Model Context Protocol) 协议将 IDE 的代码智能能力暴露为可调用的工具接口。

只要 VSCode 本身支持解析某种语言，该扩展即可为 AI 模型提供该语言的 LSP 服务。

## 特性

- 16 个 MCP Tools 覆盖常用代码智能操作
- 支持多窗口、多 Workspace
- 分页支持，避免大量数据传输
- 代码上下文信息，便于 AI 理解
- 调试面板，记录工具调用日志

## MCP Tools

| 工具 | 功能 |
|------|------|
| `listOpenProjects` | 列出所有打开的 workspace |
| `goToDefinition` | 跳转到符号定义 |
| `findReferences` | 查找符号引用 |
| `hover` | 获取悬停信息 |
| `getFileStruct` | 获取文件符号结构 |
| `searchSymbolInWorkspace` | 搜索工作区符号 |
| `goToImplementation` | 查找接口实现 |
| `incomingCalls` | 查找方法调用者 |
| `renameSymbol` | 重命名符号 |
| `getDiagnostics` | 获取诊断信息 |
| `getDefinitionText` | 获取定义文本 |
| `syncFiles` | 同步文件变更 |
| `searchFiles` | 搜索文件 |
| `moveFile` | 移动文件 |
| `deleteFile` | 删除文件 |
| `getScopeParent` | 获取父级符号 |

## 系统要求

- VSCode 1.85.0+
- Node.js 22.x

## 使用说明

### 安装

1. 从 VSCode 扩展市场安装扩展，或从本地 `.vsix` 文件安装

2. 安装完成后，在对应程序的 MCP 配置文件（`mcp.json`）中添加以下配置：

```json
{
  "mcpServers": {
    "ide-lsp": {
      "url": "http://localhost:53221/mcp",
      "type": "http"
    }
  }
}
```

### 调试面板

- 将配置项ide-lsp-mcp.enableDebug设为true后，会在调试侧边栏添加MCP调试栏，可在其中查看MCP工具的调用及输出参数。
- `listOpenProjects`工具仅在MCP服务器端运行，不会出现在调试面板中。

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ide-lsp-mcp.port` | number | 53221 | MCP 服务器端口 |
| `ide-lsp-mcp.autoStart` | boolean | true | 启动时自动启动服务 |
| `ide-lsp-mcp.pageSize` | number | 50 | 分页大小 |
| `ide-lsp-mcp.contextLines` | number | 2 | 上下文行数 |
| `ide-lsp-mcp.enableDebug` | boolean | false | 启用调试面板 |
| `ide-lsp-mcp.allowMoveFile` | boolean | false | 允许 MCP 客户端移动文件时无需确认 |
| `ide-lsp-mcp.allowDeleteFile` | boolean | false | 允许 MCP 客户端删除文件时无需确认 |
| `ide-lsp-mcp.enableCors` | boolean | false | 启用 MCP 服务器的 CORS 支持 |

## 架构

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

## 文档

- [功能说明](./doc/FEATURES.md)
- [架构设计](./doc/ARCHITECTURE.md)
- [项目结构](./doc/STRUCTURE.md)
- [设置与调试](./doc/SETTINGS.md)

## License

MIT
