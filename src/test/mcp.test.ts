/**
 * MCP 工具测试
 *
 * 通过 HTTP 客户端请求 MCP 服务器测试工具返回结果。
 * 测试数据从 JSON 文件读取，预期结果保存为 MD 文件。
 *
 * 参考 IntelliJ 版本的 McpToolsTest.kt 实现。
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { McpTestClient, type TestCase } from "./McpTestClient";

// 配置
const TEST_DATA_DIR = path.join(
	__dirname,
	"..",
	"..",
	"src",
	"test",
	"testData",
	"mcp",
);
const EXPECTED_DIR = path.join(TEST_DATA_DIR, "expected");
const PROJECT_PATH_PLACEHOLDER = "${" + "projectPath}";

// 测试项目路径 - 需要根据实际情况修改
const PROJECT_PATH =
	process.env.TEST_PROJECT_PATH || "D:\\Project\\PythonTest\\paper_translation";

suite("MCP Tools Test Suite", function () {
	this.timeout(60000); // 60秒超时

	let client: McpTestClient;

	suiteSetup(async () => {
		client = new McpTestClient();

		// 建立 SSE 连接
		await client.connect();

		// 确保目录存在
		if (!fs.existsSync(EXPECTED_DIR)) {
			fs.mkdirSync(EXPECTED_DIR, { recursive: true });
		}
	});

	suiteTeardown(async () => {
		await client?.disconnect();
	});

	// ==================== 测试入口 ====================

	test("listOpenProjects", () => runToolTest(client, "listOpenProjects"));
	test("goToDefinition", () => runToolTest(client, "goToDefinition"));
	test("findReferences", () => runToolTest(client, "findReferences"));
	test("hover", () => runToolTest(client, "hover"));
	test("getFileStruct", () => runToolTest(client, "getFileStruct"));
	test("searchSymbolInWorkspace", () =>
		runToolTest(client, "searchSymbolInWorkspace"));
	test("goToImplementation", () => runToolTest(client, "goToImplementation"));
	test("incomingCalls", () => runToolTest(client, "incomingCalls"));
	test("renameSymbol", () => runToolTest(client, "renameSymbol"));
	test("getDiagnostics", () => runToolTest(client, "getDiagnostics"));
	test("getDefinitionText", () => runToolTest(client, "getDefinitionText"));
	test("syncFiles", () => runToolTest(client, "syncFiles"));
	test("searchFiles", () => runToolTest(client, "searchFiles"));
	test("getScopeParent", () => runToolTest(client, "getScopeParent"));
});

/**
 * 运行工具测试
 */
async function runToolTest(
	client: McpTestClient,
	toolName: string,
): Promise<void> {
	const testFile = path.join(TEST_DATA_DIR, `${toolName}.json`);

	if (!fs.existsSync(testFile)) {
		console.log(`Test data file not found: ${testFile}, skipping...`);
		return;
	}

	console.log(`\n========== Testing tool: ${toolName} ==========`);
	const testCases: TestCase[] = JSON.parse(fs.readFileSync(testFile, "utf-8"));
	const results: Array<{ expectedFile: string; result: string }> = [];

	for (const testCase of testCases) {
		console.log(`\n--- Test case: ${testCase.name} ---`);
		const args = replaceProjectPath(testCase.args);
		const result = await client.callTool(toolName, args);

		assert.ok(result, "Result should not be null");
		if (result.isError) {
			console.log(`Error result: ${result.content}`);
		}

		results.push({
			expectedFile: testCase.expectedFile || `${testCase.name}.md`,
			result: result.content,
		});
	}

	await verifyResults(toolName, results);
}

/**
 * 替换测试参数中的占位符
 */
function replaceProjectPath(
	args: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(args)) {
		if (value === PROJECT_PATH_PLACEHOLDER) {
			result[key] = PROJECT_PATH;
		} else {
			result[key] = value;
		}
	}
	return result;
}

/**
 * 验证测试结果
 */
async function verifyResults(
	toolName: string,
	results: Array<{ expectedFile: string; result: string }>,
): Promise<void> {
	const toolExpectedDir = path.join(EXPECTED_DIR, toolName);
	if (!fs.existsSync(toolExpectedDir)) {
		fs.mkdirSync(toolExpectedDir, { recursive: true });
	}

	let allSuccess = true;
	const testResults: string[] = [];

	for (const { expectedFile, result } of results) {
		const expectedPath = path.join(toolExpectedDir, expectedFile);

		if (fs.existsSync(expectedPath)) {
			const expected = fs.readFileSync(expectedPath, "utf-8");
			console.log(`Expected length: ${expected.length}`);
			console.log(`Actual length: ${result.length}`);
			console.log(`Result preview: ${result.substring(0, 200)}...`);

			if (result === expected) {
				testResults.push(`${expectedFile}: success`);
			} else {
				testResults.push(`${expectedFile}: failure`);
				allSuccess = false;
			}
		} else {
			// 首次运行，创建预期文件
			fs.writeFileSync(expectedPath, result, "utf-8");
			console.log(`Created expected file: ${expectedPath}`);
			testResults.push(`${expectedFile}: created`);
		}
	}

	console.log(testResults.join(", "));
	assert.ok(allSuccess, "Some test cases failed");
}
