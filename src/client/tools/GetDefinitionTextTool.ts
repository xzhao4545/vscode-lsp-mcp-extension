import * as vscode from "vscode";
import { ContextHelper } from "../utils/ContextHelper";
import { LocationHelper } from "../utils/LocationHelper";
import { getDocumentSymbolsWithWarmup } from "../utils/SymbolProviderWarmup";
import { StringBuilder } from "../utils/StringBuilder";
import { type SymbolPosition, SymbolValidator } from "../utils/SymbolValidator";
import { BaseTool } from "./BaseTool";

interface Definition {
	uri: string;
	line: number;
	text: string;
	kind: string;
}

interface GetDefinitionTextResult {
	definition: Definition[];
	error?: string;
	suggestedPositions?: SymbolPosition[];
}

/**
 * GetDefinitionTextTool - Get full definition text including comments and code body
 * // CN: 获取定义的完整文本（包括注释和代码体）
 */
export class GetDefinitionTextTool extends BaseTool {
	readonly name = "getDefinitionText";

	async execute(
		args: Record<string, unknown>,
	): Promise<GetDefinitionTextResult> {
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
				definition: [],
				error: validation.error,
				suggestedPositions: validation.suggestedPositions,
			};
		}

		const locations = await LocationHelper.resolveDefinitionLocations(
			uri,
			position,
			symbolName,
		);

		if (locations.length === 0) {
			return { definition: [] };
		}

		const definitions = await Promise.all(
			locations.map(async (loc) => {
				const fullRange = await this.getFullDefinitionRange(loc.uri, loc.range);
				const lines = await ContextHelper.getContextByUri(
					loc.uri,
					fullRange.start.line + 1,
					fullRange.end.line + 1,
				);
				const text = ContextHelper.formatContext(lines);
				return {
					uri: loc.uri.fsPath,
					line: fullRange.start.line + 1,
					text,
					kind: "definition",
				};
			}),
		);

		return { definition: definitions };
	}

	/**
	 * getFullDefinitionRange - Get full definition range including comments and code body
	 * // CN: 获取定义的完整范围（包括注释和代码体）
	 * Priority: DocumentSymbol, fallback to FoldingRange
	 * // CN: 优先使用 DocumentSymbol，备选使用 FoldingRange
	 */
	private async getFullDefinitionRange(
		uri: vscode.Uri,
		defRange: vscode.Range,
	): Promise<vscode.Range> {
		const targetLine = defRange.start.line;

		// EN: Approach 1: Find via DocumentSymbol // CN: 方案1: 通过 DocumentSymbol 查找
		const symbolRange = await this.getSymbolRange(uri, targetLine);
		if (symbolRange && symbolRange.end.line > symbolRange.start.line) {
			const rangeWithComments = await this.expandRangeWithComments(
				uri,
				symbolRange,
			);
			return rangeWithComments;
		}

		// EN: Approach 2: Find via FoldingRange (more reliable for top-level functions) // CN: 方案2: 通过 FoldingRange 查找（对顶层函数更可靠）
		const foldingRange = await this.getFoldingRange(uri, targetLine);
		if (foldingRange) {
			const range = new vscode.Range(
				new vscode.Position(foldingRange.start, 0),
				new vscode.Position(foldingRange.end + 1, 0),
			);
			const rangeWithComments = await this.expandRangeWithComments(uri, range);
			return rangeWithComments;
		}

		return defRange;
	}

	/**
	 * getSymbolRange - Get symbol range via DocumentSymbol
	 * // CN: 通过 DocumentSymbol 获取符号范围
	 */
	private async getSymbolRange(
		uri: vscode.Uri,
		targetLine: number,
	): Promise<vscode.Range | null> {
		const symbols = await getDocumentSymbolsWithWarmup(uri);
		if (!symbols || symbols.length === 0) {
			return null;
		}
		const matchingSymbol = this.findSmallestContainingSymbol(
			symbols,
			targetLine,
		);
		return matchingSymbol?.range ?? null;
	}

	/**
	 * getFoldingRange - Get code block range via FoldingRange
	 * // CN: 通过 FoldingRange 获取代码块范围
	 */
	private async getFoldingRange(
		uri: vscode.Uri,
		targetLine: number,
	): Promise<vscode.FoldingRange | null> {
		const foldingRanges = await vscode.commands.executeCommand<
			vscode.FoldingRange[]
		>("vscode.executeFoldingRangeProvider", uri);
		if (!foldingRanges || foldingRanges.length === 0) {
			return null;
		}
		// 找到包含目标行且起始行最接近目标行的折叠范围
		let bestMatch: vscode.FoldingRange | null = null;
		for (const fr of foldingRanges) {
			if (fr.start <= targetLine && fr.end >= targetLine) {
				if (!bestMatch || fr.start > bestMatch.start) {
					bestMatch = fr;
				}
			}
		}
		return bestMatch;
	}

	/**
	 * findSmallestContainingSymbol - Recursively find the smallest symbol containing the target line
	 * // CN: 递归查找包含目标行的最小符号
	 */
	private findSmallestContainingSymbol(
		symbols: vscode.DocumentSymbol[],
		targetLine: number,
	): vscode.DocumentSymbol | null {
		for (const symbol of symbols) {
			if (
				symbol.range.start.line <= targetLine &&
				symbol.range.end.line >= targetLine
			) {
				// 先在子符号中查找更精确的匹配
				const childMatch = this.findSmallestContainingSymbol(
					symbol.children || [],
					targetLine,
				);
				if (childMatch) {
					return childMatch;
				}
				return symbol;
			}
		}
		return null;
	}

	/**
	 * expandRangeWithComments - Expand range upward to include leading comments (JSDoc, line comments, etc.)
	 * // CN: 向上扩展范围以包含前置注释（JSDoc、行注释等）
	 */
	private async expandRangeWithComments(
		uri: vscode.Uri,
		range: vscode.Range,
	): Promise<vscode.Range> {
		const doc = await vscode.workspace.openTextDocument(uri);
		let startLine = range.start.line;

		// 向上查找连续的注释行
		while (startLine > 0) {
			const prevLine = doc.lineAt(startLine - 1).text.trim();
			if (
				prevLine.startsWith("//") ||
				prevLine.startsWith("/*") ||
				prevLine.startsWith("*") ||
				prevLine.endsWith("*/") ||
				prevLine.startsWith("#") ||
				prevLine.startsWith('"""') ||
				prevLine.startsWith("'''") ||
				prevLine === ""
			) {
				// 如果是空行，检查再上一行是否是注释
				if (prevLine === "" && startLine > 1) {
					const prevPrevLine = doc.lineAt(startLine - 2).text.trim();
					if (!this.isCommentLine(prevPrevLine)) {
						break;
					}
				}
				startLine--;
			} else {
				break;
			}
		}

		return new vscode.Range(new vscode.Position(startLine, 0), range.end);
	}

	private isCommentLine(line: string): boolean {
		return (
			line.startsWith("//") ||
			line.startsWith("/*") ||
			line.startsWith("*") ||
			line.endsWith("*/") ||
			line.startsWith("#") ||
			line.startsWith('"""') ||
			line.startsWith("'''")
		);
	}

	format(result: GetDefinitionTextResult): string {
		const sb = new StringBuilder();
		sb.appendLine("## Definition Text");
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

		if (result.definition.length === 0) {
			sb.appendLine(this.emptyContent("No definition found"));
			return sb.toString();
		}

		for (const def of result.definition) {
			sb.appendLine(`### \`${def.uri}\`:${def.line}`);
			sb.appendLine("```");
			sb.appendLine(def.text);
			sb.appendLine("```");
			sb.appendLine();
		}

		return sb.toString();
	}
}
