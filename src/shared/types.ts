/**
 * 共享类型定义
 */

/** 工作区文件夹信息 */
export interface Folder {
  name: string;
  path: string;
}

/** 项目信息 (包含所属窗口) */
export interface ProjectInfo extends Folder {
  windowId: string;
}

/**
 * 服务器状态位标志
 * 使用位运算组合状态
 */
export const ServerStateFlag = {
  /** 第0位: 进程已启动 */
  PROCESS_STARTED: 1 << 0,  // 0b0000_0001 = 1
  /** 第1位: 服务器已就绪(监听中) */
  SERVER_READY: 1 << 1,     // 0b0000_0010 = 2
  /** 第2位: 服务器已关闭 */
  STOPPED: 1 << 2,          // 0b0000_0100 = 4
  /** 第3位: 正在重启 */
  RESTARTING: 1 << 3,       // 0b0000_1000 = 8
  /** 第4位: 启动失败 */
  ERROR: 1 << 4,            // 0b0001_0000 = 16
  /** 第5位: 端口冲突 */
  PORT_CONFLICT: 1 << 5,    // 0b0010_0000 = 32
  /** 第6位: 服务器已在运行 */
  ALREADY_RUNNING: 1 << 6,  // 0b0100_0000 = 64
} as const;
/**
 * 常用状态组合
 */
export const ServerState = {
  /** 进程已启动，服务器未就绪: 0b0000_0001 = 1 */
  STARTING: ServerStateFlag.PROCESS_STARTED,
  /** 服务器运行中: 0b0000_0011 = 3 */
  RUNNING: ServerStateFlag.PROCESS_STARTED | ServerStateFlag.SERVER_READY,
  /** 服务器已关闭: 0b0000_0100 = 4 */
  STOPPED: ServerStateFlag.STOPPED,
  /** 正在重启: 0b0000_1011 = 11 */
  RESTARTING: ServerStateFlag.PROCESS_STARTED | ServerStateFlag.SERVER_READY | ServerStateFlag.RESTARTING,
  /** 端口冲突导致启动失败: 0b0011_0001 = 49 */
  ERROR_PORT_CONFLICT: ServerStateFlag.PROCESS_STARTED | ServerStateFlag.ERROR | ServerStateFlag.PORT_CONFLICT,
  /** 服务器已运行导致启动失败: 0b0101_0001 = 81 */
  ERROR_ALREADY_RUNNING: ServerStateFlag.PROCESS_STARTED | ServerStateFlag.SERVER_READY | ServerStateFlag.ERROR | ServerStateFlag.ALREADY_RUNNING,
  /** 其他错误导致启动失败: 0b0001_0001 = 17 */
  ERROR_UNKNOWN: ServerStateFlag.PROCESS_STARTED | ServerStateFlag.ERROR,
} as const;
/**
 * 状态判断工具函数
 */
export const StateUtils = {
  /** 检查是否包含指定标志 */
  hasFlag: (state: number, flag: number): boolean => (state & flag) === flag,
  /** 检查服务器是否正在运行(进程已启动且未关闭且未出错) */
  isRunning: (state: number): boolean => {
    return (state & ServerStateFlag.PROCESS_STARTED) !== 0;
  },
  /** 检查服务器是否已就绪 */
  isReady: (state: number): boolean => {
    return (state & ServerState.RUNNING) === ServerState.RUNNING;
  },
  clearError: (state: number): number =>{
    let errState=~(ServerStateFlag.ERROR|ServerStateFlag.PORT_CONFLICT|ServerStateFlag.ALREADY_RUNNING);
    return state&errState;
  },
  /** 检查是否有错误 */
  hasError: (state: number): boolean => (state & ServerStateFlag.ERROR) !== 0,
  /** 检查是否端口冲突 */
  isPortConflict: (state: number): boolean => (state & ServerStateFlag.PORT_CONFLICT) !== 0,
  /** 检查是否已在运行错误 */
  isAlreadyRunning: (state: number): boolean => (state & ServerStateFlag.ALREADY_RUNNING) !== 0,
  /** 检查是否正在重启 */
  isRestarting: (state: number): boolean => (state & ServerStateFlag.RESTARTING) !== 0,
  /** 检查是否已关闭 */
  isStopped: (state: number): boolean => (state & ServerStateFlag.STOPPED) !== 0,
  /** 清除状态 */
};
/**
 * 服务器状态文件内容
 */
export interface ServerStateData {
  /** 状态位标志 */
  state: number;
  /** 端口 */
  port: number;
  /** 进程 ID */
  pid: number;
  /** 启动时间 */
  startTime: number;
  /** 错误信息(可选) */
  errorMessage?: string;
}

/** 位置信息 */
export interface Location {
  uri: string;
  line: number;
  character: number;
}

/** 符号信息 */
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

/** 诊断信息 */
export interface DiagnosticInfo {
  message: string;
  severity: string;
  line: number;
  character: number;
}

/** 调试日志条目 */
export interface DebugLogEntry {
  timestamp: number;
  tool: string;
  args: Record<string, unknown>;
  result: string;
  duration: number;
  success: boolean;
}

/** 分页结果基类 */
export interface PaginatedResult {
  hasMore: boolean;
  total: number;
}

/** MCP 工具参数基类 */
export interface BaseToolArgs {
  projectPath: string;
}

/** 位置相关工具参数 */
export interface LocationToolArgs extends BaseToolArgs {
  filePath: string;
  line: number;
  character: number;
  symbolName?: string;
}

/** 分页工具参数 */
export interface PaginatedToolArgs extends BaseToolArgs {
  page?: number;
}
