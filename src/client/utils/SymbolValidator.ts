import * as vscode from 'vscode';
import Config from '../Config';

/**
 * 符号位置信息
 */
export interface SymbolPosition {
  line: number;
  character: number;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestedPositions?: SymbolPosition[];
}

/**
 * Symbol 验证器 - 校验获取的 symbol 是否与期望的一致
 */
export class SymbolValidator {
  /**
   * 获取指定位置的 symbol 名称
   */
  static async getSymbolAtPosition(uri: vscode.Uri, position: vscode.Position): Promise<string | null> {
    const doc = await vscode.workspace.openTextDocument(uri);
    const wordRange = doc.getWordRangeAtPosition(position);
    if (!wordRange) {
      return null;
    }
    return doc.getText(wordRange);
  }

  /**
   * 验证指定位置的 symbol 是否与期望名称匹配
   * @returns 验证结果，包含是否匹配、错误信息和候选位置
   */
  static async validate(
    uri: vscode.Uri,
    position: vscode.Position,
    expectedName: string
  ): Promise<ValidationResult> {
    const actualName = await this.getSymbolAtPosition(uri, position);
    
    if (!actualName) {
      // 指定位置没有符号，查找候选位置
      const suggested = await this.findNearestSymbols(uri, position, expectedName);
      return {
        valid: false,
        error: `No symbol found at position (${position.line + 1}:${position.character})`,
        suggestedPositions: suggested
      };
    }
    
    if (actualName !== expectedName) {
      // 符号不匹配，查找候选位置
      const suggested = await this.findNearestSymbols(uri, position, expectedName);
      return {
        valid: false,
        error: `Symbol mismatch: expected "${expectedName}", found "${actualName}"`,
        suggestedPositions: suggested
      };
    }
    
    return { valid: true };
  }

  /**
   * 在文件中查找距离指定位置最近的 n 个同名符号
   * @param uri 文件 URI
   * @param position 参考位置
   * @param symbolName 要查找的符号名称
   * @param count 返回的最大数量（默认从配置获取）
   */
  static async findNearestSymbols(
    uri: vscode.Uri,
    position: vscode.Position,
    symbolName: string,
    count?: number
  ): Promise<SymbolPosition[]> {
    const maxCount = count ?? Config.getNearestSymbolsCount();
    
    // 获取文件中的所有符号
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri
    );
    
    if (!symbols || symbols.length === 0) {
      return [];
    }
    
    // 递归收集所有符号及其位置
    const allSymbols: { name: string; line: number; character: number }[] = [];
    this.collectSymbols(symbols, allSymbols);
    
    // 过滤同名符号并计算距离
    const matchingSymbols = allSymbols
      .filter(s => s.name === symbolName)
      .map(s => ({
        line: s.line + 1, // 转换为 1-based
        character: s.character,
        distance: this.calculateDistance(position, new vscode.Position(s.line, s.character))
      }));
    
    // 按距离排序，返回最近的 n 个（不包含 distance 字段）
    return matchingSymbols
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxCount)
      .map(s => ({ line: s.line, character: s.character }));
  }

  /**
   * 递归收集所有符号（包括子符号）
   */
  private static collectSymbols(
    symbols: vscode.DocumentSymbol[],
    result: { name: string; line: number; character: number }[]
  ): void {
    for (const symbol of symbols) {
      // 使用 selectionRange 作为符号名称的位置
      result.push({
        name: symbol.name,
        line: symbol.selectionRange.start.line,
        character: symbol.selectionRange.start.character
      });
      
      // 递归处理子符号
      if (symbol.children && symbol.children.length > 0) {
        this.collectSymbols(symbol.children, result);
      }
    }
  }

  /**
   * 计算两个位置之间的距离（行距离 + 列距离）
   */
  private static calculateDistance(pos1: vscode.Position, pos2: vscode.Position): number {
    const lineDiff = Math.abs(pos1.line - pos2.line);
    const charDiff = Math.abs(pos1.character - pos2.character);
    return lineDiff * 1000 + charDiff; // 行距离权重更高
  }
}