# 设置与调试面板

## 设置项

### 配置项列表

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `port` | number | 53221 | MCP 服务器端口 |
| `autoStart` | boolean | true | VSCode 启动时自动启动服务 |
| `timeout` | number | 30000 | 请求超时时间 (毫秒) |
| `pageSize` | number | 50 | 分页大小 - 列表工具每页返回数 |
| `contextLines` | number | 3 | 代码上下文行数（上下各取多少行） |
| `enableDebug` | boolean | false | 启用调试模式 (显示调试面板) |



### package.json 配置声明

```json
{
  "contributes": {
    "configuration": {
      "title": "IDE-LSP for MCP",
      "properties": {
        "ide-lsp-mcp.port": {
          "type": "number",
          "default": 53221,
          "description": "MCP 服务器端口"
        },
        "ide-lsp-mcp.autoStart": {
          "type": "boolean",
          "default": true,
          "description": "VSCode 启动时自动启动服务"
        },
        "ide-lsp-mcp.timeout": {
          "type": "number",
          "default": 30000,
          "description": "请求超时时间 (毫秒)"
        },
        "ide-lsp-mcp.pageSize": {
          "type": "number",
          "default": 50,
          "description": "分页大小"
        },
        "ide-lsp-mcp.contextLines": {
          "type": "number",
          "default": 3,
          "description": "上下文行数"
        },
        "ide-lsp-mcp.enableDebug": {
          "type": "boolean",
          "default": false,
          "description": "启用调试模式"
        }
      }
    }
  }
}
```


## 状态栏命令
| 命令 | 说明 |
|------|------|
| `ide-lsp-mcp.showStatus` | 显示服务器状态 |
| `ide-lsp-mcp.reconnect` | 手动重连（会先尝试启动服务器） |
| `ide-lsp-mcp.restartServer` | 重启服务器（需确认） |
## 调试面板

### 功能概述

调试面板用于记录每条 MCP 请求的详细信息，便于开发调试。

- 仅在 `enableDebug = true` 时显示
- 不持久化保存，重启后清空
- 最多保留 500 条记录
- 在客户端本地记录工具调用

### 日志条目字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `timestamp` | number | 请求时间戳 (Unix ms) |
| `tool` | string | 调用的工具名 |
| `args` | object | 输入参数 |
| `result` | string | 输出结果 (JSON 字符串) |
| `duration` | number | 耗时 (毫秒) |
| `success` | boolean | 是否成功 |


### 日志条目类型定义

```typescript
interface DebugLogEntry {
  timestamp: number;      // 请求时间戳
  tool: string;           // 工具名
  args: Record<string, any>; // 输入参数
  result: string;         // 输出结果
  duration: number;       // 耗时 (ms)
  success: boolean;       // 是否成功
}
```


### 面板显示列

| 列名 | 宽度 | 内容 |
|------|------|------|
| 时间 | 100px | `HH:mm:ss.SSS` 格式 |
| 工具 | 120px | 工具名称 |
| 参数 | 300px | 参数摘要 (最多显示 3 个) |
| 结果 | 400px | 结果摘要 (最多 100 字符) |
| 耗时 | 80px | 毫秒数 |
| 状态 | 60px | ✓ 或 ✗ |


### 面板操作

- **清空**: 点击面板标题栏的清空按钮
- **双击记录**: 打开只读 Markdown 文档查看完整输入/输出

## 调试面板实现 (TreeView)

### package.json 视图声明

```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "id": "ideLspMcpDebug",
          "name": "MCP Debug",
          "when": "config.ide-lsp-mcp.enableDebug"
        }
      ]
    }
  }
}
```

### 核心类说明

| 类 | 文件 | 职责 |
|-----|------|------|
| `DebugLogStore` | `client/debug/DebugLogStore.ts` | 存储调试日志条目 |
| `DebugPanelProvider` | `client/debug/DebugPanelProvider.ts` | TreeDataProvider 实现 |

### 日志记录流程

```
ConnectionManager.wrapTaskCallback()
    └── 执行工具 → if enableDebug → DebugLogStore.add()
        └── 触发 onDidChange → DebugPanelProvider.refresh()
```