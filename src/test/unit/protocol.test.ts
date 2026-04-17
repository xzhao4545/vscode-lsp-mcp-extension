/**
 * Protocol message types unit tests
 * // CN: 协议消息类型单元测试
 */

import { expect } from "chai";
import {
	ClientMessage,
	ServerMessage,
	RegisterMessage,
	ResultMessage,
	ErrorMessage,
	RestartMessage,
	RegisteredMessage,
	TaskMessage,
	Message,
} from "../../shared/protocol";
import type { Folder } from "../../shared/types";

suite("Protocol Types Test Suite", () => {
	// ============ Client Messages (Window → Server) ============
	// EN: 客户端消息 (窗口 → 服务器)

	describe("RegisterMessage", () => {
		test("should serialize and deserialize correctly", () => {
			const folders: Folder[] = [
				{ name: "test-folder", path: "/path/to/test" },
				{ name: "project", path: "/path/to/project" },
			];
			const msg: RegisterMessage = { type: "register", folders };
			const json = JSON.stringify(msg);
			const parsed = JSON.parse(json) as RegisterMessage;

			expect(parsed.type).to.equal("register");
			expect(parsed.folders).to.have.lengthOf(2);
			expect(parsed.folders[0].name).to.equal("test-folder");
			expect(parsed.folders[0].path).to.equal("/path/to/test");
			expect(parsed.folders[1].name).to.equal("project");
			expect(parsed.folders[1].path).to.equal("/path/to/project");
		});

		test("should handle empty folders array", () => {
			const msg: RegisterMessage = { type: "register", folders: [] };
			const json = JSON.stringify(msg);
			const parsed = JSON.parse(json) as RegisterMessage;

			expect(parsed.type).to.equal("register");
			expect(parsed.folders).to.be.an("array").that.is.empty;
		});

		test("should preserve type discriminator after round-trip", () => {
			const msg: RegisterMessage = {
				type: "register",
				folders: [{ name: "test", path: "/test" }],
			};
			const roundTrip = JSON.parse(JSON.stringify(msg)) as RegisterMessage;

			expect(roundTrip.type).to.equal("register");
			expect(roundTrip).to.have.property("folders");
		});
	});

	describe("ResultMessage", () => {
		test("should serialize and deserialize with data structure", () => {
			const data = { result: "success", items: [1, 2, 3] };
			const msg: ResultMessage = {
				type: "result",
				requestId: "req-123",
				data,
			};
			const json = JSON.stringify(msg);
			const parsed = JSON.parse(json) as ResultMessage;

			expect(parsed.type).to.equal("result");
			expect(parsed.requestId).to.equal("req-123");
			expect(parsed.data).to.deep.equal(data);
		});

		test("should handle complex nested data", () => {
			const complexData = {
				symbols: [
					{ name: "func1", kind: "function", uri: "file:///a.ts", line: 10 },
					{
						name: "class1",
						kind: "class",
						uri: "file:///b.ts",
						line: 20,
						children: [{ name: "inner", kind: "method", line: 25 }],
					},
				],
				hasMore: true,
				total: 100,
			};
			const msg: ResultMessage = {
				type: "result",
				requestId: "req-complex",
				data: complexData,
			};
			const parsed = JSON.parse(JSON.stringify(msg)) as ResultMessage;

			expect(parsed.data).to.deep.equal(complexData);
			const data = parsed.data as typeof complexData;
			expect(data.symbols[1].children).to.have.lengthOf(1);
		});

		test("should handle null data", () => {
			const msg: ResultMessage = {
				type: "result",
				requestId: "req-null",
				data: null,
			};
			const parsed = JSON.parse(JSON.stringify(msg)) as ResultMessage;

			expect(parsed.data).to.be.null;
		});

		test("should handle undefined data", () => {
			const msg: ResultMessage = {
				type: "result",
				requestId: "req-undefined",
				// data is required, undefined should work
				data: undefined,
			};
			const json = JSON.stringify(msg);
			const parsed = JSON.parse(json) as ResultMessage;

			expect(parsed.requestId).to.equal("req-undefined");
		});
	});

	describe("ErrorMessage", () => {
		test("should serialize and deserialize error structure", () => {
			const msg: ErrorMessage = {
				type: "error",
				requestId: "req-err-001",
				error: { code: "FILE_NOT_FOUND", message: "File not found" },
			};
			const json = JSON.stringify(msg);
			const parsed = JSON.parse(json) as ErrorMessage;

			expect(parsed.type).to.equal("error");
			expect(parsed.requestId).to.equal("req-err-001");
			expect(parsed.error.code).to.equal("FILE_NOT_FOUND");
			expect(parsed.error.message).to.equal("File not found");
		});

		test("should handle error without code", () => {
			const msg: ErrorMessage = {
				type: "error",
				requestId: "req-err-002",
				error: { message: "Something went wrong" },
			};
			const json = JSON.stringify(msg);
			const parsed = JSON.parse(json) as ErrorMessage;

			expect(parsed.error.code).to.be.undefined;
			expect(parsed.error.message).to.equal("Something went wrong");
		});

		test("should preserve error structure after round-trip", () => {
			const msg: ErrorMessage = {
				type: "error",
				requestId: "req-err-003",
				error: { code: "TIMEOUT", message: "Request timed out" },
			};
			const roundTrip = JSON.parse(JSON.stringify(msg)) as ErrorMessage;

			expect(roundTrip.error).to.have.property("message");
			expect(roundTrip.error.message).to.equal("Request timed out");
		});
	});

	describe("RestartMessage", () => {
		test("should serialize minimal restart message", () => {
			const msg: RestartMessage = { type: "restart" };
			const json = JSON.stringify(msg);
			const parsed = JSON.parse(json) as RestartMessage;

			expect(parsed.type).to.equal("restart");
		});

		test("should only have type property", () => {
			const msg: RestartMessage = { type: "restart" };
			const json = JSON.stringify(msg);
			const parsed = JSON.parse(json) as RestartMessage;

			const keys = Object.keys(parsed);
			expect(keys).to.have.lengthOf(1);
			expect(keys).to.include("type");
		});
	});

	// ============ Server Messages (Server → Window) ============
	// EN: 服务器消息 (服务器 → 窗口)

	describe("RegisteredMessage", () => {
		test("should serialize and deserialize windowId", () => {
			const msg: RegisteredMessage = {
				type: "registered",
				windowId: "window-abc-123",
			};
			const json = JSON.stringify(msg);
			const parsed = JSON.parse(json) as RegisteredMessage;

			expect(parsed.type).to.equal("registered");
			expect(parsed.windowId).to.equal("window-abc-123");
		});

		test("should preserve windowId after round-trip", () => {
			const msg: RegisteredMessage = {
				type: "registered",
				windowId: "unique-window-id",
			};
			const roundTrip = JSON.parse(JSON.stringify(msg)) as RegisteredMessage;

			expect(roundTrip.windowId).to.equal("unique-window-id");
		});
	});

	describe("TaskMessage", () => {
		test("should serialize and deserialize task fields", () => {
			const msg: TaskMessage = {
				type: "task",
				requestId: "task-req-001",
				tool: "goToDefinition",
				args: {
					projectPath: "/project",
					filePath: "src/main.ts",
					line: 42,
					character: 10,
				},
			};
			const json = JSON.stringify(msg);
			const parsed = JSON.parse(json) as TaskMessage;

			expect(parsed.type).to.equal("task");
			expect(parsed.requestId).to.equal("task-req-001");
			expect(parsed.tool).to.equal("goToDefinition");
			expect(parsed.args.projectPath).to.equal("/project");
			expect(parsed.args.filePath).to.equal("src/main.ts");
			expect(parsed.args.line).to.equal(42);
			expect(parsed.args.character).to.equal(10);
		});

		test("should handle empty args", () => {
			const msg: TaskMessage = {
				type: "task",
				requestId: "task-req-002",
				tool: "listOpenProjects",
				args: {},
			};
			const parsed = JSON.parse(JSON.stringify(msg)) as TaskMessage;

			expect(parsed.args).to.deep.equal({});
		});

		test("should handle complex args with nested objects", () => {
			const msg: TaskMessage = {
				type: "task",
				requestId: "task-req-003",
				tool: "searchSymbolInWorkspace",
				args: {
					projectPath: "/project",
					query: "function",
					symbolType: "method",
					page: 1,
				},
			};
			const parsed = JSON.parse(JSON.stringify(msg)) as TaskMessage;

			expect(parsed.args.query).to.equal("function");
			expect(parsed.args.symbolType).to.equal("method");
			expect(parsed.args.page).to.equal(1);
		});
	});

	// ============ Union Types ============
	// EN: 联合类型测试

	describe("ClientMessage union", () => {
		test("should accept RegisterMessage", () => {
			const msg: ClientMessage = {
				type: "register",
				folders: [{ name: "test", path: "/test" }],
			};
			expect(msg.type).to.equal("register");
		});

		test("should accept ResultMessage", () => {
			const msg: ClientMessage = {
				type: "result",
				requestId: "req-1",
				data: { ok: true },
			};
			expect(msg.type).to.equal("result");
		});

		test("should accept ErrorMessage", () => {
			const msg: ClientMessage = {
				type: "error",
				requestId: "req-2",
				error: { message: "fail" },
			};
			expect(msg.type).to.equal("error");
		});

		test("should accept RestartMessage", () => {
			const msg: ClientMessage = { type: "restart" };
			expect(msg.type).to.equal("restart");
		});

		test("should narrow type correctly with discriminated union", () => {
			const messages: ClientMessage[] = [
				{ type: "register", folders: [] },
				{ type: "result", requestId: "1", data: null },
				{ type: "error", requestId: "2", error: { message: "err" } },
				{ type: "restart" },
			];

			expect(messages[0].type).to.equal("register");
			expect(messages[1].type).to.equal("result");
			expect(messages[2].type).to.equal("error");
			expect(messages[3].type).to.equal("restart");
		});
	});

	describe("ServerMessage union", () => {
		test("should accept RegisteredMessage", () => {
			const msg: ServerMessage = {
				type: "registered",
				windowId: "win-1",
			};
			expect(msg.type).to.equal("registered");
		});

		test("should accept TaskMessage", () => {
			const msg: ServerMessage = {
				type: "task",
				requestId: "task-1",
				tool: "test",
				args: {},
			};
			expect(msg.type).to.equal("task");
		});

		test("should narrow type correctly with discriminated union", () => {
			const messages: ServerMessage[] = [
				{ type: "registered", windowId: "win-1" },
				{ type: "task", requestId: "task-1", tool: "test", args: {} },
			];

			expect(messages[0].type).to.equal("registered");
			expect(messages[1].type).to.equal("task");
		});
	});

	describe("Message union (all types)", () => {
		test("should accept all client and server message types", () => {
			const allMessages: Message[] = [
				// Client messages
				{ type: "register", folders: [] },
				{ type: "result", requestId: "1", data: null },
				{ type: "error", requestId: "2", error: { message: "" } },
				{ type: "restart" },
				// Server messages
				{ type: "registered", windowId: "1" },
				{ type: "task", requestId: "3", tool: "x", args: {} },
			];

			expect(allMessages).to.have.lengthOf(6);
		});
	});
});
