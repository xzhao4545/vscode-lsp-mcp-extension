import * as vscode from "vscode";
import { ensureWorkspaceSymbolProviderReady } from "../utils/SymbolProviderWarmup";
import { StringBuilder } from "../utils/StringBuilder";
import { BaseTool } from "./BaseTool";

interface SyncFilesResult {
	success: boolean;
	message: string;
}

/**
 * SyncFilesTool - Sync files
 * // CN: 同步文件
 */
export class SyncFilesTool extends BaseTool {
	readonly name = "syncFiles";

	async execute(args: Record<string, unknown>, token?: vscode.CancellationToken): Promise<SyncFilesResult> {
		const projectPath = args.projectPath as string;
		const paths = args.paths as string[] | undefined;
		try {
			let skippedMissingPaths = false;
			if (paths && paths.length > 0) {
				for (const p of paths) {
					const uri = this.resolveUri(projectPath, p);
					try {
						await vscode.workspace.fs.stat(uri);
					} catch (error) {
						if (error instanceof vscode.FileSystemError) {
							skippedMissingPaths = true;
							continue;
						}
						throw error;
					}
				}
			}

			await ensureWorkspaceSymbolProviderReady(projectPath, paths);
			return {
				success: true,
				message: skippedMissingPaths
					? "Files synced; skipped missing paths"
					: "Files synced",
			};
		} catch {
			return { success: false, message: "Failed to sync files" };
		}
	}

	format(result: SyncFilesResult): string {
		const sb = new StringBuilder();
		sb.appendLine("## Sync Files");
		sb.appendLine();
		if (result.success) {
			sb.appendLine(`✓ ${result.message}`);
		} else {
			sb.appendLine(`✗ ${result.message}`);
		}
		return sb.toString();
	}
}
