import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from '../utils/StringBuilder';
import { SymbolValidator, ValidationResult, SymbolPosition } from '../utils/SymbolValidator';
import { ContextHelper } from '../utils/ContextHelper';
import { LocationHelper } from '../utils/LocationHelper';

interface Definition {
  uri: string;
  line: number;
  character: number;
  context: string[];
}

interface SuggestedPosition {
  line: number;
  character: number;
}

interface GoToDefinitionResult {
  found: boolean;
  definitions: Definition[];
  hasMore: boolean;
  total: number;
  error?: string;
  suggestedPositions?: SuggestedPosition[];
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
    const validation = await SymbolValidator.validate(uri, position, symbolName);
    if (!validation.valid) {
      return {
        found: false,
        definitions: [],
        hasMore: false,
        total: 0,
        error: validation.error,
        suggestedPositions: validation.suggestedPositions
      };
    }

    const rawLocations = await vscode.commands.executeCommand<
      vscode.Location | vscode.Location[] | vscode.LocationLink[]
    >('vscode.executeDefinitionProvider', uri, position);

    const locations = LocationHelper.normalize(rawLocations);

    if (locations.length === 0) {
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
      const sb = new StringBuilder();
      sb.appendLine(this.emptyContent(result.error));
      
      // 如果有候选位置，显示建议
      if (result.suggestedPositions && result.suggestedPositions.length > 0) {
        sb.appendLine();
        sb.appendLine('**Suggested positions for this symbol:**');
        for (const pos of result.suggestedPositions) {
          sb.appendLine(`- Line ${pos.line}:${pos.character}`);
        }
        sb.appendLine();
        sb.appendLine('Did you mean one of these positions?');
      }
      
      return sb.toString();
    }

    if (!result.found || result.definitions.length === 0) {
      return this.emptyContent('No definition found');
    }
    const formatDefinition=(sb:StringBuilder,def:Definition)=>{
          sb.appendLine(`### \`${def.uri}\`:${def.line}`);
          sb.appendLine('```');
          sb.appendLine(ContextHelper.formatContext(def.context));
          sb.appendLine('```');
          sb.appendLine();
    };
    const sb=new StringBuilder();
    if(result.definitions.length===1){
      formatDefinition(sb,result.definitions[0]);
      return sb.toString();
    }
    sb.append(`Total: ${result.definitions.length} items`);
    result.definitions.forEach(def=>{
      formatDefinition(sb,def);
    });
    return sb.toString();
  }
}
