/**
 * Integration Test for IPC JSON-RPC pipeline
 * // CN: IPC JSON-RPC 管道的集成测试
 */

import { strictEqual, deepStrictEqual } from "node:assert";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { ServerConnection } from "../../client/ServerConnection";
import { IpcServer } from "../../server/IpcServer";
import { ClientRegistry } from "../../server/ClientRegistry";
import { TaskManager } from "../../server/TaskManager";
import { ShutdownManager } from "../../server/ShutdownManager";
import * as vscode from "vscode";

suite("IPC Integration Pipeline", function () {
	this.timeout(10000); // Allow time for pipe communication

	let pipePath: string;
	let server: IpcServer;
	let client: ServerConnection;
	let registry: ClientRegistry;
	let taskManager: TaskManager;

	setup((done) => {
		const hash = crypto.randomUUID().slice(0, 8);
		
		if (process.platform === "win32") {
			pipePath = `\\\\.\\pipe\\vscode-lsp-mcp-test-${hash}`;
		} else {
			pipePath = path.join(os.tmpdir(), `mcp-ipc-test-${hash}.sock`);
		}

		registry = new ClientRegistry();
		taskManager = new TaskManager();
		const shutdownManager = new ShutdownManager(registry, () => {});

		server = new IpcServer(registry, taskManager, shutdownManager);
		server.listen(pipePath, () => {
			client = new ServerConnection(pipePath);
			done();
		});
	});

	teardown(async () => {
		client.disconnect();
		await server.close();
	});

	test("Client to Server full roundtrip over Named Pipes", async function () {
		// Set up the client task processor (usually TaskExecutor)
		client.onTask(async (tool, args, token) => {
			strictEqual(tool, "test_tool_roundtrip");
			deepStrictEqual(args, { key: "value" });
			return { formatted: "success" };
		});

		// Start client connection
		await client.connect();

		// Wait briefly for server connection registration asynchronously
		await new Promise(resolve => setTimeout(resolve, 500)); 

		strictEqual(registry.size, 1, "Server should have received registration and captured 1 active ClientInfo");
		
		const registeredClient = registry.getAllClients()[0];
		strictEqual(registeredClient !== undefined, true);

		// Dispatch from TaskManager directly onto the Client ExtHost mimicking Claude logic natively
		const result = await taskManager.dispatch(registeredClient, "test_tool_roundtrip", { key: "value" });
		
		deepStrictEqual(result, { formatted: "success" });
	});
});
