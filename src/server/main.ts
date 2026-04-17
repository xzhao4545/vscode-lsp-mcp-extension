import * as http from "node:http";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
	DEFAULT_PORT,
	RESTART_WAIT_TIME,
	SERVER_LOCK_FILE,
} from "../shared/constants";
import { FileLock, isProcessAlive } from "../shared/fileLock";
import { StateFile } from "../shared/stateFile";
import { type ServerStateData, StateUtils, getIpcPath } from "../shared/types";
import { ClientRegistry } from "./ClientRegistry";
import { McpServer } from "./McpServer";
import { ShutdownManager } from "./ShutdownManager";
import { StateFileWatcher } from "./StateFileWatcher";
import { TaskManager } from "./TaskManager";
import { IpcServer } from "./IpcServer";

function parseArgs(): {
	port: number;
	storagePath: string;
	forceRestart: boolean;
	enableCors: boolean;
} {
	const args = process.argv.slice(2);
	let port = DEFAULT_PORT;
	let storagePath = "";
	let forceRestart = false;
	let enableCors = false;

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case "--port":
			case "-p":
				port = parseInt(args[++i], 10);
				break;
			case "--storage":
			case "-s":
				storagePath = args[++i];
				break;
			case "--force":
			case "-f":
				forceRestart = true;
				break;
			case "--cors":
			case "-c":
				enableCors = true;
				break;
		}
	}

	return { port, storagePath, forceRestart, enableCors };
}

const { port, storagePath, forceRestart, enableCors } = parseArgs();
if (storagePath.length === 0) {
	console.log("[Server] --storage <path> is required");
	process.exit(1);
}
const lockPath = path.join(storagePath, SERVER_LOCK_FILE);
const stateFile = new StateFile(storagePath);
const fileLock = new FileLock(lockPath);

let httpServer: http.Server | null = null;
let ipcServer: IpcServer | null = null;
let stateFileWatcher: StateFileWatcher | null = null;
let taskManager: TaskManager | null = null;
let mcpServer: McpServer | null = null;
let shutdownManager: ShutdownManager | null = null;
let currentState: ServerStateData | null = null;
let shutdownPromise: Promise<void> | null = null;
let shuttingDown = false;
let exitCode = 0;
let lockReleased = false;

async function main(): Promise<void> {
	console.log(`[Server] Starting MCP server on port ${port}...`);

	const lockAcquired = await fileLock.tryAcquire(0);
	if (!lockAcquired) {
		console.log("[Server] Another process is starting the server, exiting...");
		process.exit(0);
	}

	const existingState = await stateFile.read();
	try {
		const hasServerRunning =
			existingState &&
			StateUtils.isRunning(existingState.state) &&
			isProcessAlive(existingState.pid);
		if (hasServerRunning && !forceRestart) {
			console.log("[Server] Server already running, exiting...");
			await stateFile.writeAlreadyRunning(existingState);
			await releaseLock();
			process.exit(0);
		}

		currentState = await stateFile.writeStarting(port);
		if (hasServerRunning) {
			await sleep(200);
		}
		await startServer();
	} catch (err) {
		await handleStartupError(err, existingState);
	}
}

