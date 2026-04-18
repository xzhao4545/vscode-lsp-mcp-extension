import * as vscode from "vscode";
import { StringBuilder } from "../utils/StringBuilder";
import { type SymbolPosition, SymbolValidator } from "../utils/SymbolValidator";
import { BaseTool } from "./BaseTool";

interface HoverResult {
	contents: string;
	error?: string;
	suggestedPositions?: SymbolPosition[];
}

/**
 * HoverTool - Hover information
 * // CN: 悬停信息
 */
export class HoverTool extends BaseTool {
	readonly name = "hover";

	async execute(args: Record<string, unknown>): Promise<HoverResult> {
		const uri = this.resolveUri(
			args.projectPath as string,
			args.filePath as string,
		);
		const position = new vscode.Position(
			(args.line as number) - 1,
			args.character as number,
		);
		const symbolName = args.symbolName as string;

		// EN: Validate symbol // CN: 验证 symbol
		const validation = await SymbolValidator.validate(
			uri,
			position,
			symbolName,
		);
		if (!validation.valid) {
			return {
				contents: "",
				error: validation.error,
				suggestedPositions: validation.suggestedPositions,
			};
		}

		const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
			"vscode.executeHoverProvider",
			uri,
			position,
		);

		if (!hovers || hovers.length === 0) {
			return { contents: "" };
		}

		const contents = hovers[0].contents
			.map((c) => {
				if (typeof c === "string") {
					return c;
				}
				return (c as vscode.MarkdownString).value;
			})
			.join("\n");

		return { contents };
	}

	format(result: HoverResult): string {
		const sb = new StringBuilder();
		sb.appendLine("## Hover Information");
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
		} else if (!result.contents) {
			sb.appendLine(this.emptyContent("No hover information available"));
		} else {
			sb.appendLine(result.contents);
		}

		return sb.toString();
	}
}
