/**
 * 共享常量定义
 */

/** MCP 服务器默认端口 */
export const DEFAULT_PORT = 53221;

/** 请求超时时间 (毫秒) */
export const DEFAULT_TIMEOUT = 30000;

/** 服务器关闭延迟 (毫秒) */
export const SHUTDOWN_DELAY = 30000;

/** 分页大小 */
export const DEFAULT_PAGE_SIZE = 50;

/** 上下文行数 */
export const DEFAULT_CONTEXT_LINES = 3;

/** 调试日志最大条目数 */
export const MAX_DEBUG_ENTRIES = 500;

/** 服务器状态文件名 */
export const SERVER_STATE_FILE = 'server.json';

/** 服务器健康检查路径 */
export const HEALTH_PATH = '/health';

/** SSE 路径 */
/** SSE 路径 (已弃用，保留兼容) */
export const SSE_PATH = '/sse';

/** 消息路径 (已弃用，保留兼容) */
export const MESSAGE_PATH = '/message';

/** MCP 端点路径 (新 Streamable HTTP API) */
export const MCP_ENDPOINT = '/mcp';

/** WebSocket 路径 */
export const WS_PATH = '/ws';

/** 服务器启动超时 (毫秒) */
export const SERVER_STARTUP_TIMEOUT = 5000;

/** 健康检查轮询间隔 (毫秒) */
export const HEALTH_CHECK_INTERVAL = 100;

/** 环境变量: 禁用自动启动服务器 */
export const ENV_DISABLE_AUTO_START = 'IDE_LSP_MCP_DISABLE_AUTO_START';

/** 环境变量: 服务器端口 */
export const ENV_MCP_PORT = 'MCP_PORT';

/** 环境变量: 存储路径 */
export const ENV_MCP_STORAGE_PATH = 'MCP_STORAGE_PATH';

/** 服务器锁文件名 */
export const SERVER_LOCK_FILE = 'server.lock';

/** 锁超时时间 (毫秒) */
export const LOCK_TIMEOUT = 30000;

/** 重连初始间隔 (毫秒) */
export const RECONNECT_INITIAL_DELAY = 1000;

/** 重连最大间隔 (毫秒) */
export const RECONNECT_MAX_DELAY = 10000;

/** 重连退避倍数 */
export const RECONNECT_MULTIPLIER = 1.5;

/** 最大重连次数 */
export const RECONNECT_MAX_ATTEMPTS = 10;

/** 重启前等待时间 (毫秒) */
export const RESTART_WAIT_TIME = 1000;

/** 环境变量: 强制重启 */
export const ENV_FORCE_RESTART = 'MCP_FORCE_RESTART';
