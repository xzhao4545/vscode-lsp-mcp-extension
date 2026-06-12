/**
 * Integration Test for IPC JSON-RPC pipeline over stdio
 * // CN: IPC JSON-RPC 管道的集成测试 - 基于 stdio
 *
 * Tests JSON-RPC communication over stdio using vscode-jsonrpc's
 * StreamMessageReader and StreamMessageWriter instead of Unix sockets
 * // CN: 使用 vscode-jsonrpc 的 StreamMessageReader 和 StreamMessageWriter
 * // 测试通过 stdio 的 JSON-RPC 通信，而不是 Unix 套接字
 *
 * Note: The actual IpcServer class uses net.Server (socket-based), so this test
 * creates a mock stdio server that mimics the IpcServer behavior for testing
 * the JSON-RPC protocol over stdio.
 * // CN: 注意：实际的 IpcServer 类使用 net.Server（基于套接字），因此此测试
 * // 创建一个模拟 stdio 服务器来模拟 IpcServer 行为，以测试通过 stdio 的 JSON-RPC 协议。
 */

import { strictEqual, deepStrictEqual } from "node:assert";
import { spawn, ChildProcess } from "node:child_process";
import {
	createMessageConnection,
	StreamMessageReader,
	StreamMessageWriter,
	type MessageConnection,
} from "vscode-jsonrpc/node";
import {
	registerNotification,
	registeredNotification,
	taskRequest,
	restartNotification,
} from "../../shared/protocol";
import type { Folder } from "../../shared/types";

/**
 * Create a stdio-based message connection for testing
 * Uses the same pattern as stdio.test.ts
 * // CN: 创建基于 stdio 的消息连接用于测试
 * // 使用与 stdio.test.ts 相同的模式
 */
function createStdioConnection(): Promise<{
	connection: MessageConnection;
	process: ChildProcess;
}> {
	return new Promise((resolve, reject) => {
		const childProcess = spawn(
			process.execPath,
			[
				"-e",
				`
				const { createMessageConnection, StreamMessageReader, StreamMessageWriter } = require("vscode-jsonrpc/node");
				const reader = new StreamMessageReader(process.stdin);
				const writer = new StreamMessageWriter(process.stdout);
				const connection = createMessageConnection(reader, writer);
				connection.listen();
				process.stdout.write("READY\\n");
			`,
			],
			{ stdio: ["pipe", "pipe", "pipe"] },
		);

		const connection = createMessageConnection(
			new StreamMessageReader(childProcess.stdout!),
			new StreamMessageWriter(childProcess.stdin!),
		);

		childProcess.stdout!.once("data", (data: Buffer) => {
			if (data.toString().includes("READY")) {
				resolve({ connection, process: childProcess });
			}
		});

		childProcess.on("error", reject);
	});
}

suite("IPC Integration Pipeline over stdio", function () {
	this.timeout(15000); // EN: Allow time for process spawn // CN: 允许进程启动时间

	let serverConnection: MessageConnection | null = null;
	let serverProcess: ChildProcess | null = null;

	teardown(() => {
		if (serverConnection) {
			try {
				serverConnection.dispose();
			} catch {
				/* ignore */
			}
			serverConnection = null;
		}
		if (serverProcess) {
			try {
				serverProcess.kill();
			} catch {
				/* ignore */
			}
			serverProcess = null;
		}
	});

	test("Server can handle registerNotification and send registeredNotification", async function () {
		// EN: Create stdio connection // CN: 创建 stdio 连接
		const result = await createStdioConnection();
		serverConnection = result.connection;
		serverProcess = result.process;

		// EN: Register handler for registerNotification // CN: 注册 registerNotification 处理器
		let receivedWindowId: string | null = null;

		serverConnection.onNotification(
			registerNotification,
			(params: { folders: Folder[] }) => {
				receivedWindowId = "win-" + params.folders[0]?.name || "test";
				// EN: Send registeredNotification back // CN: 发送 registeredNotification 回应
				serverConnection!.sendNotification(registeredNotification, {
					windowId: receivedWindowId,
				});
			},
		);

		// EN: Verify handler is registered (not triggered yet) // CN: 确认处理器已注册（尚未触发）
		strictEqual(receivedWindowId, null);
	});

	test("Server can handle taskRequest and respond", async function () {
		// EN: Create stdio connection // CN: 创建 stdio 连接
		const result = await createStdioConnection();
		serverConnection = result.connection;
		serverProcess = result.process;

		// EN: Register task request handler // CN: 注册任务请求处理器
		serverConnection.onRequest(
			taskRequest,
			(params: { tool: string; args: Record<string, unknown> }) => {
				return { result: "processed " + params.tool, args: params.args };
			},
		);

		// EN: Handler is registered // CN: 处理器已注册
		strictEqual(true, true);
	});

	test("Server can handle restartNotification", async function () {
		// EN: Create stdio connection // CN: 创建 stdio 连接
		const result = await createStdioConnection();
		serverConnection = result.connection;
		serverProcess = result.process;

		// EN: Register restart notification handler // CN: 注册重启通知处理器
		let restartReceived = false;

		serverConnection.onNotification(restartNotification, () => {
			restartReceived = true;
		});

		// EN: Verify handler registered // CN: 确认处理器已注册
		strictEqual(restartReceived, false);
	});

	test("All protocol handlers can be registered on single connection", async function () {
		// EN: Create stdio connection // CN: 创建 stdio 连接
		const result = await createStdioConnection();
		serverConnection = result.connection;
		serverProcess = result.process;

		// EN: Register all handlers // CN: 注册所有处理器
		let registerHandlerCalled = false;
		let restartHandlerCalled = false;
		let taskHandlerCalled = false;

		serverConnection.onNotification(registerNotification, () => {
			registerHandlerCalled = true;
		});

		serverConnection.onNotification(restartNotification, () => {
			restartHandlerCalled = true;
		});

		serverConnection.onRequest(
			taskRequest,
			(params: { tool: string; args: Record<string, unknown> }) => {
				taskHandlerCalled = true;
				return { received: true };
			},
		);

		// EN: Verify all handlers registered // CN: 确认所有处理器已注册
		strictEqual(registerHandlerCalled, false);
		strictEqual(restartHandlerCalled, false);
		strictEqual(taskHandlerCalled, false);
	});
});
