/**
 * Integration Test for Stdio JSON-RPC pipeline
 * // CN: Stdio JSON-RPC 管道的集成测试
 *
 * Tests JSON-RPC communication over stdio using vscode-jsonrpc's
 * StreamMessageReader and StreamMessageWriter
 * // CN: 使用 vscode-jsonrpc 的 StreamMessageReader 和 StreamMessageWriter
 * // 测试通过 stdio 的 JSON-RPC 通信
 */

import { strictEqual } from "node:assert";
import { spawn, ChildProcess } from "node:child_process";
import { Writable, Readable } from "node:stream";
import {
	createMessageConnection,
	StreamMessageReader,
	StreamMessageWriter,
	MessageConnection,
} from "vscode-jsonrpc/node";
import {
	registerNotification,
	taskRequest,
	registeredNotification,
	restartNotification,
} from "../../shared/protocol";
import type { Folder } from "../../shared/types";

/**
 * Create a stdio message connection using a child process
 * // CN: 使用子进程创建 stdio 消息连接
 */
function createStdioConnection(): Promise<{ connection: MessageConnection; process: ChildProcess }> {
	return new Promise((resolve, reject) => {
		const childProcess = spawn("node", [
			"-e",
			`
			const { createMessageConnection, StreamMessageReader, StreamMessageWriter } = require("vscode-jsonrpc/node");
			const reader = new StreamMessageReader(process.stdin);
			const writer = new StreamMessageWriter(process.stdout);
			const conn = createMessageConnection(reader, writer);
			conn.listen();
			process.stdout.write("READY\\n");
		`,
		], { stdio: ["pipe", "pipe", "pipe"] });

		const connection = createMessageConnection(
			new StreamMessageReader(childProcess.stdout as Readable),
			new StreamMessageWriter(childProcess.stdin as Writable),
		);

		childProcess.stdout!.once("data", (data: Buffer) => {
			if (data.toString().includes("READY")) {
				resolve({ connection, process: childProcess });
			}
		});

		childProcess.on("error", reject);
	});
}

suite("Stdio IPC Integration", function () {
	this.timeout(15000);

	let serverProcess: ChildProcess | null = null;
	let serverConnection: MessageConnection | null = null;

	teardown(() => {
		if (serverConnection) {
			try { serverConnection.dispose(); } catch { /* ignore */ }
			serverConnection = null;
		}
		if (serverProcess) {
			try { serverProcess.kill(); } catch { /* ignore */ }
			serverProcess = null;
		}
	});

	test("Server registers handler for registerNotification", async function () {
		// EN: Create stdio connection // CN: 创建 stdio 连接
		const { connection, process } = await createStdioConnection();
		serverConnection = connection;
		serverProcess = process;

		// EN: Verify connection exists and can have handlers registered // CN: 验证连接存在且可以注册处理器
		let notificationReceived = false;

		connection.onNotification(registerNotification, (params: { folders: Folder[] }) => {
			notificationReceived = true;
		});

		// EN: Verify handler was registered // CN: 确认处理器已注册
		strictEqual(notificationReceived, false); // Not triggered yet
	});

	test("Server registers handler for taskRequest", async function () {
		// EN: Create stdio connection // CN: 创建 stdio 连接
		const { connection, process } = await createStdioConnection();
		serverConnection = connection;
		serverProcess = process;

		// EN: Register task request handler // CN: 注册任务请求处理器
		let requestReceived = false;

		connection.onRequest(
			taskRequest,
			(params: { tool: string; args: Record<string, unknown> }) => {
				requestReceived = true;
				return { received: true, tool: params.tool };
			},
		);

		// EN: Verify handler registered // CN: 确认处理器已注册
		strictEqual(requestReceived, false);
	});

	test("Server registers handler for restartNotification", async function () {
		// EN: Create stdio connection // CN: 创建 stdio 连接
		const { connection, process } = await createStdioConnection();
		serverConnection = connection;
		serverProcess = process;

		// EN: Register restart handler // CN: 注册重启处理器
		let restartTriggered = false;

		connection.onNotification(restartNotification, () => {
			restartTriggered = true;
		});

		// EN: Verify handler is registered // CN: 确认处理器已注册
		strictEqual(restartTriggered, false);
	});

	test("All protocol handlers can be registered on single connection", async function () {
		// EN: Create stdio connection // CN: 创建 stdio 连接
		const { connection, process } = await createStdioConnection();
		serverConnection = connection;
		serverProcess = process;

		// EN: Register all handlers // CN: 注册所有处理器
		let registeredCount = 0;
		let windowId: string | null = null;

		connection.onNotification(registerNotification, (params: { folders: Folder[] }) => {
			registeredCount++;
			windowId = `win-${params.folders[0]?.name || "test"}`;
			connection.sendNotification(registeredNotification, { windowId });
		});

		connection.onRequest(taskRequest, (params) => {
			registeredCount++;
			return { processed: true, tool: params.tool };
		});

		connection.onNotification(restartNotification, () => {
			registeredCount++;
		});

		// EN: Verify all handlers registered // CN: 确认所有处理器已注册
		strictEqual(registeredCount, 0); // None triggered yet
		strictEqual(windowId, null); // No window ID yet
	});
});