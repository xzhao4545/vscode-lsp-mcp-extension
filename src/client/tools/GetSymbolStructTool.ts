import * as vscode from "vscode";
import Config from "../Config";
import { getDocumentSymbolsWithWarmup } from "../utils/SymbolProviderWarmup";
import { StringBuilder } from "../utils/StringBuilder";
import { type SymbolPosition, SymbolValidator } from "../utils/SymbolValidator";
import { BaseTool } from "./BaseTool";

interface SymbolInfo {
	name: string;
	kind: string;
	range: {
		start: { line: number; character: number };
		end: { line: number; character: number };
	};
	defineLoc: string;
	children?: SymbolInfo[];
	collapsed?: boolean;
}

interface GetSymbolStructResult {
	symbol?: SymbolInfo;
	error?: string;
	suggestedPositions?: SymbolPosition[];
	hasCollapsed: boolean;
}

/**
 * GetSymbolStructTool - Get structure of specified symbol
 * // CN: 获取指定符号的结构
 */
export class GetSymbolStructTool extends BaseTool {
	readonly name = "getSymbolStruct";

	async execute(args: Record<string, unknown>): Promise<GetSymbolStructResult> {
		const uri = this.resolveUri(
			args.projectPath as string,
			args.filePath as string,
		);
		const position = new vscode.Position(
			(args.line as number) - 1,
			args.character as number,
		);
		const symbolName = args.symbolName as string;
		const maxDepth = (args.maxDepth as number) ?? -1; // EN: Default auto (-1) // CN: 默认 auto (-1)
		const maxLines = Config.getMaxStructLines();

		// EN: Validate symbol // CN: 验证 symbol
		const validation = await SymbolValidator.validate(
			uri,
			position,
			symbolName,
		);
		if (!validation.valid) {
			return {
				symbol: undefined,
				error: validation.error,
				suggestedPositions: validation.suggestedPositions,
				hasCollapsed: false,
			};
		}

		// EN: Get all symbols in file // CN: 获取文件中的所有符号
		const symbols = await getDocumentSymbolsWithWarmup(uri);

		if (!symbols || symbols.length === 0) {
			return { symbol: undefined, hasCollapsed: false };
		}

		// EN: Find symbol at specified position // CN: 查找包含指定位置的符号
		const targetSymbol = this.findSymbolAtPosition(symbols, position);

		if (!targetSymbol) {
			return { symbol: undefined, hasCollapsed: false };
		}

		const mapSymbol = (s: vscode.DocumentSymbol): SymbolInfo => ({
			name: s.name,
			kind: vscode.SymbolKind[s.kind],
			range: {
				start: {
					line: s.range.start.line + 1,
					character: s.range.start.character,
				},
				end: { line: s.range.end.line + 1, character: s.range.end.character },
			},
			defineLoc: `${s.selectionRange.start.line + 1}:${s.selectionRange.start.character}`,
			children: s.children?.map(mapSymbol),
		});

		const mappedSymbol = mapSymbol(targetSymbol);

		// EN: Calculate max depth of symbol // CN: 计算符号的最大深度
		const fullMaxDepth = this.calculateMaxDepth(mappedSymbol);

		if (maxDepth < 0) {
			// EN: Auto mode // CN: Auto 模式
			const result = this.autoAdjustDepth(mappedSymbol, fullMaxDepth, maxLines);
			return result;
		} else {
			// EN: Fixed depth mode // CN: 固定深度模式
			const result = this.applyFixedDepth(mappedSymbol, maxDepth);
			return result;
		}
	}

