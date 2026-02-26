import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from '../utils/StringBuilder';
import { PaginationHelper } from '../utils/PaginationHelper';
import { ContextHelper } from '../utils/ContextHelper';

interface WorkspaceSymbol {
  name: string;
  kind: string;
  uri: string;
  line: number;
  context: string[];
}

interface SearchSymbolResult {
  symbols: WorkspaceSymbol[];
  hasMore: boolean;
  total: number;
}

/**
 * SearchSymbolInWorkspace - 工作区符号搜索
 */
export class SearchSymbolInWorkspaceTool extends BaseTool {
  readonly name = 'searchSymbolInWorkspace';

  async execute(args: Record<string, unknown>): Promise<SearchSymbolResult> {
    const query = args.query as string;
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider',
      query
    );

    const result = await Promise.all((symbols || []).map(async s => {
      const context = await ContextHelper.getContextAroundLine(
        s.location.uri,
        s.location.range.start.line + 1
      );
      return {
        name: s.name,
        kind: vscode.SymbolKind[s.kind],
        uri: s.location.uri.fsPath,
        line: s.location.range.start.line + 1,
        context
      };
    }));

    return { symbols: result, hasMore: false, total: result.length };
  }

  format(result: SearchSymbolResult, args: Record<string, unknown>): string {
    if (result.symbols.length === 0) {
      return this.emptyContent('No symbols found');
    }

    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.symbols, page);

    return PaginationHelper.wrapPaginated(
      'Workspace Symbols',
      paginated.page,
      paginated.totalPages,
      paginated.totalItems,
      paginated.hasMore,
      (sb: StringBuilder) => {
        for (const sym of paginated.items) {
          sb.appendLine(`### ${sym.name} (${sym.kind})`);
          sb.appendLine(`\`${sym.uri}\`:${sym.line}`);
          sb.appendLine('```');
          sb.appendLine(ContextHelper.formatContext(sym.context));
          sb.appendLine('```');
          sb.appendLine();
        }
      }
    );
  }
}
