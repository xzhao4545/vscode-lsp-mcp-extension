import * as path from "node:path";
import * as vscode from "vscode";
import { PaginationHelper } from "../utils/PaginationHelper";
import type { StringBuilder } from "../utils/StringBuilder";
import { BaseTool } from "./BaseTool";

interface SearchFilesResult {
	files: string[];
	hasMore: boolean;
	total: number;
	error?: string;
}

export function buildSearchFilesGlob(recursive: boolean = true): string {
	return recursive ? "**/*" : "*";
}

export function buildSearchFilesRegex(pattern: string): RegExp {
	try {
		return new RegExp(pattern, "i");
	} catch {
		throw new Error(`Invalid file name regex: ${pattern}`);
	}
}

/**
 * SearchFilesTool - Search files
 * // CN: 搜索文件
 */
export class SearchFilesTool extends BaseTool {
	readonly name = "searchFiles";

	async execute(args: Record<string, unknown>): Promise<SearchFilesResult> {
		const projectPath = args.projectPath as string;
		const pattern = args.pattern as string;
		const directory = args.directory as string | undefined;
		const recursive = (args.recursive as boolean | undefined) ?? true;
		const searchPath = directory
			? path.join(projectPath, directory)
			: projectPath;
		let regex: RegExp;

		try {
			regex = buildSearchFilesRegex(pattern);
		} catch (error) {
			return {
				files: [],
				hasMore: false,
				total: 0,
				error:
					error instanceof Error
						? error.message
						: "Invalid file name regex",
			};
		}

		const files = await vscode.workspace.findFiles(
			new vscode.RelativePattern(searchPath, buildSearchFilesGlob(recursive)),
			"**/node_modules/**",
		);
		const matched = files.filter((f) => regex.test(path.basename(f.fsPath)));
		return {
			files: matched.map((f) => f.fsPath),
			hasMore: false,
			total: matched.length,
		};
	}

	format(result: SearchFilesResult, args: Record<string, unknown>): string {
		if (result.error) {
			return this.emptyContent(result.error);
		}

		if (result.files.length === 0) {
			return this.emptyContent("No files found");
		}

		const page = (args.page as number) || 1;
		const paginated = PaginationHelper.paginate(result.files, page);

		return PaginationHelper.wrapPaginated(
			"Search Files",
			paginated.page,
			paginated.totalPages,
			paginated.totalItems,
			paginated.hasMore,
			(sb: StringBuilder) => {
				for (const file of paginated.items) {
					sb.appendLine(`- \`${file}\``);
				}
			},
		);
	}
}
