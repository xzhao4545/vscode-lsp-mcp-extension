import * as assert from "node:assert";
import * as path from "node:path";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { GetScopeParentTool } from "../client/tools/GetScopeParentTool";
import {
	filterWorkspaceSymbols,
} from "../client/tools/SearchSymbolInWorkspaceTool";
import { LocationHelper } from "../client/utils/LocationHelper";
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

	test("LocationHelper.normalize prefers targetSelectionRange for definition links", () => {
		const uri = vscode.Uri.file(path.resolve("src/client/tools/BaseTool.ts"));
		const locations = LocationHelper.normalize([
			{
				targetUri: uri,
				targetRange: new vscode.Range(0, 0, 10, 0),
				targetSelectionRange: new vscode.Range(4, 7, 4, 15),
				originSelectionRange: new vscode.Range(0, 0, 0, 1),
			},
		]);

		assert.strictEqual(locations.length, 1);
		assert.strictEqual(locations[0].range.start.line, 4);
		assert.strictEqual(locations[0].range.start.character, 7);
	});

	test("GetScopeParentTool.findParent returns the innermost symbol for a line", () => {
		const classSymbol = new vscode.DocumentSymbol(
			"DebugPanelProvider",
			"",
			vscode.SymbolKind.Class,
			new vscode.Range(48, 0, 75, 1),
			new vscode.Range(48, 13, 48, 31),
		);
		const methodSymbol = new vscode.DocumentSymbol(
			"getChildren",
			"",
			vscode.SymbolKind.Method,
			new vscode.Range(68, 1, 70, 2),
			new vscode.Range(68, 1, 68, 12),
		);
		classSymbol.children.push(methodSymbol);

		const parent = GetScopeParentTool.findParent([classSymbol], 69);

		assert.ok(parent);
		assert.strictEqual(parent?.name, "getChildren");
	});

	test("filterWorkspaceSymbols applies query, type and project path filters", () => {
		const projectPath = path.resolve("D:/Project/node/ide-lsp-for-mcp");
		const symbols: vscode.SymbolInformation[] = [
			{
				name: "DebugPanelProvider",
				kind: vscode.SymbolKind.Class,
				location: new vscode.Location(
					vscode.Uri.file(
						path.join(projectPath, "src/client/debug/DebugPanelProvider.ts"),
					),
					new vscode.Range(48, 0, 48, 1),
				),
				containerName: "",
			} as vscode.SymbolInformation,
			{
				name: "debugPanelProvider",
				kind: vscode.SymbolKind.Variable,
				location: new vscode.Location(
					vscode.Uri.file(path.join(projectPath, "src/extension.ts")),
					new vscode.Range(23, 0, 23, 1),
				),
				containerName: "",
			} as vscode.SymbolInformation,
			{
				name: "## MCP Tools",
				kind: vscode.SymbolKind.String,
				location: new vscode.Location(
					vscode.Uri.file(path.join(projectPath, "README.md")),
					new vscode.Range(17, 0, 17, 1),
				),
				containerName: "",
			} as vscode.SymbolInformation,
			{
				name: "DebugPanelProvider",
				kind: vscode.SymbolKind.Class,
				location: new vscode.Location(
					vscode.Uri.file("D:/OtherProject/src/DebugPanelProvider.ts"),
					new vscode.Range(0, 0, 0, 1),
				),
				containerName: "",
			} as vscode.SymbolInformation,
		];

		const classMatches = filterWorkspaceSymbols(
			symbols,
			projectPath,
			"DebugPanelProvider",
			"class",
		);
		const fieldMatches = filterWorkspaceSymbols(
			symbols,
			projectPath,
			"debugPanelProvider",
			"field",
		);

		assert.deepStrictEqual(
			classMatches.map((symbol) => symbol.name),
			["DebugPanelProvider"],
		);
		assert.deepStrictEqual(
			fieldMatches.map((symbol) => symbol.name),
			["debugPanelProvider"],
		);
	});
});
