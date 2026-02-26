import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from '../utils/StringBuilder';
import { ContextHelper } from '../utils/ContextHelper';

interface GetScopeParentResult {
  found: boolean;
  name?: string;
  kind?: string;
  uri?: string;
  line?: number;
  character?: number;
  context?: string[];
}

/**
 * GetScopeParent - 查找父级符号
 */
export class GetScopeParentTool extends BaseTool {
  readonly name = 'getScopeParent';

  async execute(args: Record<string, unknown>): Promise<GetScopeParentResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const line = (args.line as number) - 1;
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri
    );
    if (!symbols || symbols.length === 0) {
      return { found: false };
    }

    const findParent = (syms: vscode.DocumentSymbol[], targetLine: number): vscode.DocumentSymbol | null => {
      for (const s of syms) {
        if (s.range.start.line <= targetLine && s.range.end.line >= targetLine) {
          const child = findParent(s.children || [], targetLine);
          return child || s;
        }
      }
      return null;
    };

    const parent = findParent(symbols, line);
    if (!parent) {
      return { found: false };
    }
    return {
      found: true,
      name: parent.name,
      kind: vscode.SymbolKind[parent.kind],
      uri: uri.fsPath,
      line: parent.range.start.line + 1,
      character: parent.range.start.character,
      context: await ContextHelper.getContextAroundLine(uri,parent.range.start.line+1)
    };
  }

  format(result: GetScopeParentResult): string {
    const sb = new StringBuilder();
    sb.appendLine('## Scope Parent');
    sb.appendLine();
    if (!result.found) {
      sb.appendLine(this.emptyContent('No parent symbol found'));
    } else {
      sb.appendLine(`**Name:** ${result.name}`);
      sb.appendLine(`**Kind:** ${result.kind}`);
      sb.appendLine(`**Location:** \`${result.uri}\`:${result.line}:${result.character}`);
      sb.appendLine(`**Context:**`);
      if(result.context) {
        sb.append("```");
        sb.appendLine(ContextHelper.formatContext(result.context));
        sb.append("```");
      }
    }
    return sb.toString();
  }
}
