import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from '../utils/StringBuilder';
import { PaginationHelper } from '../utils/PaginationHelper';

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
  readonly name = 'getDiagnostics';

  async execute(args: Record<string, unknown>): Promise<GetDiagnosticsResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const result = diagnostics.map(d => ({
      message: d.message,
      severity: vscode.DiagnosticSeverity[d.severity],
      line: d.range.start.line + 1,
      character: d.range.start.character
    }));
    return { diagnostics: result, hasMore: false, total: result.length };
  }

  format(result: GetDiagnosticsResult, args: Record<string, unknown>): string {
    if (result.diagnostics.length === 0) {
      return this.emptyContent('No diagnostics found');
    }

    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.diagnostics, page);

    return PaginationHelper.wrapPaginated(
      'Diagnostics',
      paginated.page,
      paginated.totalPages,
      paginated.totalItems,
      paginated.hasMore,
      (sb: StringBuilder) => {
        for (const diag of paginated.items) {
          sb.appendLine(`- **[${diag.severity}]** L${diag.line}:${diag.character} - ${diag.message}`);
        }
      }
    );
  }
}
