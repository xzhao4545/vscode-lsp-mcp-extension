import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from '../utils/StringBuilder';
import { PaginationHelper } from '../utils/PaginationHelper';
import { SymbolValidator } from '../utils/SymbolValidator';
import { ContextHelper } from '../utils/ContextHelper';

interface Reference {
  uri: string;
  line: number;
  character: number;
  context: string[];
}

interface FindReferencesResult {
  references: Reference[];
  hasMore: boolean;
  total: number;
  error?: string;
}

/**
 * FindReferences - 查找引用
 */
export class FindReferencesTool extends BaseTool {
  readonly name = 'findReferences';

  async execute(args: Record<string, unknown>): Promise<FindReferencesResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const symbolName = args.symbolName as string;

    // 验证 symbol
    const validationError = await SymbolValidator.validate(uri, position, symbolName);
    if (validationError) {
      return { references: [], hasMore: false, total: 0, error: validationError };
    }

    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      uri,
      position
    );

    const references = await Promise.all((locations || []).map(async loc => {
      const context = await ContextHelper.getContextAroundLine(loc.uri, loc.range.start.line + 1, 0);
      return {
        uri: loc.uri.fsPath,
        line: loc.range.start.line + 1,
        character: loc.range.start.character,
        context
      };
    }));

    return { references, hasMore: false, total: references.length };
  }

  format(result: FindReferencesResult, args: Record<string, unknown>): string {
    if (result.error) {
      return this.emptyContent(result.error);
    }

    if (result.references.length === 0) {
      return this.emptyContent('No references found');
    }

    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.references, page);

    // 按 URI 聚合
    const grouped = new Map<string, Reference[]>();
    for (const ref of paginated.items) {
      const refs = grouped.get(ref.uri) || [];
      refs.push(ref);
      grouped.set(ref.uri, refs);
    }

    return PaginationHelper.wrapPaginated(
      'References',
      paginated.page,
      paginated.totalPages,
      paginated.totalItems,
      paginated.hasMore,
      (sb: StringBuilder) => {
        for (const [uri, refs] of Array.from(grouped.entries())) {
          sb.appendLine(`### \`${uri}\``);
          for (const ref of refs) {
            sb.appendLine(`**Location ${ref.line}:${ref.character}**`);
            sb.appendLine('```');
            sb.appendLine(ContextHelper.formatContext(ref.context));
            sb.appendLine('```');
          }
          sb.appendLine();
        }
      }
    );
}
}
