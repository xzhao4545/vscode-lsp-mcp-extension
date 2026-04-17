/**
 * TaskManager Unit Tests
 * // CN: TaskManager 单元测试
 */

import { deepStrictEqual, strictEqual, throws } from "node:assert";
import sinon, { type SinonStub } from "sinon";
import { TaskManager } from "../../server/TaskManager";
import type { ClientInfo } from "../../server/ClientRegistry";
import { DEFAULT_TIMEOUT } from "../../shared/constants";
import WebSocket from "ws";

/**
 * Create a mock ClientInfo with a stub WebSocket
 * // CN: 创建带有 stub WebSocket 的模拟 ClientInfo
 */
function createMockClient(): ClientInfo {
	const wsStub = sinon.createStubInstance(WebSocket);
	return {
		ws: wsStub as unknown as WebSocket,
		windowId: "test-window-1",
		folders: [],
		connectedAt: Date.now(),
	};
}

/**
 * Get the send stub from a ClientInfo's WebSocket
 */
function getSendStub(client: ClientInfo): SinonStub {
	return client.ws.send as unknown as SinonStub;
}

suite("TaskManager", function () {
	let clock: sinon.SinonFakeTimers;
	let taskManager: TaskManager;

	setup(() => {
		// EN: Use fake timers for timeout tests // CN: 使用假计时器进行超时测试
		clock = sinon.useFakeTimers();
		taskManager = new TaskManager();
	});

	teardown(() => {
		clock.restore();
		sinon.restore();
	});

	suite("dispatch()", function () {
		test("sends task via WebSocket and resolves on result", async function () {
			const client = createMockClient();
			const tool = "testTool";
			const args = { arg1: "value1" };
			const requestData = { success: true, data: "test result" };

			// EN: Start dispatch - it returns a promise // CN: 开始 dispatch - 返回 promise
			const dispatchPromise = taskManager.dispatch(client, tool, args);

			// EN: Extract the requestId from the WebSocket.send call // CN: 从 WebSocket.send 调用中提取 requestId
			const sendStub = getSendStub(client);
			const sendCall = sendStub.getCall(0);
			const message = JSON.parse(sendCall.firstArg);
			const { requestId } = message;

			strictEqual(message.type, "task");
			strictEqual(message.tool, tool);
			deepStrictEqual(message.args, args);

			// EN: Simulate server sending result // CN: 模拟服务器发送结果
			taskManager.handleResult(requestId, requestData);

			// EN: Promise should resolve // CN: Promise 应该 resolve
			const result = await dispatchPromise;
			deepStrictEqual(result, requestData);
		});

		test("rejects on error message", async function () {
			const client = createMockClient();
			const tool = "testTool";
			const args = { arg1: "value1" };
			const errorMessage = "Task failed with error";

			// EN: Start dispatch // CN: 开始 dispatch
			const dispatchPromise = taskManager.dispatch(client, tool, args);

			// EN: Extract requestId // CN: 提取 requestId
			const sendStub = getSendStub(client);
			const sendCall = sendStub.getCall(0);
			const message = JSON.parse(sendCall.firstArg);
			const { requestId } = message;

			// EN: Simulate server sending error // CN: 模拟服务器发送错误
			taskManager.handleError(requestId, { message: errorMessage });

			// EN: Promise should reject // CN: Promise 应该 reject
			await throws(
				async () => await dispatchPromise,
				new RegExp(errorMessage),
			);
		});

		test("times out after specified duration", async function () {
			const client = createMockClient();
			const tool = "testTool";
			const args = { arg1: "value1" };
			const customTimeout = 5000;

			// EN: Start dispatch with custom timeout // CN: 使用自定义超时开始 dispatch
			const dispatchPromise = taskManager.dispatch(
				client,
				tool,
				args,
				customTimeout,
			);

			// EN: Advance clock past the timeout // CN: 时钟推进超过超时时间
			clock.tick(customTimeout + 1);

			// EN: Promise should reject with timeout error // CN: Promise 应该 reject 并显示超时错误
			await throws(
				async () => await dispatchPromise,
				new RegExp(`Task timeout after ${customTimeout}ms`),
			);
		});

		test("uses default timeout when not specified", async function () {
			const client = createMockClient();
			const tool = "testTool";
			const args = { arg1: "value1" };

			// EN: Start dispatch without specifying timeout // CN: 不指定超时开始 dispatch
			const dispatchPromise = taskManager.dispatch(client, tool, args);

			// EN: Advance clock past default timeout // CN: 时钟推进超过默认超时
			clock.tick(DEFAULT_TIMEOUT + 1);

			// EN: Promise should reject with default timeout error // CN: Promise 应该 reject 并显示默认超时错误
			await throws(
				async () => await dispatchPromise,
				new RegExp(`Task timeout after ${DEFAULT_TIMEOUT}ms`),
			);
		});
	});

	suite("handleResult()", function () {
		test("resolves pending promise with data", async function () {
			const client = createMockClient();
			const requestData = { result: "success" };

			// EN: Start dispatch // CN: 开始 dispatch
			const dispatchPromise = taskManager.dispatch(client, "tool", {});

			// EN: Get requestId // CN: 获取 requestId
			const sendStub = getSendStub(client);
			const sendCall = sendStub.getCall(0);
			const { requestId } = JSON.parse(sendCall.firstArg);

			// EN: Handle result before timeout // CN: 在超时前处理结果
			taskManager.handleResult(requestId, requestData);

			// EN: Should resolve with data // CN: 应该用数据 resolve
			const result = await dispatchPromise;
			deepStrictEqual(result, requestData);
		});

		test("does nothing for unknown requestId", function () {
			// EN: Should not throw // CN: 不应该抛出异常
			taskManager.handleResult("unknown-id", { data: "test" });
		});

		test("clears timeout on result", async function () {
			const client = createMockClient();
			const requestData = { result: "success" };

			// EN: Spy on clearTimeout to verify it's called // CN: 监视 clearTimeout 以验证它被调用
			const clearTimeoutSpy = sinon.spy(clock, "clearTimeout");

			// EN: Start dispatch with short timeout // CN: 使用短超时开始 dispatch
			const dispatchPromise = taskManager.dispatch(
				client,
				"tool",
				{},
				10000,
			);

			// EN: Get requestId // CN: 获取 requestId
			const sendStub = getSendStub(client);
			const sendCall = sendStub.getCall(0);
			const { requestId } = JSON.parse(sendCall.firstArg);

			// EN: Handle result // CN: 处理结果
			taskManager.handleResult(requestId, requestData);

			// EN: clearTimeout should have been called // CN: clearTimeout 应该被调用
			strictEqual(clearTimeoutSpy.called, true);

			// EN: Advance clock - should not trigger timeout (task already resolved) // CN: 时钟推进 - 不应该触发超时（任务已解决）
			clock.tick(20000);
			await dispatchPromise;
		});
	});

	suite("handleError()", function () {
		test("rejects pending promise with error", async function () {
			const client = createMockClient();
			const errorMsg = "Something went wrong";

			// EN: Start dispatch // CN: 开始 dispatch
			const dispatchPromise = taskManager.dispatch(client, "tool", {});

			// EN: Get requestId // CN: 获取 requestId
			const sendStub = getSendStub(client);
			const sendCall = sendStub.getCall(0);
			const { requestId } = JSON.parse(sendCall.firstArg);

			// EN: Handle error // CN: 处理错误
			taskManager.handleError(requestId, { message: errorMsg });

			// EN: Should reject with error // CN: 应该 reject 并显示错误
			await throws(
				async () => await dispatchPromise,
				new RegExp(errorMsg),
			);
		});

		test("does nothing for unknown requestId", function () {
			// EN: Should not throw // CN: 不应该抛出异常
			taskManager.handleError("unknown-id", { message: "error" });
		});

		test("clears timeout on error", async function () {
			const client = createMockClient();

			// EN: Spy on clearTimeout // CN: 监视 clearTimeout
			const clearTimeoutSpy = sinon.spy(clock, "clearTimeout");

			// EN: Start dispatch with short timeout // CN: 使用短超时开始 dispatch
			const dispatchPromise = taskManager.dispatch(
				client,
				"tool",
				{},
				10000,
			);

			// EN: Get requestId // CN: 获取 requestId
			const sendStub = getSendStub(client);
			const sendCall = sendStub.getCall(0);
			const { requestId } = JSON.parse(sendCall.firstArg);

			// EN: Handle error // CN: 处理错误
			taskManager.handleError(requestId, { message: "error" });

			// EN: clearTimeout should have been called // CN: clearTimeout 应该被调用
			strictEqual(clearTimeoutSpy.called, true);

			// EN: Advance clock - should not trigger timeout // CN: 时钟推进 - 不应该触发超时
			clock.tick(20000);
			await throws(async () => await dispatchPromise, /error/);
		});

		test("uses default error message when none provided", async function () {
			const client = createMockClient();

			// EN: Start dispatch // CN: 开始 dispatch
			const dispatchPromise = taskManager.dispatch(client, "tool", {});

			// EN: Get requestId // CN: 获取 requestId
			const sendStub = getSendStub(client);
			const sendCall = sendStub.getCall(0);
			const { requestId } = JSON.parse(sendCall.firstArg);

			// EN: Handle error with empty message // CN: 处理空消息的错误
			taskManager.handleError(requestId, { message: "" });

			// EN: Should reject with default message // CN: 应该 reject 并显示默认消息
			await throws(
				async () => await dispatchPromise,
				/Task failed/,
			);
		});
	});

	suite("cleanup()", function () {
		test("cancels all pending tasks", async function () {
			const client = createMockClient();

			// EN: Spy on clearTimeout // CN: 监视 clearTimeout
			const clearTimeoutSpy = sinon.spy(clock, "clearTimeout");

			// EN: Start multiple dispatches // CN: 开始多个 dispatch
			const dispatchPromise1 = taskManager.dispatch(client, "tool1", {});
			const dispatchPromise2 = taskManager.dispatch(client, "tool2", {});

			// EN: Get requestIds // CN: 获取 requestIds
			const sendStub = getSendStub(client);
			const sendCall1 = sendStub.getCall(0);
			const sendCall2 = sendStub.getCall(1);

			// EN: Cleanup // CN: 清理
			taskManager.cleanup();

			// EN: clearTimeout should have been called for each task // CN: clearTimeout 应该对每个任务调用
			strictEqual(clearTimeoutSpy.callCount, 2);

			// EN: Both promises should reject with shutdown error // CN: 两个 promise 都应该 reject 并显示服务器关闭错误
			await throws(
				async () => await dispatchPromise1,
				/Server shutting down/,
			);
			await throws(
				async () => await dispatchPromise2,
				/Server shutting down/,
			);
		});

		test("clears pending map after cleanup", function () {
			const client = createMockClient();

			// EN: Start dispatch // CN: 开始 dispatch
			taskManager.dispatch(client, "tool", {});

			// EN: Get requestId to verify task was added // CN: 获取 requestId 以验证任务已添加
			const sendStub = getSendStub(client);
			const sendCall = sendStub.getCall(0);
			const { requestId } = JSON.parse(sendCall.firstArg);

			// EN: Cleanup // CN: 清理
			taskManager.cleanup();

			// EN: handleResult for the pending task should do nothing (task was already cleaned up) // CN: 待处理任务的 handleResult 应该什么都不做（任务已被清理）
			taskManager.handleResult(requestId, { data: "test" });

			// EN: Should not throw // CN: 不应该抛出异常
		});
	});
});