	/**
	 * findSymbolAtPosition - Find symbol at specified position (find smallest containing symbol)
	 * // CN: 查找包含指定位置的符号（找最小的包含符号）
	 */
	private findSymbolAtPosition(
		symbols: vscode.DocumentSymbol[],
		position: vscode.Position,
	): vscode.DocumentSymbol | null {
		for (const symbol of symbols) {
			if (
				symbol.range.start.line <= position.line &&
				symbol.range.end.line >= position.line
			) {
				// EN: First find more precise match in child symbols // CN: 先在子符号中查找更精确的匹配
				const childMatch = this.findSymbolAtPosition(
					symbol.children || [],
					position,
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
	 * calculateMaxDepth - Calculate max depth of symbol tree
	 * // CN: 计算符号树的最大深度
	 */
	private calculateMaxDepth(symbol: SymbolInfo): number {
		return this.getSymbolDepth(symbol, 1);
	}

	private getSymbolDepth(symbol: SymbolInfo, currentDepth: number): number {
		if (!symbol.children || symbol.children.length === 0) {
			return currentDepth;
		}
		let maxChildDepth = currentDepth;
		for (const child of symbol.children) {
			maxChildDepth = Math.max(
				maxChildDepth,
				this.getSymbolDepth(child, currentDepth + 1),
			);
		}
		return maxChildDepth;
	}

	/**
	 * autoAdjustDepth - Auto mode: automatically adjust depth to meet maxLines limit
	 * // CN: Auto 模式：自动调整深度以满足 maxLines 限制
	 */
	private autoAdjustDepth(
		symbol: SymbolInfo,
		maxPossibleDepth: number,
		maxLines: number,
	): GetSymbolStructResult {
		for (let depth = maxPossibleDepth; depth >= 1; depth--) {
			const result = this.applyDepthWithCollapse(symbol, depth);
			const lineCount = this.countOutputLines(result.symbol);

			if (lineCount <= maxLines) {
				return result;
			}
		}

		return this.applyDepthWithCollapse(symbol, 1);
	}

	/**
	 * applyDepthWithCollapse - Apply target depth, nodes exceeding depth are marked as collapsed
	 * // CN: 应用指定深度，超出深度的节点标记为 collapsed
	 */
	private applyDepthWithCollapse(
		symbol: SymbolInfo,
		targetDepth: number,
	): GetSymbolStructResult {
		const processedSymbol = this.processSymbolWithDepth(symbol, 1, targetDepth);
		const hasCollapsed =
			Boolean(processedSymbol?.collapsed) ||
			Boolean(
				processedSymbol?.children &&
					this.checkHasCollapsed(processedSymbol.children),
			);
		return { symbol: processedSymbol, hasCollapsed };
	}

	private processSymbolWithDepth(
		symbol: SymbolInfo,
		currentDepth: number,
		targetDepth: number,
	): SymbolInfo {
		if (currentDepth >= targetDepth) {
			if (symbol.children && symbol.children.length > 0) {
				return {
					...symbol,
					children: undefined,
					collapsed: true,
				};
			}
			return symbol;
		}

		if (symbol.children && symbol.children.length > 0) {
			return {
				...symbol,
				children: symbol.children.map((c) =>
					this.processSymbolWithDepth(c, currentDepth + 1, targetDepth),
				),
			};
		}
		return symbol;
	}

	/**
	 * applyFixedDepth - Fixed depth mode
	 * // CN: 固定深度模式
	 */
	private applyFixedDepth(
		symbol: SymbolInfo,
		targetDepth: number,
	): GetSymbolStructResult {
		const processedSymbol = this.processSymbolWithDepth(symbol, 1, targetDepth);
		const hasCollapsed =
			Boolean(processedSymbol?.collapsed) ||
			Boolean(
				processedSymbol?.children &&
					this.checkHasCollapsed(processedSymbol.children),
			);
		return { symbol: processedSymbol, hasCollapsed };
	}

	/**
	 * checkHasCollapsed - Check if any collapsed nodes exist
	 * // CN: 检查是否存在折叠节点
	 */
	private checkHasCollapsed(symbols: SymbolInfo[]): boolean {
		for (const symbol of symbols) {
			if (symbol.collapsed) {
				return true;
			}
			if (symbol.children && this.checkHasCollapsed(symbol.children)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * countOutputLines - Calculate output line count
	 * // CN: 计算输出行数
	 */
	private countOutputLines(symbol: SymbolInfo | undefined): number {
		if (!symbol) {
			return 3;
		}
		let count = 3; // 标题行
		count += this.countSymbolLines(symbol, 0);
		return count;
	}

	private countSymbolLines(symbol: SymbolInfo, indent: number): number {
		let count = 1;
		if (symbol.children && !symbol.collapsed) {
			for (const child of symbol.children) {
				count += this.countSymbolLines(child, indent + 1);
			}
		}
		return count;
	}

	format(result: GetSymbolStructResult): string {
		const sb = new StringBuilder();
		sb.appendLine("## Symbol Structure");
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

		if (!result.symbol) {
			sb.appendLine(this.emptyContent("No symbol found"));
			return sb.toString();
		}

		const formatSymbol = (symbol: SymbolInfo, indent: number): void => {
			const prefix = "  ".repeat(indent);
			const collapsedMarker = symbol.collapsed ? " *collapsed*" : "";
			sb.appendLine(
				`${prefix}- **${symbol.name}** (${symbol.kind}) [defineLoc:${symbol.defineLoc}] [range:L${symbol.range.start.line}-${symbol.range.end.line}]${collapsedMarker}`,
			);
			if (symbol.children && !symbol.collapsed) {
				for (const child of symbol.children) {
					formatSymbol(child, indent + 1);
				}
			}
		};

		formatSymbol(result.symbol, 0);

		if (result.hasCollapsed) {
			sb.appendLine();
			sb.appendLine(
				"*Some symbols are collapsed. Use `getSymbolStruct` with deeper `maxDepth` or line:character of collapsed symbol to expand.*",
			);
		}

		return sb.toString();
	}
}
