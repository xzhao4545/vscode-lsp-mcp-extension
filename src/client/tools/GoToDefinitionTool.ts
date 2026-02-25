import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from './StringBuilder';

interface GoToDefinitionResult {
  found: boolean;
  uri?: string;
  line?: number;
  character?: number;
}

/**
 * GoToDefinition - 跳转到定义
 */
export class GoToDefinitionTool extends BaseTool {
  readonly name = 'goToDefinition';

  async execute(args: Record<string, unknown>): Promise<GoToDefinitionResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      uri,
      position
    );
    if (!locations || locations.length === 0) {
      return { found: false };
    }
    const loc = locations[0];
    return {
      found: true,
      uri: loc.uri.fsPath,
      line: loc.range.start.line + 1,
      character: loc.range.start.character
    };
  }

  format(result: GoToDefinitionResult): string {
    const sb = new StringBuilder();
    sb.appendLine('## Go To Definition');
    sb.appendLine();
    if (!result.found) {
      sb.appendLine(this.emptyContent('No definition found'));
    } else {
      sb.appendLine(`**File:** \`${result.uri}\``);
      sb.appendLine(`**Location:** Line ${result.line}, Column ${result.character}`);
    }
    return sb.toString();
  }
}
