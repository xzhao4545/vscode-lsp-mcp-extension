import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from './StringBuilder';
import { PaginationHelper } from './PaginationHelper';

interface Implementation {
  uri: string;
  line: number;
  character: number;
}

interface GoToImplementationResult {
  implementations: Implementation[];
  hasMore: boolean;
  total: number;
}

/**
 * GoToImplementation - 查找实现
 */
export class GoToImplementationTool extends BaseTool {
  readonly name = 'goToImplementation';

  async execute(args: Record<string, unknown>): Promise<GoToImplementationResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeImplementationProvider',
      uri,
      position
    );
    const implementations = (locations || []).map(loc => ({
      uri: loc.uri.fsPath,
      line: loc.range.start.line + 1,
      character: loc.range.start.character
    }));
    return { implementations, hasMore: false, total: implementations.length };
  }

  format(result: GoToImplementationResult, args: Record<string, unknown>): string {
    if (result.implementations.length === 0) {
      return this.emptyContent('No implementations found');
    }

    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.implementations, page);

    return PaginationHelper.wrapPaginated(
      'Implementations',
      paginated.page,
      paginated.totalPages,
      paginated.totalItems,
      paginated.hasMore,
      (sb: StringBuilder) => {
        for (const impl of paginated.items) {
          sb.appendLine(`- \`${impl.uri}\` : Line ${impl.line}, Col ${impl.character}`);
        }
      }
    );
  }
}
