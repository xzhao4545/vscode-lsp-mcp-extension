import * as vscode from "vscode";
import { BaseTool } from "./BaseTool";
import { StringBuilder } from "../utils/StringBuilder";
import { PaginationHelper } from "../utils/PaginationHelper";
import Config from "../Config";

interface Diagnostic {
  message: string;
  severity: string;
  line: number;
  character: number;
}

interface GetDiagnosticsResult {
  diagnostics: Diagnostic[];
  hasMore: boolean;
  total: number;
}

/**
 * GetDiagnostics - 获取诊断信息
 */
export class GetDiagnosticsTool extends BaseTool {
  readonly name = "getDiagnostics";

  async execute(args: Record<string, unknown>): Promise<GetDiagnosticsResult> {
    const uri = this.resolveUri(
      args.projectPath as string,
      args.filePath as string
    );
    const query = this.stringToSeverity(args.severity as string);

    // 等待诊断就绪
    await this.waitForDiagnostics(uri);

    const diagnostics = vscode.languages.getDiagnostics(uri);
    const result = diagnostics
      .filter((d) => {
        return d.severity <= query;
      })
      .map((d) => ({
        message: d.message,
        severity: vscode.DiagnosticSeverity[d.severity],
        line: d.range.start.line + 1,
        character: d.range.start.character,
      }));
    return { diagnostics: result, hasMore: false, total: result.length };
  }

  /**
   * 检查文件是否已加载到内存
   */
  private isDocumentLoaded(uri: vscode.Uri): boolean {
    return vscode.workspace.textDocuments.some(
      (doc) => doc.uri.toString() === uri.toString()
    );
  }

  /**
   * 后台打开文件（不在编辑器中展示）
   */
  private async openDocumentInBackground(uri: vscode.Uri): Promise<void> {
    await vscode.workspace.openTextDocument(uri);
  }

  /**
   * 等待诊断就绪
   * - 如果文件已加载，直接返回（诊断可能已存在）
   * - 如果文件未加载，后台打开并等待诊断事件
   */
  private async waitForDiagnostics(uri: vscode.Uri): Promise<void> {
    // 如果文件已加载，可能已有诊断
    if (this.isDocumentLoaded(uri)) {
      // 给一点时间让语言服务器响应（诊断可能还在生成中）
      await this.waitForDiagnosticsEvent(uri, 1000);
      return;
    }

    // 后台打开文件
    await this.openDocumentInBackground(uri);

    // 等待诊断事件
    await this.waitForDiagnosticsEvent(uri, Config.getDiagnosticsTimeout());
  }

  /**
   * 等待诊断变化事件
   * @param uri 文件 URI
   * @param timeout 超时时间（毫秒）
   */
  private waitForDiagnosticsEvent(uri: vscode.Uri, timeout: number): Promise<void> {
    return new Promise((resolve) => {
      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        if (e.uris.some((u) => u.toString() === uri.toString())) {
          disposable.dispose();
          resolve();
        }
      });

      // 超时处理
      setTimeout(() => {
        disposable.dispose();
        resolve();
      }, timeout);
    });
  }
  stringToSeverity(s: string | undefined) {
    switch (s) {
      case "Error":
        return vscode.DiagnosticSeverity.Error;
      case "Warning":
        return vscode.DiagnosticSeverity.Warning;
      case "Information":
        return vscode.DiagnosticSeverity.Information;
      case "Hint":
        return vscode.DiagnosticSeverity.Hint;
      default:
        return vscode.DiagnosticSeverity.Warning;
    }
  }

  format(result: GetDiagnosticsResult, args: Record<string, unknown>): string {
    if (result.diagnostics.length === 0) {
      return this.emptyContent("No diagnostics found");
    }

    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.diagnostics, page);

    return PaginationHelper.wrapPaginated(
      "Diagnostics",
      paginated.page,
      paginated.totalPages,
      paginated.totalItems,
      paginated.hasMore,
      (sb: StringBuilder) => {
        for (const diag of paginated.items) {
          sb.appendLine(
            `- **[${diag.severity}]** L${diag.line}:${diag.character} - ${diag.message}`
          );
        }
      }
    );
  }
}
