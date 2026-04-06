import * as path from "node:path";
import * as vscode from "vscode";
import { ContextHelper } from "../utils/ContextHelper";
import { PaginationHelper } from "../utils/PaginationHelper";
import {
	ensureWorkspaceSymbolProviderReady,
	retryUntilReady,
	warmWorkspaceSymbolProvider,
} from "../utils/SymbolProviderWarmup";
import type { StringBuilder } from "../utils/StringBuilder";
import { BaseTool } from "./BaseTool";

interface WorkspaceSymbol {
	name: string;
	kind: string;
	uri: string;
	line: number;
	character: number;
	context: string[];
}

interface SearchSymbolResult {
	symbols: WorkspaceSymbol[];
	hasMore: boolean;
	total: number;
}

type SymbolTypeFilter = "all" | "class" | "method" | "field";
const WORKSPACE_QUERY_RETRY_COUNT = 2;
const WORKSPACE_QUERY_RETRY_DELAY_MS = 75;
const forcedWorkspaceWarmupProjects = new Set<string>();

const SEARCHABLE_SYMBOL_KINDS = new Set<vscode.SymbolKind>([
	vscode.SymbolKind.Class,
	vscode.SymbolKind.Constant,
	vscode.SymbolKind.Constructor,
	vscode.SymbolKind.Enum,
	vscode.SymbolKind.EnumMember,
	vscode.SymbolKind.Field,
	vscode.SymbolKind.Function,
	vscode.SymbolKind.Interface,
	vscode.SymbolKind.Method,
	vscode.SymbolKind.Module,
	vscode.SymbolKind.Namespace,
	vscode.SymbolKind.Object,
	vscode.SymbolKind.Property,
	vscode.SymbolKind.Struct,
	vscode.SymbolKind.Variable,
]);

const SYMBOL_TYPE_FILTERS: Record<SymbolTypeFilter, Set<vscode.SymbolKind>> = {
	all: SEARCHABLE_SYMBOL_KINDS,
	class: new Set([
		vscode.SymbolKind.Class,
		vscode.SymbolKind.Interface,
		vscode.SymbolKind.Struct,
		vscode.SymbolKind.Enum,
	]),
	method: new Set([
		vscode.SymbolKind.Method,
		vscode.SymbolKind.Function,
		vscode.SymbolKind.Constructor,
	]),
	field: new Set([
		vscode.SymbolKind.Field,
		vscode.SymbolKind.Property,
		vscode.SymbolKind.Variable,
		vscode.SymbolKind.Constant,
		vscode.SymbolKind.EnumMember,
	]),
};

export function buildWorkspaceSymbolQueries(query: string): string[] {
	const trimmed = query.trim();
	if (!trimmed) {
		return [""];
	}

	const tokens = trimmed
		.split(/(?=[A-Z])|[_\-\s]+/)
		.map((token) => token.trim())
		.filter((token) => token.length >= 3);

	return Array.from(
		new Set([
			trimmed,
			tokens[0],
			trimmed.slice(0, Math.min(trimmed.length, 6)),
			trimmed.slice(0, Math.min(trimmed.length, 3)),
			"",
		].filter((candidate): candidate is string => candidate !== undefined)),
	);
}

export function filterWorkspaceSymbols(
	symbols: vscode.SymbolInformation[],
	projectPath: string,
	query: string,
	symbolType: SymbolTypeFilter = "all",
): vscode.SymbolInformation[] {
	const normalizedQuery = query.trim().toLowerCase();
	const kindFilter = SYMBOL_TYPE_FILTERS[symbolType] ?? SEARCHABLE_SYMBOL_KINDS;
	const projectRoot = path.resolve(projectPath);

	return symbols.filter((symbol) => {
		if (!kindFilter.has(symbol.kind)) {
			return false;
		}

		if (!matchesProjectPath(projectRoot, symbol.location.uri.fsPath)) {
			return false;
		}

		if (!normalizedQuery) {
			return true;
		}

		return symbol.name.toLowerCase().includes(normalizedQuery);
	});
}

