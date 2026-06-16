import * as vscode from "vscode";
import Config from "../Config";
import { getDocumentSymbolsWithWarmup } from "../utils/SymbolProviderWarmup";
import { StringBuilder } from "../utils/StringBuilder";
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

interface GetFileStructResult {
	symbols: SymbolInfo[];
	hasCollapsed: boolean;
}

/**
 * GetFileStructTool - File symbol structure
 * // CN: 文件符号结构
 */
export class GetFileStructTool extends BaseTool {
	readonly name = "getFileStruct";

	async execute(args: Record<string, unknown>): Promise<GetFileStructResult> {
		const uri = this.resolveUri(
			args.projectPath as string,
			args.filePath as string,
		);
		const maxDepth = (args.maxDepth as number) ?? -1; // EN: Default auto (-1) // CN: 默认 auto (-1)
		const maxLines = Config.getMaxStructLines();

		const symbols = await getDocumentSymbolsWithWarmup(uri);

		if (!symbols || symbols.length === 0) {
			return { symbols: [], hasCollapsed: false };
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

		const mappedSymbols = symbols.map(mapSymbol);

		// EN: Calculate max depth of complete tree // CN: 计算完整树的最大深度
		const fullMaxDepth = this.calculateMaxDepth(mappedSymbols);

		if (maxDepth < 0) {
			// EN: Auto mode: decrement from max depth until line count <= maxLines // CN: Auto 模式：从最大深度递减直到行数 <= maxLines
			const result = this.autoAdjustDepth(
				mappedSymbols,
				fullMaxDepth,
				maxLines,
			);
			return result;
		} else {
			// EN: Fixed depth mode: ignore maxLines // CN: 固定深度模式：忽略 maxLines
			const result = this.applyFixedDepth(mappedSymbols, maxDepth);
			return result;
		}
	}

	/**
	 * calculateMaxDepth - Calculate max depth of symbol tree
	 * // CN: 计算符号树的最大深度
	 */
	private calculateMaxDepth(symbols: SymbolInfo[]): number {
		let maxDepth = 0;
		for (const symbol of symbols) {
			const depth = this.getSymbolDepth(symbol, 1);
			maxDepth = Math.max(maxDepth, depth);
		}
		return maxDepth;
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
		symbols: SymbolInfo[],
		maxPossibleDepth: number,
		maxLines: number,
	): GetFileStructResult {
		// EN: Start decrementing from max depth // CN: 从最大深度开始递减
		for (let depth = maxPossibleDepth; depth >= 1; depth--) {
			const result = this.applyDepthWithCollapse(symbols, depth);
			const lineCount = this.countOutputLines(result.symbols);

			if (lineCount <= maxLines) {
				return result;
			}
		}

		// EN: Even depth 1 exceeds limit, force depth 1 and mark all symbols with children as collapsed // CN: 即使深度为 1 也超过限制，强制深度 1 并标记所有有子节点的符号为折叠
		return this.applyDepthWithCollapse(symbols, 1);
	}

	/**
	 * applyDepthWithCollapse - Apply target depth, nodes exceeding depth are marked as collapsed
	 * // CN: 应用指定深度，超出深度的节点标记为 collapsed
	 */
	private applyDepthWithCollapse(
		symbols: SymbolInfo[],
		targetDepth: number,
	): GetFileStructResult {
		const processedSymbols = symbols.map((s) =>
			this.processSymbolWithDepth(s, 1, targetDepth),
		);
		const hasCollapsed = this.checkHasCollapsed(processedSymbols);
		return { symbols: processedSymbols, hasCollapsed };
	}

	private processSymbolWithDepth(
		symbol: SymbolInfo,
		currentDepth: number,
		targetDepth: number,
	): SymbolInfo {
		if (currentDepth >= targetDepth) {
			// EN: Reached target depth, check if has children // CN: 到达目标深度，检查是否有子节点
			if (symbol.children && symbol.children.length > 0) {
				return {
					...symbol,
					children: undefined,
					collapsed: true,
				};
			}
			return symbol;
		}

		// EN: Not yet reached target depth, keep children // CN: 未到达目标深度，保留子节点
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
		symbols: SymbolInfo[],
		targetDepth: number,
	): GetFileStructResult {
		const processedSymbols = symbols.map((s) =>
			this.processSymbolWithDepth(s, 1, targetDepth),
		);
		const hasCollapsed = this.checkHasCollapsed(processedSymbols);
		return { symbols: processedSymbols, hasCollapsed };
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
	 * countOutputLines - Calculate output line count (simulating format output)
	 * // CN: 计算输出行数（模拟 format 输出）
	 */
	private countOutputLines(symbols: SymbolInfo[]): number {
		let count = 3; // 标题行 "## File Structure" + 空行 + 结尾提示
		for (const symbol of symbols) {
			count += this.countSymbolLines(symbol, 0);
		}
		return count;
	}

	private countSymbolLines(symbol: SymbolInfo, indent: number): number {
		// EN: Each symbol takes one line // CN: 每个符号占一行
		let count = 1;
		if (symbol.children && !symbol.collapsed) {
			for (const child of symbol.children) {
				count += this.countSymbolLines(child, indent + 1);
			}
		}
		return count;
	}

	format(result: GetFileStructResult): string {
		const sb = new StringBuilder();
		sb.appendLine("## File Structure");
		sb.appendLine();

		if (result.symbols.length === 0) {
			sb.appendLine(this.emptyContent("No symbols found"));
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

		for (const symbol of result.symbols) {
			formatSymbol(symbol, 0);
		}

		if (result.hasCollapsed) {
			sb.appendLine();
			sb.appendLine(
				"*Some symbols are collapsed. Use `getSymbolStruct` with line:character to expand.*",
			);
		}

		return sb.toString();
	}
}
