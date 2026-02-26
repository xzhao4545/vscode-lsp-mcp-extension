import * as vscode from 'vscode';

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
   * @returns 匹配返回 null，不匹配返回错误信息
   */
  static async validate(
    uri: vscode.Uri,
    position: vscode.Position,
    expectedName: string
  ): Promise<string | null> {
    const actualName = await this.getSymbolAtPosition(uri, position);
    if (!actualName) {
      return `No symbol found at position (${position.line + 1}:${position.character})`;
    }
    if (actualName !== expectedName) {
      return `Symbol mismatch: expected "${expectedName}", found "${actualName}"`;
    }
    return null;
  }
}
