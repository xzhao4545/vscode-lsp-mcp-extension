import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from './StringBuilder';
import { PaginationHelper } from './PaginationHelper';

interface Reference {
  uri: string;
  line: number;
  character: number;
}

interface FindReferencesResult {
  references: Reference[];
  hasMore: boolean;
  total: number;
}

/**
 * FindReferences - 查找引用
 */
export class FindReferencesTool extends BaseTool {
  readonly name = 'findReferences';

  async execute(args: Record<string, unknown>): Promise<FindReferencesResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      uri,
      position
    );
    const references = (locations || []).map(loc => ({
      uri: loc.uri.fsPath,
      line: loc.range.start.line + 1,
      character: loc.range.start.character
    }));
    return { references, hasMore: false, total: references.length };
  }

  format(result: FindReferencesResult, args: Record<string, unknown>): string {
    if (result.references.length === 0) {
      return this.emptyContent('No references found');
    }

    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.references, page);

    return PaginationHelper.wrapPaginated(
      'References',
      paginated.page,
      paginated.totalPages,
      paginated.totalItems,
      paginated.hasMore,
      (sb: StringBuilder) => {
        for (const ref of paginated.items) {
          sb.appendLine(`- \`${ref.uri}\` : Line ${ref.line}, Col ${ref.character}`);
        }
      }
    );
  }
}
