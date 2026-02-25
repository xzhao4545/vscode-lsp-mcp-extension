import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from './StringBuilder';
import { PaginationHelper } from './PaginationHelper';

interface IncomingCall {
  uri: string;
  line: number;
  character: number;
  name: string;
}

interface IncomingCallsResult {
  incomingCalls: IncomingCall[];
  hasMore: boolean;
  total: number;
}

/**
 * IncomingCalls - 查找调用者
 */
export class IncomingCallsTool extends BaseTool {
  readonly name = 'incomingCalls';

  async execute(args: Record<string, unknown>): Promise<IncomingCallsResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, 0);
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
    const result = (calls || []).map(c => ({
      uri: c.from.uri.fsPath,
      line: c.from.range.start.line + 1,
      character: c.from.range.start.character,
      name: c.from.name
    }));
    return { incomingCalls: result, hasMore: false, total: result.length };
  }

  format(result: IncomingCallsResult, args: Record<string, unknown>): string {
    if (result.incomingCalls.length === 0) {
      return this.emptyContent('No incoming calls found');
    }

    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.incomingCalls, page);

    return PaginationHelper.wrapPaginated(
      'Incoming Calls',
      paginated.page,
      paginated.totalPages,
      paginated.totalItems,
      paginated.hasMore,
      (sb: StringBuilder) => {
        for (const call of paginated.items) {
          sb.appendLine(`- **${call.name}** - \`${call.uri}\`:${call.line}`);
        }
      }
    );
  }
}
