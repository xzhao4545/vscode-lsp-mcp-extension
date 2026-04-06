# IDE-LSP for MCP

VSCode 扩展，通过 MCP (Model Context Protocol) 协议将 IDE 的代码智能能力暴露为可调用的工具接口。

只要 VSCode 本身支持解析某种语言，该扩展即可为 AI 模型提供该语言的 LSP 服务。

## 特性

- 15 个 MCP Tools，覆盖跳转、搜索、诊断与重构预览等常用代码智能操作
- 独立 MCP 服务器架构，支持多窗口、多 Workspace
- 分页与代码上下文输出，适合高结果量的位置和符号查询
- 符号校验失败时返回最近位置建议，便于模型修正偏移后的调用位置
- 大文件支持自动折叠的文件/符号结构输出
- 调试面板与状态栏集成，便于观察连接状态和工具调用

## MCP Tools

| 工具 | 功能 |
|------|------|
| `listOpenProjects` | 列出所有打开的 workspace，可选按父级 `projectPath` 过滤 |
| `goToDefinition` | 跳转到符号定义 |
| `findReferences` | 查找符号引用 |
| `hover` | 获取悬停信息 |
| `getFileStruct` | 获取文件符号结构（支持自动折叠） |
| `getSymbolStruct` | 获取指定符号的结构 |
| `searchSymbolInWorkspace` | 搜索工作区符号 |
| `goToImplementation` | 查找接口实现 |
| `incomingCalls` | 查找方法调用者 |
| `renameSymbol` | 重命名符号 |
| `getDiagnostics` | 获取诊断信息 |
| `getDefinitionText` | 获取定义文本 |
| `syncFiles` | 同步文件变更 |
| `searchFiles` | 搜索文件 |
| `getScopeParent` | 获取父级符号 |

## 系统要求

- VSCode 1.85.0+
- Node.js 22.x（用于本地开发与打包）

## 使用说明

### 安装

1. 从 VSCode 扩展市场安装扩展，或从本地 `.vsix` 文件安装。

2. 启动 VSCode 并保持扩展启用。默认情况下，MCP 服务器会自动在 `53221` 端口启动。

3. 安装完成后，在对应程序的 MCP 配置文件（`mcp.json`）中添加以下配置：

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

如果你修改了 `ide-lsp-mcp.port`，请同步更新 MCP 配置中的 URL 端口。

### MCP 客户端说明

- `listOpenProjects` 支持可选的 `projectPath` 参数；传入后，会返回“已打开项目路径位于该路径之下”的 workspace。
- 引用、实现、诊断、文件搜索等高结果量工具支持分页。
### 调试面板

- 将 `ide-lsp-mcp.enableDebug` 设为 `true` 后，会在调试侧边栏显示 MCP 调试面板。
- 面板会记录工具名、参数、结果摘要、耗时和成功状态，最多保留 500 条记录。
- 双击日志条目可在只读虚拟文档中查看完整请求与响应。
- `listOpenProjects` 工具仅在 MCP 服务器端运行，不会出现在调试面板中。

### 命令

| 命令 | 说明 |
|------|------|
| `IDE-LSP-MCP: 显示状态` | 显示当前 MCP 服务器连接状态 |
| `IDE-LSP-MCP: 重新连接` | 重新连接 MCP 服务器，并在需要时尝试启动它 |
| `IDE-LSP-MCP: 重新启动MCP服务器` | 在确认后重启独立 MCP 服务器 |
| `IDE-LSP-MCP: 清空调试日志` | 清空调试面板中的全部记录 |

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ide-lsp-mcp.port` | number | 53221 | MCP 服务器端口 |
| `ide-lsp-mcp.autoStart` | boolean | true | 启动时自动启动服务 |
| `ide-lsp-mcp.pageSize` | number | 50 | 分页大小 |
| `ide-lsp-mcp.contextLines` | number | 2 | 位置类结果附带的上下文行数（总输出为 `2n+1` 行） |
| `ide-lsp-mcp.enableDebug` | boolean | false | 启用调试面板 |
| `ide-lsp-mcp.enableCors` | boolean | false | 启用 MCP 服务器的 CORS 支持 |
| `ide-lsp-mcp.diagnosticsTimeout` | number | 5000 | 等待诊断信息生成的超时时间 |
| `ide-lsp-mcp.nearestSymbolsCount` | number | 3 | 符号校验失败时返回的最近同名符号建议数量 |
| `ide-lsp-mcp.maxStructLines` | number | 200 | 文件或符号结构在自动模式下的最大输出行数 |

## 行为说明

- `getFileStruct` 和 `getSymbolStruct` 支持 `maxDepth`；传入负数时使用自动模式，并受 `ide-lsp-mcp.maxStructLines` 限制。
- 各类符号相关工具会校验 `symbolName`，当目标符号位置发生偏移时，可返回建议位置。
- `getDiagnostics` 在某些语言服务只为前台活动编辑器发布诊断时，会临时激活目标文件；等待时长由 `ide-lsp-mcp.diagnosticsTimeout` 控制。

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

- [功能说明](../doc/FEATURES.md)
- [架构设计](../doc/ARCHITECTURE.md)
- [项目结构](../doc/STRUCTURE.md)
- [设置与调试](../doc/SETTINGS.md)

## License

MIT
