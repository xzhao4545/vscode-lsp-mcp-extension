import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from '../utils/StringBuilder';
import { SymbolValidator } from '../utils/SymbolValidator';

interface Definition {
  uri: string;
  line: number;
  text: string;
  kind: string;
}

interface GetDefinitionTextResult {
  definition: Definition[];
  error?: string;
}

/**
 * GetDefinitionText - 获取定义文本
 */
export class GetDefinitionTextTool extends BaseTool {
  readonly name = 'getDefinitionText';

  async execute(args: Record<string, unknown>): Promise<GetDefinitionTextResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const symbolName = args.symbolName as string;

    // 验证 symbol
    const validationError = await SymbolValidator.validate(uri, position, symbolName);
    if (validationError) {
      return { definition: [], error: validationError };
    }

    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      uri,
      position
    );

    if (!locations || locations.length === 0) {
      return { definition: [] };
    }

    const definitions = await Promise.all(locations.map(async loc => {
      const doc = await vscode.workspace.openTextDocument(loc.uri);
      const text = doc.getText(loc.range);
      return {
        uri: loc.uri.fsPath,
        line: loc.range.start.line + 1,
        text,
        kind: 'definition'
      };
    }));

    return { definition: definitions };
  }

  format(result: GetDefinitionTextResult): string {
    const sb = new StringBuilder();
    sb.appendLine('## Definition Text');
    sb.appendLine();

    if (result.error) {
      sb.appendLine(this.emptyContent(result.error));
      return sb.toString();
    }

    if (result.definition.length === 0) {
      sb.appendLine(this.emptyContent('No definition found'));
      return sb.toString();
    }

    for (const def of result.definition) {
      sb.appendLine(`### \`${def.uri}\`:${def.line}`);
      sb.appendLine('```');
      sb.appendLine(def.text);
      sb.appendLine('```');
      sb.appendLine();
    }

    return sb.toString();
  }
}
