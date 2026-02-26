import * as vscode from 'vscode';
import Config from '../Config';

/**
 * 上下文助手 - 获取指定文件指定行数的上下文
 */
export class ContextHelper {
  /**
   * 通过文件路径获取上下文
   * @param filePath 文件路径
   * @param startLine 起始行号 (1-based)
   * @param endLine 结束行号 (1-based)
   * @returns 格式为 "${line}|${content}" 的字符串数组
   */
  static async getContextByPath(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<string[]> {
    const uri = vscode.Uri.file(filePath);
    return this.getContextByUri(uri, startLine, endLine);
  }

  /**
   * 通过文件 URI 获取上下文
   * @param uri 文件 URI
   * @param startLine 起始行号 (1-based)
   * @param endLine 结束行号 (1-based)
   * @returns 格式为 "${line}|${content}" 的字符串数组
   */
  static async getContextByUri(
    uri: vscode.Uri,
    startLine: number,
    endLine: number
  ): Promise<string[]> {
    const doc = await vscode.workspace.openTextDocument(uri);
    const result: string[] = [];
    
    const start = Math.max(1, startLine);
    const end = Math.min(doc.lineCount, endLine);
    
    for (let i = start; i <= end; i++) {
      const line = doc.lineAt(i - 1);
      result.push(`${i}|${line.text}`);
    }
    
    return result;
  }

  /**
   * 获取指定位置周围的上下文
   * @param uri 文件 URI
   * @param line 目标行号 (1-based)
   * @param contextLines 上下文行数（上下各取多少行）
   */
  static async getContextAroundLine(
    uri: vscode.Uri,
    line: number,
    contextLines?: number
  ): Promise<string[]> {
    const lines = contextLines ?? Config.getContextLines();
    const startLine = Math.max(1, line - lines);
    const endLine = line + lines;
    return this.getContextByUri(uri, startLine, endLine);
  }

  /**
   * 格式化上下文为字符串
   */
  static formatContext(contextLines: string[]): string {
    return contextLines.join('\n');
  }
}
