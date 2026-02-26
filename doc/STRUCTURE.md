# 项目结构

```
ide-lsp-for-mcp/
├── package.json              # 扩展配置
├── tsconfig.json             # TypeScript 配置
├── esbuild.js                # 构建脚本 (双入口点)
├── eslint.config.mjs         # ESLint 配置
├── doc/                      # 文档目录
├── src/
│   ├── extension.ts          # 扩展入口
│   ├── client/               # 窗口侧代码
│   │   ├── Config.ts         # 配置管理单例
│   │   ├── ServerManager.ts  # 服务器生命周期管理
│   │   ├── ServerConnection.ts # WebSocket 连接管理
│   │   ├── ConnectionManager.ts # 连接状态与重连管理
│   │   ├── NotificationManager.ts # 用户通知管理
│   │   ├── TaskExecutor.ts   # 任务执行器 (工具注册与调度)
│   │   ├── commands/         # 命令注册目录
│   │   ├── debug/            # 调试面板目录
│   │   ├── tools/            # 工具实现目录
│   │   └── utils/            # 工具类目录
│   │   ├── tools/            # 工具实现目录
│   │   └── utils/            # 工具类目录
│   ├── server/               # 服务器侧代码 (独立进程)
│   │   ├── main.ts           # 服务器入口 (命令行参数)
│   │   ├── McpServer.ts      # HTTP/SSE 服务
│   │   ├── WebSocketServer.ts # WebSocket 服务
│   │   ├── ClientRegistry.ts # 客户端注册表
│   │   ├── TaskManager.ts    # 任务分发与结果收集
│   │   ├── ShutdownManager.ts # 自动关闭管理
│   │   └── StateFileWatcher.ts # 状态文件监听
│   ├── shared/               # 共享代码
│   │   ├── types.ts          # 类型定义 (含状态位标志)
│   │   ├── protocol.ts       # WebSocket 消息协议
│   │   ├── constants.ts      # 常量定义
│   │   ├── stateFile.ts      # 状态文件读写
│   │   └── fileLock.ts       # 文件锁实现
│   └── test/                 # 测试
└── AGENTS.md                 # AI 代理指南
```

## 模块说明

| 模块 | 运行位置 | 职责 |
|------|----------|------|
| `client/` | Extension Host | 连接服务器，执行 VSCode 命令 |
| `server/` | 独立 Node.js 进程 | MCP 协议处理，任务路由 |
| `shared/` | 两侧共用 | 类型定义，协议常量 |

## 核心文件说明

### client/ 目录

| 文件 | 职责 |
|------|------|
| `Config.ts` | 配置管理单例，提供各配置项的 getter 方法 |
| `ServerManager.ts` | 检查服务器状态，必要时 spawn 新进程 |
| `ServerConnection.ts` | 维护 WebSocket 连接，处理注册/任务消息 |
| `ConnectionManager.ts` | 连接状态管理，指数退避重连 |
| `NotificationManager.ts` | 用户通知，端口冲突对话框 |
| `TaskExecutor.ts` | 工具注册与任务调度，通过 ToolRegistry 查找并执行工具 |

### client/commands/ 目录

| 文件 | 职责 |
|------|------|
| `index.ts` | 统一注册所有命令 (showStatus, reconnect, restartServer, clearDebugLog, showDebugDetail) |

### client/debug/ 目录

| 文件 | 职责 |
|------|------|
| `DebugLogStore.ts` | 调试日志存储，管理工具调用记录 |
| `DebugPanelProvider.ts` | TreeDataProvider 实现，提供调试面板 UI |

### client/utils/ 目录

| 文件 | 职责 |
|------|------|
| `StringBuilder.ts` | 高效字符串构建工具类 |
| `PaginationHelper.ts` | 分页头尾统一处理，支持 paginate/wrapPaginated |
| `ToolRegistry.ts` | 工具注册表，支持 register/get 方法 |
| `SymbolValidator.ts` | Symbol 验证器，校验指定位置的符号名称 |
| `ContextHelper.ts` | 上下文助手，获取指定文件指定行数的上下文 |

### client/tools/ 目录

| 文件 | 职责 |
|------|------|
| `BaseTool.ts` | 工具抽象基类，定义 execute() 和 format() 方法 |
| `index.ts` | 统一导出所有工具和工具类 |
| `*Tool.ts` | 16 个工具实现类 |

### server/ 目录

| 文件 | 职责 |
|------|------|
| `main.ts` | 服务器入口，解析命令行参数 |
| `McpServer.ts` | HTTP/SSE 服务，处理 MCP 协议请求 |
| `WebSocketServer.ts` | WebSocket 服务，管理窗口连接，处理重启请求 |
| `ClientRegistry.ts` | 维护 windowId → 连接信息的映射 |
| `TaskManager.ts` | 任务分发、超时处理、结果收集 |
| `ShutdownManager.ts` | 监控客户端数量，无客户端时自动关闭 |
| `StateFileWatcher.ts` | 监听状态文件变化，检测新服务器启动 |

### shared/ 目录

| 文件 | 职责 |
|------|------|
| `types.ts` | 状态位标志、StateUtils 工具函数、共享类型 |
| `protocol.ts` | WebSocket 消息类型定义 |
| `constants.ts` | 端口号、超时时间、重连参数、上下文行数等常量 |
| `stateFile.ts` | 状态文件读写封装 |
| `fileLock.ts` | 文件锁实现，支持超时检测 |

## 关键依赖

| 依赖 | 用途 |
|------|------|
| `@modelcontextprotocol/sdk` | MCP 协议 SDK |
| `ws` | WebSocket 客户端/服务端 |
| `vscode` | VSCode 扩展 API |

## 构建产物

```
dist/
├── extension.js        # 扩展代码 (运行在 Extension Host)
└── server/
    └── main.js         # 服务器代码 (独立进程)
```
