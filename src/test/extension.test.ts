import * as assert from "node:assert";
import * as path from "node:path";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { ClientRegistry } from "../server/ClientRegistry";

// import * as myExtension from '../../extension';

suite("Extension Test Suite", () => {
	vscode.window.showInformationMessage("Start all tests.");

	test("ClientRegistry.containsPath matches parent path and nested workspace", () => {
		const parentPath = path.resolve("D:/Project/node");
		const workspaceRoot = path.join(parentPath, "ide-lsp-for-mcp");

		assert.strictEqual(ClientRegistry.containsPath(parentPath, parentPath), true);
		assert.strictEqual(ClientRegistry.containsPath(parentPath, workspaceRoot), true);
	});

	test("ClientRegistry.containsPath rejects child-to-parent lookup", () => {
		const parentPath = path.resolve("D:/Project/node");
		const workspaceRoot = path.join(parentPath, "ide-lsp-for-mcp");

		assert.strictEqual(
			ClientRegistry.containsPath(workspaceRoot, parentPath),
			false,
		);
	});
});
