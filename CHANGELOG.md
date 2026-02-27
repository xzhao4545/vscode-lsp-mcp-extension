# Changelog

## [0.0.2] - 2026-02-27

### Added

- 新增配置项 `allowMoveFile`：控制是否允许 MCP 客户端移动文件时无需确认（默认 false）
- 新增配置项 `allowDeleteFile`：控制是否允许 MCP 客户端删除文件时无需确认（默认 false）
- 新增配置项 `enableCors`：启用 MCP 服务器的 CORS 支持（默认 false）
- 移动/删除文件时弹窗确认机制，用户拒绝时返回提示信息引导模型询问原因

## [0.0.1] - 2026-02-26

### Added

- 16 个 MCP Tools: listOpenProjects, goToDefinition, findReferences, hover, getFileStruct, searchSymbolInWorkspace, goToImplementation, incomingCalls, renameSymbol, getDiagnostics, getDefinitionText, syncFiles, searchFiles, moveFile, deleteFile, getScopeParent
- 独立进程架构，支持多窗口多 Workspace
- 分页支持，配置项 `pageSize` 控制每页数量
- 代码上下文信息，配置项 `contextLines` 控制行数
- 调试面板，记录工具调用日志
- 符号验证机制，防止位置偏移导致的错误操作
- 自动启动服务，配置项 `autoStart` 控制
