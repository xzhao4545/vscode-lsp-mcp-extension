import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from './StringBuilder';

interface SymbolInfo {
  name: string;
  kind: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  children?: SymbolInfo[];
}

interface GetFileStructResult {
  symbols: SymbolInfo[];
}

/**
 * GetFileStruct - 文件符号结构
 */
export class GetFileStructTool extends BaseTool {
  readonly name = 'getFileStruct';

  async execute(args: Record<string, unknown>): Promise<GetFileStructResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri
    );
    const mapSymbol = (s: vscode.DocumentSymbol): SymbolInfo => ({
      name: s.name,
      kind: vscode.SymbolKind[s.kind],
      range: {
        start: { line: s.range.start.line + 1, character: s.range.start.character },
        end: { line: s.range.end.line + 1, character: s.range.end.character }
      },
      children: s.children?.map(mapSymbol)
    });
    return { symbols: (symbols || []).map(mapSymbol) };
  }

  format(result: GetFileStructResult): string {
    const sb = new StringBuilder();
    sb.appendLine('## File Structure');
    sb.appendLine();
    if (result.symbols.length === 0) {
      sb.appendLine(this.emptyContent('No symbols found'));
      return sb.toString();
    }

    const formatSymbol = (symbol: SymbolInfo, indent: number): void => {
      const prefix = '  '.repeat(indent);
      sb.appendLine(`${prefix}- **${symbol.name}** (${symbol.kind}) [L${symbol.range.start.line}-${symbol.range.end.line}]`);
      if (symbol.children) {
        for (const child of symbol.children) {
          formatSymbol(child, indent + 1);
        }
      }
    };

    for (const symbol of result.symbols) {
      formatSymbol(symbol, 0);
    }
    return sb.toString();
  }
}
