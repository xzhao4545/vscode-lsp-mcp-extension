/**
 * Source map location utility
 *
 * Reads compiled JavaScript source maps to find original source positions
 * // CN: 源代码映射位置工具
 * // CN: 读取编译后的 JavaScript 源码映射以查找原始源码位置
 */

import * as fs from "node:fs";
import * as readline from "node:readline/promises";
import * as sourceMap from "source-map";

async function findOriginalPosition() {
	// EN: Read .map file // CN: 读取 .map 文件
	const rawSourceMap = JSON.parse(
		fs.readFileSync("dist/extension.js_map", "utf8"),
	);

	// EN: Create SourceMapConsumer // CN: 创建 SourceMapConsumer
	const consumer = await new sourceMap.SourceMapConsumer(rawSourceMap);
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	while (true) {
		const line = await rl.question("input line:");
		const column = await rl.question("input column:");

		// EN: Input compiled position (e.g., line: 1, column: 27698) // CN: 输入编译后的位置（例如 line: 1, column: 27698）
		const originalPosition = consumer.originalPositionFor({
			line: parseInt(line, 10),
			column: parseInt(column, 10),
		});

		console.log("Source position:", originalPosition); // EN: 源码位置
	}
	// EN: Output: { source: 'src/components/App.js', line: 42, column: 10, name: 'xxx' } // CN: 输出：{ source: 'src/components/App.js', line: 42, column: 10, name: 'xxx' }

	consumer.destroy();
}

findOriginalPosition();
