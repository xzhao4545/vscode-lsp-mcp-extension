/**
 * TaskExecutor - Executes VSCode LSP commands and tool operations
 * // CN: 任务执行器 - 执行 VSCode LSP 命令
 */

import type { TaskMessage } from "../shared/protocol";
import {
	FindReferencesTool,
	GetDefinitionTextTool,
	GetDiagnosticsTool,
	GetFileStructTool,
	GetScopeParentTool,
	GetSymbolStructTool,
	GoToDefinitionTool,
	GoToImplementationTool,
	HoverTool,
	IncomingCallsTool,
	RenameSymbolTool,
	SearchFilesTool,
	SearchSymbolInWorkspaceTool,
	SyncFilesTool,
	ToolRegistry,
} from "./tools";

export class TaskExecutor {
	private registry: ToolRegistry;

	constructor() {
		this.registry = new ToolRegistry();
		this.registerTools();
	}

	/**
	 * Register all tools - Register all available LSP and IDE tools
	 * // CN: 注册所有工具
	 */
	private registerTools(): void {
		this.registry.registerAll([
			new GoToDefinitionTool(),
			new FindReferencesTool(),
			new HoverTool(),
			new GetFileStructTool(),
			new GetSymbolStructTool(),
			new SearchSymbolInWorkspaceTool(),
			new GoToImplementationTool(),
			new IncomingCallsTool(),
			new RenameSymbolTool(),
			new GetDiagnosticsTool(),
			new GetDefinitionTextTool(),
			new SyncFilesTool(),
			new SearchFilesTool(),
			new GetScopeParentTool(),
		]);
	}

	/**
	 * Execute task - Execute a task message and return the result
	 * // CN: 执行任务
	 */
	async execute(task: TaskMessage): Promise<unknown> {
		const { tool, args } = task;
		const toolInstance = this.registry.get(tool);

		if (!toolInstance) {
			throw new Error(`Unknown tool: ${tool}`);
		}

		return toolInstance.execute(args);
	}

	/**
	 * Execute with format - Execute task and return formatted result string
	 * // CN: 执行任务并返回格式化结果
	 */
	async executeWithFormat(task: TaskMessage): Promise<string> {
		const { tool, args } = task;
		const toolInstance = this.registry.get(tool);

		if (!toolInstance) {
			throw new Error(`Unknown tool: ${tool}`);
		}

		return (await toolInstance.run(args)).formatted;
	}

	/**
	 * Get registered tools - Return list of all registered tool names
	 * // CN: 获取已注册的工具名称列表
	 */
	getRegisteredTools(): string[] {
		return this.registry.getNames();
	}
}
