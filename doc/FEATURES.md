# 功能说明

## 概述

IDE-LSP for MCP 是一个 VSCode 扩展，通过 MCP (Model Context Protocol) 协议暴露 IDE 的代码智能功能，允许 AI 模型复用 VSCode 的语法分析能力。

## MCP Tools

### 1. listOpenProjects

列出所有打开的 workspace 及其目录。

**输入参数：**
- `projectPath`: 可选，模型当前所在目录路径，用于定位所属 workspace

**返回：**
```json
{
  "workspaces": [
    {
      "id": "window-1",
      "name": "my-workspace",
      "folders": [
        { "name": "frontend", "path": "D:\\Project\\frontend" },
        { "name": "backend", "path": "D:\\Project\\backend" }
      ]
    }
  ],
  "currentWorkspace": {
    "id": "window-1",
    "folder": { "name": "frontend", "path": "D:\\Project\\frontend" }
  }
}
```

### 2. goToDefinition

跳转到符号定义位置。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 文件路径（绝对或相对）
- `line`: 行号 (1-based)
- `character`: 列偏移 (0-based)
- `symbolName`: 符号名称，用于校验
- `page`: 可选，页码 (1-based，默认 1)

### 3. findReferences

查找符号的所有引用。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 文件路径（绝对或相对）
- `line`: 行号 (1-based)
- `character`: 列偏移 (0-based)
- `symbolName`: 符号名称，用于校验
- `page`: 可选，页码 (1-based，默认 1)

### 4. hover

获取符号的悬停信息（文档注释等）。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 文件路径（绝对或相对）
- `line`: 行号 (1-based)
- `character`: 列偏移 (0-based)
- `symbolName`: 符号名称，用于校验

**返回：** `{contents: string}`

### 5. getFileStruct

获取文件中的所有符号结构。对于大文件，会自动折叠以控制输出长度。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 文件路径（绝对或相对）
- `maxDepth`: 可选，深度限制
  - 负数（默认 -1）：auto 模式，自动调整深度使行数不超过 `maxStructLines`
  - 正数：固定深度，忽略 `maxStructLines` 限制

**返回：** `{symbols: [{name, kind, range, defineLoc, children, collapsed}], hasCollapsed}`

**输出示例：**
```
## File Structure

- **UserService** (Class) [defineLoc:10:0] [range:L10-500] *collapsed*
- **AuthController** (Class) [defineLoc:502:0] [range:L502-800]
  - **login** (Method) [defineLoc:510:5] [range:L510-550]
  - **logout** (Method) [defineLoc:555:5] [range:L555-580]

*Some symbols are collapsed. Use `getSymbolStruct` with line:character to expand.*
```

**相关配置：**
- `ide-lsp-mcp.maxStructLines`：auto 模式下最大输出行数，默认 200

### 6. getSymbolStruct

获取指定符号的内部结构。用于展开 `getFileStruct` 返回的折叠符号。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 文件路径（绝对或相对）
- `line`: 行号 (1-based)
- `character`: 列偏移 (0-based)
- `symbolName`: 符号名称，用于校验
- `maxDepth`: 可选，深度限制（同 getFileStruct）

**返回：** `{symbol: {name, kind, range, defineLoc, children, collapsed}, hasCollapsed}`

**验证失败时返回：**
```json
{
  "error": "Symbol mismatch: expected \"myFunc\", found \"otherFunc\"",
  "suggestedPositions": [{ "line": 10, "character": 5 }]
}
```

### 7. searchSymbolInWorkspace

在工作区中搜索符号。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `query`: 搜索关键词（大小写不敏感子串匹配）
- `symbolType`: 符号类型过滤，可选值：`'class'`、`'method'`、`'field'`、`'all'`（默认 `'all'`）
- `page`: 页码（1-based，默认 1）

### 8. goToImplementation

查找接口/抽象类的实现。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 文件路径（绝对或相对）
- `line`: 行号 (1-based)
- `character`: 列偏移 (0-based)
- `symbolName`: 符号名称，用于校验
- `page`: 可选，页码 (1-based，默认 1)


### 9. incomingCalls

