/**
 * Shared type definitions
 * // CN: 共享类型定义
 */

/** Workspace folder information // CN: 工作区文件夹信息 */
export interface Folder {
	name: string;
	path: string;
}

/** Project information (including window it belongs to) // CN: 项目信息 (包含所属窗口) */
export interface ProjectInfo extends Folder {
	windowId: string;
}

/**
 * Server state bit flags
 * Uses bitwise operations to combine states
 * // CN: 服务器状态位标志
 * // CN: 使用位运算组合状态
 */
export const ServerStateFlag = {
	/** Bit 0: Process started // CN: 第0位: 进程已启动 */
	PROCESS_STARTED: 1 << 0, // 0b0000_0001 = 1
	/** Bit 1: Server ready (listening) // CN: 第1位: 服务器已就绪(监听中) */
	SERVER_READY: 1 << 1, // 0b0000_0010 = 2
	/** Bit 2: Server stopped // CN: 第2位: 服务器已关闭 */
	STOPPED: 1 << 2, // 0b0000_0100 = 4
	/** Bit 3: Restarting // CN: 第3位: 正在重启 */
	RESTARTING: 1 << 3, // 0b0000_1000 = 8
	/** Bit 4: Startup failed // CN: 第4位: 启动失败 */
	ERROR: 1 << 4, // 0b0001_0000 = 16
	/** Bit 5: Port conflict // CN: 第5位: 端口冲突 */
	 PORT_CONFLICT: 1 << 5, // 0b0010_0000 = 32
	/** Bit 6: Server already running // CN: 第6位: 服务器已在运行 */
	ALREADY_RUNNING: 1 << 6, // 0b0100_0000 = 64
} as const;
/**
 * Common state combinations
 * // CN: 常用状态组合
 */
export const ServerState = {
	/** Process started, server not ready: 0b0000_0001 = 1 // CN: 进程已启动，服务器未就绪 */
	STARTING: ServerStateFlag.PROCESS_STARTED,
	/** Server running: 0b0000_0011 = 3 // CN: 服务器运行中 */
	RUNNING: ServerStateFlag.PROCESS_STARTED | ServerStateFlag.SERVER_READY,
	/** Server stopped: 0b0000_0100 = 4 // CN: 服务器已关闭 */
	STOPPED: ServerStateFlag.STOPPED,
	/** Restarting: 0b0000_1011 = 11 // CN: 正在重启 */
	RESTARTING:
		ServerStateFlag.PROCESS_STARTED |
		ServerStateFlag.SERVER_READY |
		ServerStateFlag.RESTARTING,
	/** Port conflict startup failure: 0b0011_0001 = 49 // CN: 端口冲突导致启动失败 */
	ERROR_PORT_CONFLICT:
		ServerStateFlag.PROCESS_STARTED |
		ServerStateFlag.ERROR |
		ServerStateFlag.PORT_CONFLICT,
	/** Already running startup failure: 0b0101_0001 = 81 // CN: 服务器已运行导致启动失败 */
	ERROR_ALREADY_RUNNING:
		ServerStateFlag.PROCESS_STARTED |
		ServerStateFlag.SERVER_READY |
		ServerStateFlag.ERROR |
		ServerStateFlag.ALREADY_RUNNING,
	/** Unknown error startup failure: 0b0001_0001 = 17 // CN: 其他错误导致启动失败 */
	ERROR_UNKNOWN: ServerStateFlag.PROCESS_STARTED | ServerStateFlag.ERROR,
} as const;
/**
 * State utility functions
 * // CN: 状态判断工具函数
 */
