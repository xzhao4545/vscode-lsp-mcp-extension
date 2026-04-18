import * as path from "node:path";
import * as vscode from "vscode";

/**
 * ToolResult - Tool execution result
 * // CN: 工具执行结果
 */
export interface ToolResult {
	/** data - Raw data // CN: 原始数据 */
	data: unknown;
	/** formatted - Formatted Markdown // CN: 格式化后的 Markdown */
	formatted: string;
}

/**
 * BaseTool - Abstract base class for all tools
 * // CN: 工具基类 - 所有工具必须继承此类
 */
export abstract class BaseTool {
	/** name - Tool name // CN: 工具名称 */
	abstract readonly name: string;

	/**
	 * execute - Execute the tool
	 * // CN: 执行工具
	 */
	abstract execute(args: Record<string, unknown>, token?: vscode.CancellationToken): Promise<unknown>;

	/**
	 * format - Format result as Markdown
	 * // CN: 格式化结果为 Markdown
	 */
	// TODO: [data] Abstract format() declares args parameter but 4 tools (Hover, GetFileStruct, GetSymbolStruct, GetScopeParent) omit it - signature inconsistency // CN: 抽象 format() 声明了 args 参数，但 4 个工具忽略了它
	abstract format(result: unknown, args: Record<string, unknown>): string;

	/**
	 * run - Execute and format
	 * // CN: 执行并格式化
	 */
	async run(args: Record<string, unknown>, token?: vscode.CancellationToken): Promise<ToolResult> {
		const data = await this.execute(args);
		const formatted = this.format(data, args);
		return { data, formatted };
	}

	/**
	 * resolveUri - Resolve file URI
	 * // CN: 解析文件 URI
	 */
	protected resolveUri(projectPath: string, filePath: string): vscode.Uri {
		const fullPath = path.isAbsolute(filePath)
			? filePath
			: path.join(projectPath, filePath);
		return vscode.Uri.file(fullPath);
	}

	/**
	 * emptyContent - Default message when no content available
	 * // CN: 无内容时的默认提示
	 */
	protected emptyContent(message: string = "No content available"): string {
		return `*${message}*`;
	}
}
