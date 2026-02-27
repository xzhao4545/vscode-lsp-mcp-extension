# Changelog

## [0.0.1] - 2026-02-26

### Added

- 16 个 MCP Tools: listOpenProjects, goToDefinition, findReferences, hover, getFileStruct, searchSymbolInWorkspace, goToImplementation, incomingCalls, renameSymbol, getDiagnostics, getDefinitionText, syncFiles, searchFiles, moveFile, deleteFile, getScopeParent
- 独立进程架构，支持多窗口多 Workspace
- 分页支持，配置项 `pageSize` 控制每页数量
- 代码上下文信息，配置项 `contextLines` 控制行数
- 调试面板，记录工具调用日志
- 符号验证机制，防止位置偏移导致的错误操作
- 自动启动服务，配置项 `autoStart` 控制
