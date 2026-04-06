import * as assert from "node:assert";
import * as path from "node:path";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import Config from "../client/Config";
import { GetDiagnosticsTool } from "../client/tools/GetDiagnosticsTool";
import { GetScopeParentTool } from "../client/tools/GetScopeParentTool";
import { flattenIncomingCalls } from "../client/tools/IncomingCallsTool";
import {
	buildSearchFilesGlob,
	buildSearchFilesRegex,
	SearchFilesTool,
} from "../client/tools/SearchFilesTool";
import {
	filterWorkspaceSymbols,
	retryWorkspaceQuery,
} from "../client/tools/SearchSymbolInWorkspaceTool";
import { LocationHelper } from "../client/utils/LocationHelper";
import {
	ensureWorkspaceSymbolProviderReady,
	retryUntilReady,
} from "../client/utils/SymbolProviderWarmup";
import { ClientRegistry } from "../server/ClientRegistry";
import { toServerToolName } from "./McpTestClient";

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

	test("flattenIncomingCalls expands each fromRange into a concrete call site", async () => {
		const uri = vscode.Uri.file(
			path.resolve("src/client/tools/IncomingCallsTool.ts"),
		);
		const incomingCall = {
			from: {
				uri,
				name: "callerFunction",
				range: new vscode.Range(10, 1, 14, 1),
				selectionRange: new vscode.Range(10, 7, 10, 21),
			},
			fromRanges: [
				new vscode.Range(11, 4, 11, 18),
				new vscode.Range(13, 6, 13, 20),
			],
		} as unknown as vscode.CallHierarchyIncomingCall;

		const result = await flattenIncomingCalls(
			[incomingCall],
			async (_targetUri, line) => [`${line}|call-site`],
		);

		assert.deepStrictEqual(
			result.map((call) => ({
				uri: call.uri,
				line: call.line,
				character: call.character,
				name: call.name,
				context: call.context,
			})),
			[
				{
					uri: uri.fsPath,
					line: 12,
					character: 4,
					name: "callerFunction",
					context: ["12|call-site"],
				},
				{
					uri: uri.fsPath,
					line: 14,
					character: 6,
					name: "callerFunction",
					context: ["14|call-site"],
				},
			],
		);
	});

	test("buildSearchFilesGlob respects recursive flag", () => {
		assert.strictEqual(buildSearchFilesGlob(), "**/*");
		assert.strictEqual(buildSearchFilesGlob(false), "*");
	});

	test("buildSearchFilesRegex reports invalid patterns without leaking raw syntax errors", () => {
		assert.ok(buildSearchFilesRegex(".*\\.ts$").test("extension.ts"));
		assert.throws(
			() => buildSearchFilesRegex("["),
			/Invalid file name regex: \[/,
		);
	});

	test("SearchFilesTool.format renders regex validation errors as user-facing text", () => {
		const tool = new SearchFilesTool();
		const formatted = tool.format(
			{
				files: [],
				hasMore: false,
				total: 0,
				error: "Invalid file name regex: [",
			},
			{},
		);

		assert.strictEqual(formatted, "*Invalid file name regex: [*");
	});

	test("McpTestClient prefixes plain tool names with IDE-", () => {
		assert.strictEqual(toServerToolName("getDiagnostics"), "IDE-getDiagnostics");
		assert.strictEqual(
			toServerToolName("IDE-getScopeParent"),
			"IDE-getScopeParent",
		);
	});

	test("GetDiagnosticsTool waits through empty change events and foreground-reveals the document when needed", async () => {
		const tool = new GetDiagnosticsTool();
		const projectPath = path.resolve("D:/Project/node/ide-lsp-for-mcp");
		const filePath = "src/test/fixtures/diag-error.ts";
		const targetUri = vscode.Uri.file(path.join(projectPath, filePath));
		const diagnostic = new vscode.Diagnostic(
			new vscode.Range(0, 13, 0, 16),
			"Type 'number' is not assignable to type 'string'.",
			vscode.DiagnosticSeverity.Error,
		);
		const originalOpenTextDocument = vscode.workspace.openTextDocument;
		const originalShowTextDocument = vscode.window.showTextDocument;
		const originalGetDiagnostics = vscode.languages.getDiagnostics;
		const originalOnDidChangeDiagnostics = vscode.languages.onDidChangeDiagnostics;
		const originalGetDiagnosticsTimeout = Config.getDiagnosticsTimeout;
		const onDidChangeDiagnosticsDescriptor = Object.getOwnPropertyDescriptor(
			vscode.languages,
			"onDidChangeDiagnostics",
		);
		const visibleEditorsDescriptor = Object.getOwnPropertyDescriptor(
			vscode.window,
			"visibleTextEditors",
		);
		const listeners = new Set<(e: vscode.DiagnosticChangeEvent) => void>();
		let diagnostics: vscode.Diagnostic[] = [];
		let revealOptions: vscode.TextDocumentShowOptions | undefined;

		try {
			vscode.workspace.openTextDocument = (async () =>
				({
					uri: targetUri,
					getText: () => "",
				}) as vscode.TextDocument) as unknown as typeof vscode.workspace.openTextDocument;
			vscode.window.showTextDocument = (async (_document, options) => {
				if (options && typeof options === "object") {
					revealOptions = options;
				}
				setTimeout(() => {
					for (const listener of listeners) {
						listener({ uris: [targetUri] });
					}
				}, 0);
				setTimeout(() => {
					diagnostics = [diagnostic];
					for (const listener of listeners) {
						listener({ uris: [targetUri] });
					}
				}, 10);
				return {
					document: {
						uri: targetUri,
					},
				} as vscode.TextEditor;
			}) as typeof vscode.window.showTextDocument;
			vscode.languages.getDiagnostics = (((uri: vscode.Uri) =>
				uri.toString() === targetUri.toString() ? diagnostics : []) as (
				typeof vscode.languages.getDiagnostics
			));
			Object.defineProperty(vscode.languages, "onDidChangeDiagnostics", {
				configurable: true,
				value: ((listener: (e: vscode.DiagnosticChangeEvent) => void) => {
					listeners.add(listener);
					return {
						dispose() {
							listeners.delete(listener);
						},
					};
				}) as typeof vscode.languages.onDidChangeDiagnostics,
			});
			(Config.getDiagnosticsTimeout as unknown as () => number) = () => 50;
			Object.defineProperty(vscode.window, "visibleTextEditors", {
				configurable: true,
				value: [],
			});

			const result = await tool.execute({
				projectPath,
				filePath,
				severity: "Error",
			});

			assert.strictEqual(revealOptions?.preserveFocus, false);
			assert.strictEqual(result.total, 1);
			assert.strictEqual(result.diagnostics[0].line, 1);
		} finally {
			vscode.workspace.openTextDocument = originalOpenTextDocument;
			vscode.window.showTextDocument = originalShowTextDocument;
			vscode.languages.getDiagnostics = originalGetDiagnostics;
			(Config.getDiagnosticsTimeout as unknown as () => number) =
				originalGetDiagnosticsTimeout.bind(Config);
			if (onDidChangeDiagnosticsDescriptor) {
				Object.defineProperty(
					vscode.languages,
					"onDidChangeDiagnostics",
					onDidChangeDiagnosticsDescriptor,
				);
			} else {
				Object.defineProperty(vscode.languages, "onDidChangeDiagnostics", {
					configurable: true,
					value: originalOnDidChangeDiagnostics,
				});
			}
			if (visibleEditorsDescriptor) {
				Object.defineProperty(
					vscode.window,
					"visibleTextEditors",
					visibleEditorsDescriptor,
				);
			}
		}
	});

	test("retryUntilReady retries until the provider becomes ready", async () => {
		let attempts = 0;
		const result = await retryUntilReady(
			async () => {
				attempts++;
				return attempts >= 3 ? ["ready"] : [];
			},
			(value) => value.length > 0,
			4,
			0,
		);

		assert.deepStrictEqual(result, ["ready"]);
		assert.strictEqual(attempts, 3);
	});

	test("retryWorkspaceQuery retries a cold query until symbols appear", async () => {
		let attempts = 0;
		const projectPath = path.resolve("D:/Project/node/ide-lsp-for-mcp");

		const result = await retryWorkspaceQuery(
			async () => {
				attempts++;
				return attempts >= 3
					? [
							{
								name: "BaseTool",
								kind: vscode.SymbolKind.Class,
								location: new vscode.Location(
									vscode.Uri.file(
										path.join(projectPath, "src/client/tools/BaseTool.ts"),
									),
									new vscode.Range(16, 0, 16, 1),
								),
								containerName: "",
							} as vscode.SymbolInformation,
						]
					: [];
			},
			2,
			0,
		);

		assert.strictEqual(attempts, 3);
		assert.deepStrictEqual(result.map((symbol) => symbol.name), ["BaseTool"]);
	});

	test("retryWorkspaceQuery stays bounded when the symbol does not exist", async () => {
		let attempts = 0;
		const result = await retryWorkspaceQuery(
			async () => {
				attempts++;
				return [];
			},
			2,
			0,
		);

		assert.strictEqual(attempts, 3);
		assert.deepStrictEqual(result, []);
	});

	test("ensureWorkspaceSymbolProviderReady returns quickly when the provider is already warm", async () => {
		const projectPath = path.resolve("D:/Project/node/ide-lsp-for-mcp");
		const originalExecuteCommand = vscode.commands.executeCommand;
		let commandCalls = 0;

		try {
			vscode.commands.executeCommand = (async (command: string, query: string) => {
				if (command === "vscode.executeWorkspaceSymbolProvider" && query === "") {
					commandCalls++;
					return [
						{
							name: "BaseTool",
							kind: vscode.SymbolKind.Class,
							location: new vscode.Location(
								vscode.Uri.file(path.join(projectPath, "src/client/tools/BaseTool.ts")),
								new vscode.Range(16, 0, 16, 1),
							),
							containerName: "",
						},
					];
				}

				return [];
			}) as typeof vscode.commands.executeCommand;

			const ready = await ensureWorkspaceSymbolProviderReady(projectPath);
			assert.strictEqual(ready, true);
			assert.strictEqual(commandCalls, 1);
		} finally {
			vscode.commands.executeCommand = originalExecuteCommand;
		}
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

	test("filterWorkspaceSymbols treats class filter as type declarations", () => {
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
				name: "DebugPanelContract",
				kind: vscode.SymbolKind.Interface,
				location: new vscode.Location(
					vscode.Uri.file(path.join(projectPath, "src/shared/types.ts")),
					new vscode.Range(0, 0, 0, 1),
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
		];

		const classMatches = filterWorkspaceSymbols(
			symbols,
			projectPath,
			"DebugPanel",
			"class",
		);

		assert.deepStrictEqual(
			classMatches.map((symbol) => symbol.name),
			["DebugPanelProvider", "DebugPanelContract"],
		);
	});
});