async function startServer(): Promise<void> {
	const registry = new ClientRegistry();
	taskManager = new TaskManager();
	const taskMgr = taskManager;
	if (!taskMgr) {
		throw new Error("Task manager not initialized");
	}
	shutdownManager = new ShutdownManager(registry, () =>
		requestShutdown("idle", { removeStateFile: true }),
	);
	mcpServer = new McpServer(registry, taskMgr, enableCors);
	const activeMcpServer = mcpServer;

	httpServer = http.createServer((req, res) => {
		const server = activeMcpServer;
		if (!server) {
			res.writeHead(503, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Server shutting down" }));
			return;
		}

		server.handleRequest(req, res).catch((err) => {
			console.error("[Server] Request error:", err);
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Internal server error" }));
		});
	});

	const idleShutdownManager = shutdownManager;
	if (!idleShutdownManager) {
		throw new Error("Shutdown manager not initialized");
	}

	ipcServer = new IpcServer(
		registry,
		taskMgr,
		idleShutdownManager,
	);

	ipcServer.onRestart(() => {
		void handleRestartRequest();
	});

	const server = httpServer;
	if (!server) {
		throw new Error("HTTP server not initialized");
	}

	// Start the IPC server independently from HTTP port
	const ipcPath = currentState?.pipePath || getIpcPath(storagePath);
	ipcServer.listen(ipcPath);

	await new Promise<void>((resolve, reject) => {
		server.once("error", (err: NodeJS.ErrnoException) => {
			reject(err);
		});

		server.listen(port, () => {
			void (async () => {
				try {
					console.log(`[Server] MCP server listening on port ${port}`);
					const runningState = currentState;
					if (!runningState) {
						throw new Error("Server state not initialized");
					}
					currentState = await stateFile.writeRunning(port, runningState);
					await releaseLock();
					if (!currentState) {
						throw new Error("Server state not initialized");
					}
					stateFileWatcher = new StateFileWatcher(stateFile, currentState, () =>
						requestShutdown("state-file"),
					);
					stateFileWatcher.start();
					console.log(`[Server] State file written, lock released`);
					resolve();
				} catch (err) {
					reject(err);
				}
			})();
		});
	});
}

async function handleStartupError(
	err: unknown,
	rawState: ServerStateData | null,
): Promise<void> {
	const error = err as NodeJS.ErrnoException;

	if (error.code === "EADDRINUSE") {
		console.error(`[Server] Port ${port} is already in use`);
		currentState = await stateFile.writePortConflict(
			port,
			rawState,
			`Port ${port} is already in use`,
		);
	} else {
		console.error("[Server] Failed to start:", error.message);
		currentState = await stateFile.writeError(port, rawState, error.message);
	}
	await releaseLock();
	process.exit(1);
}

async function handleRestartRequest(): Promise<void> {
	if (shuttingDown) {
		return;
	}

	console.log("[Server] Restart requested...");
	const restartingState = currentState;
	if (!restartingState) {
		throw new Error("Server state not initialized");
	}
	currentState = await stateFile.writeRestarting(port, restartingState);
	await sleep(RESTART_WAIT_TIME);
	await requestShutdown("restart");
}

async function requestShutdown(
	reason: string,
	options?: { removeStateFile?: boolean; code?: number },
): Promise<void> {
	if (shutdownPromise) {
		return shutdownPromise;
	}

	shuttingDown = true;
	exitCode = options?.code ?? 0;
	console.log(`[Server] Shutting down (${reason})...`);

	shutdownPromise = (async () => {
		stateFileWatcher?.stop();
		shutdownManager?.stop();
		taskManager?.cleanup();
		await ipcServer?.close();
		await mcpServer?.close();
		await closeHttpServer();

		if (options?.removeStateFile) {
			await stateFile.remove();
		} else if (currentState) {
			currentState = await stateFile.writeStopped(port, currentState);
		} else {
			currentState = await stateFile.writeStopped(port, null);
		}

		await releaseLock();
	})();

	try {
		await shutdownPromise;
	} finally {
		process.exit(exitCode);
	}
}

async function closeHttpServer(): Promise<void> {
	if (!httpServer) {
		return;
	}

	const server = httpServer;
	httpServer = null;
	await new Promise<void>((resolve) => {
		server.close(() => resolve());
	});
}

async function releaseLock(): Promise<void> {
	if (lockReleased) {
		return;
	}
	lockReleased = true;
	await fileLock.release();
}

process.on("SIGTERM", () => {
	console.log("[Server] Received SIGTERM");
	void requestShutdown("sigterm");
});

process.on("SIGINT", () => {
	console.log("[Server] Received SIGINT");
	void requestShutdown("sigint");
});

main().catch((err) => {
	console.error("[Server] Fatal error:", err);
	process.exit(1);
});
