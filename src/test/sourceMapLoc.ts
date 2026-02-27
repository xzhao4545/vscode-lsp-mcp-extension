import * as fs from "fs";
import * as sourceMap from "source-map";
import * as readline from "node:readline/promises";

async function findOriginalPosition() {
  // 读取 .map 文件
  const rawSourceMap = JSON.parse(fs.readFileSync("dist/extension.js.map", "utf8"));

  // 创建 SourceMapConsumer
  const consumer = await new sourceMap.SourceMapConsumer(rawSourceMap);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  while (true) {
    const line = await rl.question("input line:");
    const column = await rl.question("input column:");

    // 输入编译后的位置（例如 line: 1, column: 27698）
    const originalPosition = consumer.originalPositionFor({
      line: parseInt(line),
      column: parseInt(column),
    });

    console.log("源码位置：", originalPosition);
  }
  // 输出：{ source: 'src/components/App.js', line: 42, column: 10, name: 'xxx' }

  consumer.destroy();
}

findOriginalPosition();
