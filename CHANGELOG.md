# Changelog

## [Unreleased]

### Changed

- **Breaking**: Replaced WebSocket with `vscode-jsonrpc` over Named Pipes (IPC)
  - Renamed `WebSocketServer.ts` → `IpcServer.ts`
  - Communication now uses `vscode-jsonrpc` `NotificationType`/`RequestType` instead of raw JSON messages
  - Named Pipes eliminate port collision issues with the MCP HTTP server
- Updated `protocol.ts` to use `vscode-jsonrpc` notification/request types

### Added

- `src/server/IpcServer.ts` - IPC server using `vscode-jsonrpc` over domain sockets
- `getIpcPath()` in `src/shared/types.ts` - generates platform-appropriate IPC pipe path

### Removed

- `src/server/WebSocketServer.ts` - replaced by `IpcServer.ts`

### Documentation

- Updated CLAUDE.md Protocol Pattern section to reflect `vscode-jsonrpc` architecture

## [0.1.1] - 2026-04-06

## [0.1.1] - 2026-04-06

- 修复 `searchSymbolInWorkspace` 首次查询偶发空结果的问题：工具现在会自动预热并重试工作区符号索引
- 更新 `listOpenProjects` 文档与工具描述，明确传入 `projectPath` 时返回 `targetWorkspace`
- 更新 `incomingCalls` 文档与工具描述，明确结果依赖 IDE Call Hierarchy 支持，部分符号可能返回空结果
- 补充 `searchSymbolInWorkspace` 预热重试的回归测试

## [0.1.0] - 2026-04-06

- 移除 `moveFile` 与 `deleteFile` 工具，以及对应的配置项、测试与文档说明
- 修复 `getDiagnostics` 在需要前台激活文件或经历空诊断事件时拿不到真实诊断结果的问题
- 调整 `syncFiles` 的异常处理：缺失路径仅返回简短提示，不再暴露底层堆栈
- 修复 `goToDefinition` 与 `getDefinitionText` 在 `import` / `re-export` 场景下停留在导入语句而非真实定义的问题
- 修复 `getScopeParent` 在方法体内部返回类级作用域而非最内层方法/构造函数作用域的问题
- 修复 `searchSymbolInWorkspace` 未按 `projectPath` 限定结果范围、且 `symbolType` 过滤未生效的问题
- 修复 `goToImplementation` 将抽象基类/当前符号本体错误计入实现结果的问题
- 修复 `incomingCalls` 返回调用者定义位置而非真实调用位置的问题
- 补充符号跳转与工作区符号过滤的回归测试，防止上述行为回退

## [0.0.6] - 2026-04-05

### Fixed

- 修复调用工具时报错：Unknown tool

## [0.0.5] - 2026-04-05

### Changed

- `listOpenProjects` 在传入 `projectPath` 时，改为匹配该路径下的已打开项目路径，而不再只接受工作区根路径本身
- 补充并校正 README 中对 `listOpenProjects` 过滤行为与当前配置默认值的说明

## [0.0.4] - 2026-04-05

### Added

- 新增 `getSymbolStruct` 工具，用于展开 `getFileStruct` 中折叠的符号节点
- 新增配置项 `diagnosticsTimeout`，控制 `getDiagnostics` 等待诊断信息的超时时间（默认 5000ms）
- 新增配置项 `nearestSymbolsCount`，控制符号校验失败时返回的最近同名符号建议数量（默认 3）
- 新增配置项 `maxStructLines`，控制文件/符号结构在自动模式下的最大输出行数（默认 200）

### Changed

- `getFileStruct` 支持大文件自动折叠输出，并可结合 `maxDepth` 与 `maxStructLines` 控制结构展开深度
- 符号校验失败时，相关工具会返回最近的同名符号位置建议，便于模型修正调用位置
- `getDiagnostics` 会在需要时等待语言服务器生成诊断信息后再返回结果，提升未打开文件场景下的可用性

## [0.0.3] - 2026-03-05

### Fix

- 修复GetDiagnostics获取不到诊断信息的问题

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
