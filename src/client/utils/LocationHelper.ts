import * as vscode from 'vscode';

/**
 * LocationHelper - 统一处理 Location 和 LocationLink 类型
 * 
 * VSCode 的 Definition/Implementation Provider 可能返回:
 * - Location
 * - Location[]
 * - LocationLink[] (也叫 DefinitionLink[])
 * 
 * 此工具类将它们统一转换为 Location[] 格式
 */
export class LocationHelper {
  /**
   * 将 Provider 返回的结果标准化为 Location[]
   * 
   * @param results - executeDefinitionProvider/executeImplementationProvider 的返回值
   * @returns 标准化后的 Location 数组
   */
  static normalize(
    results: vscode.Location | vscode.Location[] | vscode.LocationLink[] | undefined | null
  ): vscode.Location[] {
    if (!results) {
      return [];
    }

    // 单个 Location
    if (!Array.isArray(results)) {
      return [results];
    }

    // 空数组
    if (results.length === 0) {
      return [];
    }

    // 判断是 Location[] 还是 LocationLink[]
    return results.map(item => this.toLocation(item));
  }

  /**
   * 将单个 Location 或 LocationLink 转换为 Location
   */
  private static toLocation(item: vscode.Location | vscode.LocationLink): vscode.Location {
    // LocationLink 有 targetUri 属性，Location 有 uri 属性
    if (this.isLocationLink(item)) {
      return new vscode.Location(item.targetUri, item.targetRange);
    }
    return item;
  }

  /**
   * 类型守卫：判断是否为 LocationLink
   */
  private static isLocationLink(
    item: vscode.Location | vscode.LocationLink
  ): item is vscode.LocationLink {
    return 'targetUri' in item;
  }
}
