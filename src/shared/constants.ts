/**
 * Shared constant definitions
 * // CN: 共享常量定义
 */

/** Default MCP server port // CN: MCP 服务器默认端口 */
export const DEFAULT_PORT = 53221;

/** Request timeout in milliseconds // CN: 请求超时时间 (毫秒) */
export const DEFAULT_TIMEOUT = 30000;

/** Server shutdown delay in milliseconds // CN: 服务器关闭延迟 (毫秒) */
export const SHUTDOWN_DELAY = 30000;

/** Default page size // CN: 分页大小 */
export const DEFAULT_PAGE_SIZE = 50;

/** Default context lines // CN: 上下文行数 */
export const DEFAULT_CONTEXT_LINES = 3;

/** Diagnostics wait timeout in milliseconds // CN: 诊断等待超时时间 (毫秒) */
export const DEFAULT_DIAGNOSTICS_TIMEOUT = 5000;

/** Number of nearest symbols to suggest // CN: 查找最近同名符号的数量 */
export const DEFAULT_NEAREST_SYMBOLS_COUNT = 3;

/** Maximum output lines for symbol structure // CN: 符号结构最大输出行数 */
export const DEFAULT_MAX_STRUCT_LINES = 200;

/** Maximum debug log entries // CN: 调试日志最大条目数 */
export const MAX_DEBUG_ENTRIES = 500;

/** Server state file name // CN: 服务器状态文件名 */
export const SERVER_STATE_FILE = "server.json";

/** Health check path // CN: 服务器健康检查路径 */
export const HEALTH_PATH = "/health";

/** MCP endpoint path (new Streamable HTTP API) // CN: MCP 端点路径 (新 Streamable HTTP API) */
export const MCP_ENDPOINT = "/mcp";

/** WebSocket path // CN: WebSocket 路径 */
export const WS_PATH = "/ws";

/** Server startup timeout in milliseconds // CN: 服务器启动超时 (毫秒) */
export const SERVER_STARTUP_TIMEOUT = 5000;

/** Health check polling interval in milliseconds // CN: 健康检查轮询间隔 (毫秒) */
export const HEALTH_CHECK_INTERVAL = 200;

/** Environment variable: Disable auto-start server // CN: 环境变量: 禁用自动启动服务器 */
export const ENV_DISABLE_AUTO_START = "IDE_LSP_MCP_DISABLE_AUTO_START";

/** Environment variable: Server port // CN: 环境变量: 服务器端口 */
export const ENV_MCP_PORT = "MCP_PORT";

/** Environment variable: Storage path // CN: 环境变量: 存储路径 */
export const ENV_MCP_STORAGE_PATH = "MCP_STORAGE_PATH";

/** Server lock file name // CN: 服务器锁文件名 */
export const SERVER_LOCK_FILE = "server.lock";

/** Lock timeout in milliseconds // CN: 锁超时时间 (毫秒) */
export const LOCK_TIMEOUT = 30000;

/** Initial reconnection delay in milliseconds // CN: 重连初始间隔 (毫秒) */
export const RECONNECT_INITIAL_DELAY = 1000;

/** Maximum reconnection delay in milliseconds // CN: 重连最大间隔 (毫秒) */
export const RECONNECT_MAX_DELAY = 10000;

/** Reconnection backoff multiplier // CN: 重连退避倍数 */
export const RECONNECT_MULTIPLIER = 1.5;

/** Maximum reconnection attempts // CN: 最大重连次数 */
export const RECONNECT_MAX_ATTEMPTS = 10;

/** Wait time before restart in milliseconds // CN: 重启前等待时间 (毫秒) */
export const RESTART_WAIT_TIME = 1000;

/** Environment variable: Force restart // CN: 环境变量: 强制重启 */
export const ENV_FORCE_RESTART = "MCP_FORCE_RESTART";
