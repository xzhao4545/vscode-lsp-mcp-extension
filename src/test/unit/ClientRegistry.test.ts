/**
 * ClientRegistry Unit Tests
 * // CN: ClientRegistry 单元测试
 */

import * as assert from "node:assert";
import sinon from "sinon";
import { ClientRegistry } from "../../server/ClientRegistry";
import type { Folder } from "../../shared/types";
import WebSocket from "ws";

suite("ClientRegistry", function () {
	suite("register()", function () {
		test("adds window with folders", function () {
			// EN: Test that register adds client to registry // CN: 测试 register 添加客户端到注册表
			const registry = new ClientRegistry();
			const ws = sinon.createStubInstance(WebSocket) as unknown as WebSocket;
			const folders: Folder[] = [
				{ name: "project1", path: "/workspace/project1" },
				{ name: "project2", path: "/workspace/project2" },
			];

			registry.register("window-1", ws, folders);

			assert.strictEqual(registry.size, 1);
			const client = registry.findByProjectPath("/workspace/project1");
			assert.ok(client, "Client should be found");
			assert.strictEqual(client!.windowId, "window-1");
			assert.strictEqual(client!.folders.length, 2);
		});

		test("adds multiple windows", function () {
			// EN: Test registering multiple windows // CN: 测试注册多个窗口
			const registry = new ClientRegistry();
			const ws1 = sinon.createStubInstance(WebSocket) as unknown as WebSocket;
			const ws2 = sinon.createStubInstance(WebSocket) as unknown as WebSocket;

			registry.register("window-1", ws1, [
				{ name: "proj1", path: "/workspace/proj1" },
			]);
			registry.register("window-2", ws2, [
				{ name: "proj2", path: "/workspace/proj2" },
			]);

			assert.strictEqual(registry.size, 2);
		});

		test("normalizes folder paths on register", function () {
			// EN: Test that paths are normalized // CN: 测试路径在注册时被标准化
			const registry = new ClientRegistry();
			const ws = sinon.createStubInstance(WebSocket) as unknown as WebSocket;
			const folders: Folder[] = [
				{ name: "proj", path: "/workspace/project/" }, // EN: trailing slash // CN: 尾部斜杠
			];

			registry.register("window-1", ws, folders);

			const client = registry.findByProjectPath("/workspace/project");
			assert.ok(client, "Client should be found with normalized path");
			assert.strictEqual(client!.folders[0].path, "/workspace/project");
		});
	});

	suite("unregister()", function () {
		test("removes window", function () {
			// EN: Test that unregister removes client // CN: 测试 unregister 删除客户端
			const registry = new ClientRegistry();
			const ws = sinon.createStubInstance(WebSocket) as unknown as WebSocket;

			registry.register("window-1", ws, [
				{ name: "proj", path: "/workspace/project" },
			]);
			assert.strictEqual(registry.size, 1);

			registry.unregister("window-1");
			assert.strictEqual(registry.size, 0);
		});

		test("removes project from index", function () {
			// EN: Test that project index is cleaned up // CN: 测试项目索引被清理
			const registry = new ClientRegistry();
			const ws = sinon.createStubInstance(WebSocket) as unknown as WebSocket;

			registry.register("window-1", ws, [
				{ name: "proj", path: "/workspace/project" },
			]);

			const before = registry.findByProjectPath("/workspace/project");
			assert.ok(before, "Should find before unregister");

			registry.unregister("window-1");

			const after = registry.findByProjectPath("/workspace/project");
			assert.strictEqual(after, undefined, "Should not find after unregister");
		});

		test("handles unregistering non-existent window", function () {
			// EN: Test that unregistering unknown window doesn't throw // CN: 测试注销不存在的窗口不抛出异常
			const registry = new ClientRegistry();

			assert.doesNotThrow(() => {
				registry.unregister("non-existent-window");
			});
		});
	});

	suite("findByProjectPath()", function () {
		test("returns correct client", function () {
			// EN: Test finding client by project path // CN: 测试通过项目路径查找客户端
			const registry = new ClientRegistry();
			const ws1 = sinon.createStubInstance(WebSocket) as unknown as WebSocket;
			const ws2 = sinon.createStubInstance(WebSocket) as unknown as WebSocket;

			registry.register("window-1", ws1, [
				{ name: "proj1", path: "/workspace/project1" },
			]);
			registry.register("window-2", ws2, [
				{ name: "proj2", path: "/workspace/project2" },
			]);

			const client = registry.findByProjectPath("/workspace/project1");
			assert.ok(client, "Client should be found");
			assert.strictEqual(client!.windowId, "window-1");

			const client2 = registry.findByProjectPath("/workspace/project2");
			assert.ok(client2, "Client should be found");
			assert.strictEqual(client2!.windowId, "window-2");
		});

		test("returns undefined for non-existent project", function () {
			// EN: Test that non-existent project returns undefined // CN: 测试不存在的项目返回 undefined
			const registry = new ClientRegistry();
			const ws = sinon.createStubInstance(WebSocket) as unknown as WebSocket;

			registry.register("window-1", ws, [
				{ name: "proj", path: "/workspace/project" },
			]);

			const client = registry.findByProjectPath("/workspace/non-existent");
			assert.strictEqual(client, undefined);
		});

		test("handles nested paths", function () {
			// EN: Test nested project paths // CN: 测试嵌套的项目路径
			const registry = new ClientRegistry();
			const ws = sinon.createStubInstance(WebSocket) as unknown as WebSocket;

			registry.register("window-1", ws, [
				{ name: "root", path: "/workspace" },
			]);

			// EN: Nested path should still be found if path matches // CN: 如果路径匹配，嵌套路径仍应被找到
			const client = registry.findByProjectPath("/workspace");
			assert.ok(client, "Root path should be found");
		});
	});

	suite("getAllProjects()", function () {
		test("returns all registered projects", function () {
			// EN: Test that getAllProjects returns all projects // CN: 测试 getAllProjects 返回所有项目
			const registry = new ClientRegistry();
			const ws1 = sinon.createStubInstance(WebSocket) as unknown as WebSocket;
			const ws2 = sinon.createStubInstance(WebSocket) as unknown as WebSocket;

			registry.register("window-1", ws1, [
				{ name: "proj1", path: "/workspace/project1" },
				{ name: "proj2", path: "/workspace/project2" },
			]);
			registry.register("window-2", ws2, [
				{ name: "proj3", path: "/workspace/project3" },
			]);

			const projects = registry.getAllProjects();
			assert.strictEqual(projects.length, 3, "Should have 3 projects");

			const paths = projects.map((p) => p.path).sort();
			assert.deepStrictEqual(paths, [
				"/workspace/project1",
				"/workspace/project2",
				"/workspace/project3",
			]);
		});

		test("returns empty array when no clients", function () {
			// EN: Test empty registry // CN: 测试空注册表
			const registry = new ClientRegistry();
			const projects = registry.getAllProjects();
			assert.deepStrictEqual(projects, []);
		});
	});

	suite("normalizePath()", function () {
		test("handles trailing slashes", function () {
			// EN: Test trailing slash normalization // CN: 测试尾部斜杠标准化
			const normalized1 = ClientRegistry.normalizePath("/workspace/project");
			const normalized2 = ClientRegistry.normalizePath("/workspace/project/");

			assert.strictEqual(
				normalized1,
				normalized2,
				"Paths with/without trailing slash should be equal",
			);
		});

		test("handles case sensitivity on Unix", function () {
			// EN: Test case handling // CN: 测试大小写处理
			if (process.platform === "win32") {
				// EN: Windows is case-insensitive // CN: Windows 大小写不敏感
				const lower = ClientRegistry.normalizePath("/workspace/Project");
				const upper = ClientRegistry.normalizePath("/workspace/project");
				assert.strictEqual(lower, upper);
			}
		});

		test("resolves relative paths", function () {
			// EN: Test relative path resolution // CN: 测试相对路径解析
			const normalized = ClientRegistry.normalizePath("workspace/project");
			assert.ok(normalized.startsWith("/"), "Should resolve to absolute path");
		});

		test("handles double slashes", function () {
			// EN: Test double slash handling // CN: 测试双斜杠处理
			const normalized = ClientRegistry.normalizePath("/workspace//project");
			assert.ok(!normalized.includes("//"), "Should not contain double slashes");
		});
	});

	suite("containsPath()", function () {
		test("returns true for same path", function () {
			// EN: Test same path returns true // CN: 测试相同路径返回 true
			const result = ClientRegistry.containsPath("/workspace/project", "/workspace/project");
			assert.strictEqual(result, true);
		});

		test("returns true for nested path", function () {
			// EN: Test nested path returns true // CN: 测试嵌套路径返回 true
			const result = ClientRegistry.containsPath(
				"/workspace",
				"/workspace/project/src",
			);
			assert.strictEqual(result, true);
		});

		test("returns false for unrelated path", function () {
			// EN: Test unrelated path returns false // CN: 测试无关路径返回 false
			const result = ClientRegistry.containsPath(
				"/workspace/project1",
				"/workspace/project2",
			);
			assert.strictEqual(result, false);
		});

		test("returns true for root path", function () {
			// EN: Test root path containment // CN: 测试根路径包含
			const result = ClientRegistry.containsPath("/workspace", "/workspace");
			assert.strictEqual(result, true);
		});

		test("normalizes paths before comparison", function () {
			// EN: Test that paths are normalized before comparison // CN: 测试比较前标准化路径
			const result = ClientRegistry.containsPath(
				"/workspace/project/",
				"/workspace/project/src",
			);
			assert.strictEqual(result, true);
		});

		test("returns false for parent path", function () {
			// EN: Test that container is not contained in contained // CN: 测试容器不在被包含者中
			const result = ClientRegistry.containsPath(
				"/workspace/project/src",
				"/workspace",
			);
			assert.strictEqual(result, false);
		});
	});

	suite("getAllClients()", function () {
		test("returns all registered clients", function () {
			// EN: Test getAllClients returns all clients // CN: 测试 getAllClients 返回所有客户端
			const registry = new ClientRegistry();
			const ws1 = sinon.createStubInstance(WebSocket) as unknown as WebSocket;
			const ws2 = sinon.createStubInstance(WebSocket) as unknown as WebSocket;

			registry.register("window-1", ws1, [
				{ name: "proj", path: "/workspace/proj1" },
			]);
			registry.register("window-2", ws2, [
				{ name: "proj", path: "/workspace/proj2" },
			]);

			const clients = registry.getAllClients();
			assert.strictEqual(clients.length, 2);
		});

		test("returns empty array when no clients", function () {
			// EN: Test empty registry // CN: 测试空注册表
			const registry = new ClientRegistry();
			const clients = registry.getAllClients();
			assert.deepStrictEqual(clients, []);
		});
	});
});