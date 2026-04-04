import * as vscode from "vscode";
import { StringBuilder } from "../utils/StringBuilder";
import { type SymbolPosition, SymbolValidator } from "../utils/SymbolValidator";
import { BaseTool } from "./BaseTool";

interface RenameEdit {
	range: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
	newText: string;
}

interface RenameSymbolResult {
	changes: Record<string, RenameEdit[]>;
	error?: string;
	suggestedPositions?: SymbolPosition[];
}

/**
 * RenameSymbol - 重命名
 */
export class RenameSymbolTool extends BaseTool {
	readonly name = "renameSymbol";

	async execute(args: Record<string, unknown>): Promise<RenameSymbolResult> {
		const uri = this.resolveUri(
			args.projectPath as string,
			args.filePath as string,
		);
		const position = new vscode.Position(
			(args.line as number) - 1,
			args.character as number,
		);
		const newName = args.newName as string;
		const symbolName = args.symbolName as string;

		// 验证 symbol
		const validation = await SymbolValidator.validate(
			uri,
			position,
			symbolName,
		);
		if (!validation.valid) {
			return {
				changes: {},
				error: validation.error,
				suggestedPositions: validation.suggestedPositions,
			};
		}

		const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
			"vscode.executeDocumentRenameProvider",
			uri,
			position,
			newName,
		);

		if (!edit) {
			return { changes: {} };
		}

		const changes: Record<string, RenameEdit[]> = {};
		for (const [fileUri, edits] of edit.entries()) {
			changes[fileUri.fsPath] = edits.map((e) => ({
				range: {
					start: {
						line: e.range.start.line + 1,
						character: e.range.start.character,
					},
					end: { line: e.range.end.line + 1, character: e.range.end.character },
				},
				newText: e.newText,
			}));
		}

		return { changes };
	}

	format(result: RenameSymbolResult): string {
		const sb = new StringBuilder();
		sb.appendLine("## Rename Symbol");
		sb.appendLine();

		if (result.error) {
			sb.appendLine(this.emptyContent(result.error));

			if (result.suggestedPositions && result.suggestedPositions.length > 0) {
				sb.appendLine();
				sb.appendLine("**Suggested positions for this symbol:**");
				for (const pos of result.suggestedPositions) {
					sb.appendLine(`- Line ${pos.line}:${pos.character}`);
				}
				sb.appendLine();
				sb.appendLine("Did you mean one of these positions?");
			}

			return sb.toString();
		}

		const files = Object.keys(result.changes);
		if (files.length === 0) {
			sb.appendLine(this.emptyContent("No rename edits generated"));
			return sb.toString();
		}

		sb.appendLine(`**Files affected:** ${files.length}`);
		sb.appendLine();

		for (const file of files) {
			const edits = result.changes[file];
			sb.appendLine(`### \`${file}\``);
			for (const edit of edits) {
				sb.appendLine(
					`- L${edit.range.start.line}:${edit.range.start.character} → \`${edit.newText}\``,
				);
			}
			sb.appendLine();
		}

		return sb.toString();
	}
}
