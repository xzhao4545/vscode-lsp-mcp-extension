import { BaseTool } from '../tools/BaseTool';

/**
 * 工具注册表 - 管理所有工具的注册和查找
 */
export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  /**
   * 注册工具
   */
  register(tool: BaseTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  /**
   * 批量注册工具
   */
  registerAll(tools: BaseTool[]): this {
    for (const tool of tools) {
      this.register(tool);
    }
    return this;
  }

  /**
   * 获取工具
   */
  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 检查工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取所有工具名称
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取工具数量
   */
  get size(): number {
    return this.tools.size;
  }
}