function matchesProjectPath(projectRoot: string, candidatePath: string): boolean {
	const relative = path.relative(projectRoot, path.resolve(candidatePath));
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

export async function retryWorkspaceQuery(
	load: () => Promise<vscode.SymbolInformation[]>,
	retries: number = WORKSPACE_QUERY_RETRY_COUNT,
	delayMs: number = WORKSPACE_QUERY_RETRY_DELAY_MS,
): Promise<vscode.SymbolInformation[]> {
	return retryUntilReady(load, (symbols) => symbols.length > 0, retries, delayMs);
}

/**
 * SearchSymbolInWorkspace - 工作区符号搜索
 */
export class SearchSymbolInWorkspaceTool extends BaseTool {
	readonly name = "searchSymbolInWorkspace";

	async execute(args: Record<string, unknown>): Promise<SearchSymbolResult> {
		const query = args.query as string;
		const projectPath = args.projectPath as string;
		const normalizedProjectPath = path.resolve(projectPath);
		const symbolType =
			((args.symbolType as SymbolTypeFilter | undefined) ?? "all");
		const trimmedQuery = query.trim();

		if (trimmedQuery) {
			await ensureWorkspaceSymbolProviderReady(projectPath);
		}

		let symbols = trimmedQuery
			? await retryWorkspaceQuery(() =>
					this.queryWorkspaceSymbols(query, projectPath, symbolType),
				)
			: await this.queryWorkspaceSymbols(query, projectPath, symbolType);

		if (
			trimmedQuery &&
			symbols.length === 0 &&
			!forcedWorkspaceWarmupProjects.has(normalizedProjectPath)
		) {
			forcedWorkspaceWarmupProjects.add(normalizedProjectPath);
			await warmWorkspaceSymbolProvider(projectPath);
			symbols = await this.queryWorkspaceSymbols(query, projectPath, symbolType);
		}

		const result = await Promise.all(
			symbols.map(async (s) => {
				const context = await ContextHelper.getContextAroundLine(
					s.location.uri,
					s.location.range.start.line + 1,
					0,
				);
				return {
					name: s.name,
					kind: vscode.SymbolKind[s.kind],
					uri: s.location.uri.fsPath,
					line: s.location.range.start.line + 1,
					character: s.location.range.start.character,
					context,
				};
			}),
		);

		return { symbols: result, hasMore: false, total: result.length };
	}

	private async queryWorkspaceSymbols(
		query: string,
		projectPath: string,
		symbolType: SymbolTypeFilter,
	): Promise<vscode.SymbolInformation[]> {
		for (const providerQuery of buildWorkspaceSymbolQueries(query)) {
			const rawSymbols =
				(await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
					"vscode.executeWorkspaceSymbolProvider",
					providerQuery,
				)) || [];

			const symbols = filterWorkspaceSymbols(
				rawSymbols,
				projectPath,
				query,
				symbolType,
			);

			if (symbols.length > 0 || providerQuery === "") {
				return symbols;
			}
		}

		return [];
	}

	format(result: SearchSymbolResult, args: Record<string, unknown>): string {
		if (result.symbols.length === 0) {
			return this.emptyContent("No symbols found");
		}
		const page = (args.page as number) || 1;
		const paginated = PaginationHelper.paginate(result.symbols, page);
		// 按 URI 聚合
		const grouped = new Map<string, WorkspaceSymbol[]>();
		for (const sym of paginated.items) {
			const syms = grouped.get(sym.uri) || [];
			syms.push(sym);
			grouped.set(sym.uri, syms);
		}
		return PaginationHelper.wrapPaginated(
			"Workspace Symbols",
			paginated.page,
			paginated.totalPages,
			paginated.totalItems,
			paginated.hasMore,
			(sb: StringBuilder) => {
				for (const [uri, syms] of Array.from(grouped.entries())) {
					sb.appendLine(`## \`${uri}\``);
					for (const sym of syms) {
						sb.appendLine(
							`**${sym.name}** (${sym.kind}) - Location ${sym.line}:${sym.character}`,
						);
						sb.appendLine("```");
						sb.appendLine(ContextHelper.formatContext(sym.context));
						sb.appendLine("```");
					}
					sb.appendLine();
				}
			},
		);
	}
}
