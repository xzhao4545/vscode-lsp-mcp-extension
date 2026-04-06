import * as vscode from "vscode";
import { ContextHelper } from "../utils/ContextHelper";
import { PaginationHelper } from "../utils/PaginationHelper";
import { StringBuilder } from "../utils/StringBuilder";
import { type SymbolPosition, SymbolValidator } from "../utils/SymbolValidator";
import { BaseTool } from "./BaseTool";

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
	suggestedPositions?: SymbolPosition[];
}

export async function flattenIncomingCalls(
	calls: readonly vscode.CallHierarchyIncomingCall[],
	getContextAroundLine: (
		uri: vscode.Uri,
		line: number,
	) => Promise<string[]> = (uri, line) =>
		ContextHelper.getContextAroundLine(uri, line),
): Promise<IncomingCall[]> {
	const incomingCalls = await Promise.all(
		calls.flatMap((call) => {
			const callRanges =
				call.fromRanges.length > 0
					? call.fromRanges
					: [call.from.selectionRange ?? call.from.range];

			return callRanges.map(async (callRange) => {
				const line = callRange.start.line + 1;
				const context = await getContextAroundLine(call.from.uri, line);
				return {
					uri: call.from.uri.fsPath,
					line,
					character: callRange.start.character,
					name: call.from.name,
					context,
				};
			});
		}),
	);

	return incomingCalls;
}

/**
 * IncomingCalls - 查找调用者
 */
export class IncomingCallsTool extends BaseTool {
	readonly name = "incomingCalls";

	async execute(args: Record<string, unknown>): Promise<IncomingCallsResult> {
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
				incomingCalls: [],
				hasMore: false,
				total: 0,
				error: validation.error,
				suggestedPositions: validation.suggestedPositions,
			};
		}

		const items = await vscode.commands.executeCommand<
			vscode.CallHierarchyItem[]
		>("vscode.prepareCallHierarchy", uri, position);

		if (!items || items.length === 0) {
			return { incomingCalls: [], hasMore: false, total: 0 };
		}

		const calls = await vscode.commands.executeCommand<
			vscode.CallHierarchyIncomingCall[]
		>("vscode.provideIncomingCalls", items[0]);

		const result = await flattenIncomingCalls(calls || []);

		return { incomingCalls: result, hasMore: false, total: result.length };
	}

	format(result: IncomingCallsResult, args: Record<string, unknown>): string {
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

		if (result.incomingCalls.length === 0) {
			return this.emptyContent("No incoming calls found");
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
			"Incoming Calls",
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
						sb.appendLine("```");
						sb.appendLine(ContextHelper.formatContext(call.context));
						sb.appendLine("```");
						sb.appendLine();
					}
					sb.appendLine();
				}
			},
		);
	}
}
