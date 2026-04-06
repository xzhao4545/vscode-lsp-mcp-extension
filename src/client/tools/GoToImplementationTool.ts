import * as vscode from "vscode";
import { ContextHelper } from "../utils/ContextHelper";
import { LocationHelper } from "../utils/LocationHelper";
import { PaginationHelper } from "../utils/PaginationHelper";
import { StringBuilder } from "../utils/StringBuilder";
import { type SymbolPosition, SymbolValidator } from "../utils/SymbolValidator";
import { BaseTool } from "./BaseTool";

interface Implementation {
	uri: string;
	line: number;
	character: number;
	context: string[];
}

interface GoToImplementationResult {
	implementations: Implementation[];
	hasMore: boolean;
	total: number;
	error?: string;
	suggestedPositions?: SymbolPosition[];
}

/**
 * GoToImplementation - 查找实现
 */
export class GoToImplementationTool extends BaseTool {
	readonly name = "goToImplementation";

	async execute(
		args: Record<string, unknown>,
	): Promise<GoToImplementationResult> {
		const uri = this.resolveUri(
			args.projectPath as string,
			args.filePath as string,
		);
		const position = new vscode.Position(
			(args.line as number) - 1,
			args.character as number,
		);
		const symbolName = args.symbolName as string;

		// 验证 symbol
		const validation = await SymbolValidator.validate(
			uri,
			position,
			symbolName,
		);
		if (!validation.valid) {
			return {
				implementations: [],
				hasMore: false,
				total: 0,
				error: validation.error,
				suggestedPositions: validation.suggestedPositions,
			};
		}

		const rawLocations = await vscode.commands.executeCommand<
			vscode.Location | vscode.Location[] | vscode.LocationLink[]
		>("vscode.executeImplementationProvider", uri, position);

		const locations = LocationHelper.normalize(rawLocations).filter(
			(location) =>
				location.uri.toString() !== uri.toString() ||
				!location.range.contains(position),
		);

		const implementations = await Promise.all(
			locations.map(async (loc) => {
				const context = await ContextHelper.getContextAroundLine(
					loc.uri,
					loc.range.start.line + 1,
				);
				return {
					uri: loc.uri.fsPath,
					line: loc.range.start.line + 1,
					character: loc.range.start.character,
					context,
				};
			}),
		);

		return { implementations, hasMore: false, total: implementations.length };
	}

	format(
		result: GoToImplementationResult,
		args: Record<string, unknown>,
	): string {
		if (result.error) {
			const sb = new StringBuilder();
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

		if (result.implementations.length === 0) {
			return this.emptyContent("No implementations found");
		}

		const page = (args.page as number) || 1;
		const paginated = PaginationHelper.paginate(result.implementations, page);

		return PaginationHelper.wrapPaginated(
			"Implementations",
			paginated.page,
			paginated.totalPages,
			paginated.totalItems,
			paginated.hasMore,
			(sb: StringBuilder) => {
				for (const impl of paginated.items) {
					sb.appendLine(`### \`${impl.uri}\`:${impl.line}:${impl.character}`);
					sb.appendLine("```");
					sb.appendLine(ContextHelper.formatContext(impl.context));
					sb.appendLine("```");
					sb.appendLine();
				}
			},
		);
	}
}