查找方法的调用者。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 文件路径（绝对或相对）
- `line`: 行号 (1-based)
- `character`: 列偏移 (0-based)
- `page`: 可选，页码 (1-based，默认 1)
- `symbolName`: 符号名称，用于校验

### 10. renameSymbol

准备重命名编辑。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 文件路径（绝对或相对）
- `line`: 行号 (1-based)
- `character`: 列偏移 (0-based)
- `symbolName`: 符号名称，用于校验
- `newName`: 新名称

**返回：** `{changes: {uri: [{range, newText}]}}`

### 11. getDiagnostics

获取文件的诊断信息（警告、错误）。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 文件路径（绝对或相对）
- `severity`: 可选，过滤严重级别
- `page`: 可选，页码 (1-based，默认 1)

**返回：** `{diagnostics: [{message, severity, line, character}], hasMore, total}`

### 12. getDefinitionText

获取 Symbol 定义文本。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 文件路径（绝对或相对）
- `line`: 行号 (1-based)
- `character`: 列偏移 (0-based)
- `symbolName`: 符号名称，用于校验

**返回：** `{definition: [{uri, line, text, kind}]}`

### 13. syncFiles

刷新 VSCode 索引，同步外部文件变更。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `paths`: 可选，要同步的路径数组（相对路径），为空则同步整个项目

**返回：** 同步结果信息

### 14. searchFiles

按文件名正则搜索文件。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `pattern`: 文件名正则表达式
- `directory`: 可选，搜索目录（相对路径）
- `recursive`: 可选，是否递归（默认 true）
- `page`: 可选，页码 (1-based，默认 1)

**返回：** 匹配的文件路径列表

### 15. moveFile

移动文件/目录，自动更新引用。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `sourcePath`: 源文件/目录路径（相对路径）
- `targetDir`: 目标目录路径（相对路径）

**返回：** 移动结果信息

### 16. deleteFile

安全删除文件，检查引用。

**输入参数：**
- `projectPath`: 项目目录绝对路径
- `filePath`: 要删除的文件路径（相对路径）
- `force`: 可选，强制删除（默认 false）

**返回：** 删除结果，包含未处理的引用位置

### 17. getScopeParent

查找指定位置所属的父级符号。

**输入参数：** projectPath, filePath, line

**返回：** `{name, kind, uri, line}`

## 通用特性

### Symbol 验证

以下工具支持 `symbolName` 参数进行符号验证：
- goToDefinition
- findReferences
- hover
- goToImplementation
- renameSymbol
- getDefinitionText
- getSymbolStruct

当指定位置的符号名称与 `symbolName` 不匹配时，返回错误信息，**并同时返回文件中最近的同名符号位置建议**。

建议的符号数量由配置项 `ide-lsp-mcp.nearestSymbolsCount` 控制，默认 3 个。

**错误返回示例：**
```
*Symbol mismatch: expected "myFunc", found "otherFunc"*

**Suggested positions for this symbol:**
- Line 10:5
- Line 25:12
- Line 100:8

Did you mean one of these positions?
```

### 诊断获取

`getDiagnostics` 工具会自动处理以下情况：

1. **文件未打开**：自动在后台打开文件（不在编辑器中展示），等待语言服务器生成诊断
2. **文件已打开**：短暂等待确保诊断已生成

等待超时时间由配置项 `ide-lsp-mcp.diagnosticsTimeout` 控制，默认 5000 毫秒。

### 分页支持

以下工具支持 `page` 参数进行分页：
- goToDefinition
- findReferences
- searchSymbolInWorkspace
- goToImplementation
- incomingCalls
- getDiagnostics
- searchFiles

分页大小由配置项 `ide-lsp-mcp.pageSize` 控制，默认 50。

### 上下文信息

以下工具的返回结果包含代码上下文：
- goToDefinition
- findReferences
- searchSymbolInWorkspace
- goToImplementation
- incomingCalls

上下文格式为 `"${line}|${content}"` 的字符串数组，行数由配置项 `ide-lsp-mcp.contextLines` 控制，默认 3 行（上下各 3 行）。
