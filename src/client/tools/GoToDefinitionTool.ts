import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from '../utils/StringBuilder';
import { PaginationHelper } from '../utils/PaginationHelper';
import { SymbolValidator } from '../utils/SymbolValidator';
import { ContextHelper } from '../utils/ContextHelper';

interface Definition {
  uri: string;
  line: number;
  character: number;
  context: string[];
}

interface GoToDefinitionResult {
  found: boolean;
  definitions: Definition[];
  hasMore: boolean;
  total: number;
  error?: string;
}

/**
 * GoToDefinition - 跳转到定义
 */
export class GoToDefinitionTool extends BaseTool {
  readonly name = 'goToDefinition';

  async execute(args: Record<string, unknown>): Promise<GoToDefinitionResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const symbolName = args.symbolName as string;

    // 验证 symbol
    const validationError = await SymbolValidator.validate(uri, position, symbolName);
    if (validationError) {
      return { found: false, definitions: [], hasMore: false, total: 0, error: validationError };
    }

    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      uri,
      position
    );

    if (!locations || locations.length === 0) {
      return { found: false, definitions: [], hasMore: false, total: 0 };
    }

    const definitions = await Promise.all(locations.map(async loc => {
      const context = await ContextHelper.getContextAroundLine(loc.uri, loc.range.start.line + 1);
      return {
        uri: loc.uri.fsPath,
        line: loc.range.start.line + 1,
        character: loc.range.start.character,
        context
      };
    }));

    return { found: true, definitions, hasMore: false, total: definitions.length };
  }

  format(result: GoToDefinitionResult, args: Record<string, unknown>): string {
    if (result.error) {
      return this.emptyContent(result.error);
    }

    if (!result.found || result.definitions.length === 0) {
      return this.emptyContent('No definition found');
    }

    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.definitions, page);

    return PaginationHelper.wrapPaginated(
      'Go To Definition',
      paginated.page,
      paginated.totalPages,
      paginated.totalItems,
      paginated.hasMore,
      (sb: StringBuilder) => {
        for (const def of paginated.items) {
          sb.appendLine(`### \`${def.uri}\`:${def.line}`);
          sb.appendLine('```');
          sb.appendLine(ContextHelper.formatContext(def.context));
          sb.appendLine('```');
          sb.appendLine();
        }
      }
    );
  }
}
