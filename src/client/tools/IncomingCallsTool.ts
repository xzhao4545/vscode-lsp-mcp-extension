import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from '../utils/StringBuilder';
import { PaginationHelper } from '../utils/PaginationHelper';
import { ContextHelper } from '../utils/ContextHelper';
import { SymbolValidator } from '../utils/SymbolValidator';

interface IncomingCall {
  uri: string;
  line: number;
  character: number;
  name: string;
  context: string[];
}

interface IncomingCallsResult {
  incomingCalls: IncomingCall[];
  hasMore: boolean;
  total: number;
  error?: string;
}

/**
 * IncomingCalls - 查找调用者
 */
export class IncomingCallsTool extends BaseTool {
  readonly name = 'incomingCalls';

  async execute(args: Record<string, unknown>): Promise<IncomingCallsResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, (args.character as number));
    const symbolName = args.symbolName as string;

    // 验证 symbol
    const validationError = await SymbolValidator.validate(uri, position, symbolName);
    if (validationError) {
      return { incomingCalls: [], hasMore: false, total: 0, error: validationError };
    }
    
    const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      'vscode.prepareCallHierarchy',
      uri,
      position
    );

    if (!items || items.length === 0) {
      return { incomingCalls: [], hasMore: false, total: 0 };
    }

    const calls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
      'vscode.provideIncomingCalls',
      items[0]
    );

    const result = await Promise.all((calls || []).map(async c => {
      const context = await ContextHelper.getContextAroundLine(c.from.uri, c.from.range.start.line + 1);
      return {
        uri: c.from.uri.fsPath,
        line: c.from.range.start.line + 1,
        character: c.from.range.start.character,
        name: c.from.name,
        context
      };
    }));

    return { incomingCalls: result, hasMore: false, total: result.length };
  }

  format(result: IncomingCallsResult, args: Record<string, unknown>): string {
    if (result.error) {
      return this.emptyContent(result.error);
    }
    if (result.incomingCalls.length === 0) {
      return this.emptyContent('No incoming calls found');
    }

    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.incomingCalls, page);

    // 按 URI 聚合
    const grouped = new Map<string, IncomingCall[]>();
    for (const cal of paginated.items) {
      const cals = grouped.get(cal.uri) || [];
      cals.push(cal);
      grouped.set(cal.uri, cals);
    }

    return PaginationHelper.wrapPaginated(
      'Incoming Calls',
      paginated.page,
      paginated.totalPages,
      paginated.totalItems,
      paginated.hasMore,
      (sb: StringBuilder) => {
        for (const [uri, calls] of Array.from(grouped.entries())) {
          sb.appendLine(`## \`${uri}\``);
          for (const call of calls) {
            sb.appendLine(`### ${call.name}`);
            sb.appendLine(`**Location ${call.line}:${call.character}**`);
            sb.appendLine('```');
            sb.appendLine(ContextHelper.formatContext(call.context));
            sb.appendLine('```');
            sb.appendLine();
          }
          sb.appendLine();
        }
      }
    );
  }
}