export const StateUtils = {
	/** Check if state contains specified flag // CN: 检查是否包含指定标志 */
	hasFlag: (state: number, flag: number): boolean => (state & flag) === flag,
	/** Check if server is running (process started and not stopped and no error) // CN: 检查服务器是否正在运行 */
	isRunning: (state: number): boolean => {
		return (state & ServerStateFlag.PROCESS_STARTED) !== 0;
	},
	/** Check if server is ready // CN: 检查服务器是否已就绪 */
	isReady: (state: number): boolean => {
		return (state & ServerState.RUNNING) === ServerState.RUNNING;
	},
	clearError: (state: number): number => {
		const errState = ~(
			ServerStateFlag.ERROR |
			ServerStateFlag.PORT_CONFLICT |
			ServerStateFlag.ALREADY_RUNNING
		);
		return state & errState;
	},
	/** Check if there is an error // CN: 检查是否有错误 */
	hasError: (state: number): boolean => (state & ServerStateFlag.ERROR) !== 0,
	/** Check if port conflict // CN: 检查是否端口冲突 */
	isPortConflict: (state: number): boolean =>
		(state & ServerStateFlag.PORT_CONFLICT) !== 0,
	/** Check if already running error // CN: 检查是否已在运行错误 */
	isAlreadyRunning: (state: number): boolean =>
		(state & ServerStateFlag.ALREADY_RUNNING) !== 0,
	/** Check if restarting // CN: 检查是否正在重启 */
	isRestarting: (state: number): boolean =>
		(state & ServerStateFlag.RESTARTING) !== 0,
	/** Check if stopped // CN: 检查是否已关闭 */
	isStopped: (state: number): boolean =>
		(state & ServerStateFlag.STOPPED) !== 0,
	/** Clear state // CN: 清除状态 */
};
/**
 * Server state file content
 * // CN: 服务器状态文件内容
 */
export interface ServerStateData {
	/** State bit flags // CN: 状态位标志 */
	state: number;
	/** Port (MCP server) // CN: 端口 (MCP 服务器) */
	port: number;
	/** Named pipe path for ExtHost IPC // CN: 用于 ExtHost IPC 的命名管道路径 */
	pipePath?: string;
	/** Process ID // CN: 进程 ID */
	pid: number;
	/** Instance identifier // CN: 实例标识 */
	instanceId: string;
	/** Start time // CN: 启动时间 */
	startTime: number;
	/** Error message (optional) // CN: 错误信息(可选) */
	errorMessage?: string;
}

const crypto = require("node:crypto");
const path = require("node:path");

/**
 * Generate a safe IPC socket/pipe path
 * // CN: 生成安全的 IPC socket 管道路径
 */
export function getIpcPath(storagePath: string): string {
	if (process.platform === "win32") {
		// EN: Windows needs named pipes format: \\.\pipe\<name>
		// CN: Windows 需要命名管道格式: \\.\pipe\<name>
		const hash = crypto.createHash("md5").update(storagePath).digest("hex");
		return `\\\\.\\pipe\\vscode-lsp-mcp-${hash}`;
	}
	// EN: Unix uses domain sockets (files)
	// CN: Unix 使用域套接字(文件)
	return path.join(storagePath, "mcp-ipc.sock");
}

/** Location information // CN: 位置信息 */
export interface Location {
	uri: string;
	line: number;
	character: number;
}

/** Symbol information // CN: 符号信息 */
export interface SymbolInfo {
	name: string;
	kind: string;
	uri?: string;
	line?: number;
	range?: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
	children?: SymbolInfo[];
}

/** Diagnostic information // CN: 诊断信息 */
export interface DiagnosticInfo {
	message: string;
	severity: string;
	line: number;
	character: number;
}

/** Debug log entry // CN: 调试日志条目 */
export interface DebugLogEntry {
	timestamp: number;
	tool: string;
	args: Record<string, unknown>;
	result: string;
	duration: number;
	success: boolean;
}

/** Paginated result base class // CN: 分页结果基类 */
export interface PaginatedResult {
	hasMore: boolean;
	total: number;
}

/** MCP tool arguments base class // CN: MCP 工具参数基类 */
export interface BaseToolArgs {
	projectPath: string;
}

/** Location-related tool arguments // CN: 位置相关工具参数 */
export interface LocationToolArgs extends BaseToolArgs {
	filePath: string;
	line: number;
	character: number;
	symbolName?: string;
}

/** Paginated tool arguments // CN: 分页工具参数 */
export interface PaginatedToolArgs extends BaseToolArgs {
	page?: number;
}
