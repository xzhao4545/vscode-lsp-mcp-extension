import * as vscode from 'vscode';
import * as path from 'path';

/**
 * 工具执行结果
 */
export interface ToolResult {
  /** 原始数据 */
  data: unknown;
  /** 格式化后的 Markdown */
  formatted: string;
}

/**
 * 工具基类 - 所有工具必须继承此类
 */
export abstract class BaseTool {
  /** 工具名称 */
  abstract readonly name: string;

  /**
   * 执行工具
   */
  abstract execute(args: Record<string, unknown>): Promise<unknown>;

  /**
   * 格式化结果为 Markdown
   */
  abstract format(result: unknown, args: Record<string, unknown>): string;

  /**
   * 执行并格式化
   */
  async run(args: Record<string, unknown>): Promise<ToolResult> {
    const data = await this.execute(args);
    const formatted = this.format(data, args);
    return { data, formatted };
  }

  /**
   * 解析文件 URI
   */
  protected resolveUri(projectPath: string, filePath: string): vscode.Uri {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(projectPath, filePath);
    return vscode.Uri.file(fullPath);
  }

  /**
   * 无内容时的默认提示
   */
  protected emptyContent(message: string = 'No content available'): string {
    return `*${message}*`;
  }
}
