import * as path from "node:path";
import * as vscode from "vscode";
import config from "../Config";
import { StringBuilder } from "../utils/StringBuilder";
import { BaseTool } from "./BaseTool";

interface MoveFileEdit {
	file: string;
	edits: Array<{
		range: {
			start: { line: number; character: number };
			end: { line: number; character: number };
		};
		newText: string;
	}>;
}

interface MoveFileResult {
	success: boolean;
	newPath: string;
	updatedReferences?: MoveFileEdit[];
	rejected?: boolean;
	message?: string;
}

/**
 * MoveFile - 移动文件
 */
export class MoveFileTool extends BaseTool {
	readonly name = "moveFile";

	async execute(args: Record<string, unknown>): Promise<MoveFileResult> {
		const projectPath = args.projectPath as string;
		const sourcePath = args.sourcePath as string;
		const targetDir = args.targetDir as string;
		const sourceUri = this.resolveUri(projectPath, sourcePath);
		const targetUri = this.resolveUri(
			projectPath,
			path.join(targetDir, path.basename(sourcePath)),
		);

		// 检查是否需要用户确认
		if (!config.getAllowMoveFile()) {
			const confirmed = await this.confirmMoveFile(
				sourceUri.fsPath,
				targetUri.fsPath,
			);
			if (!confirmed) {
				return {
					success: false,
					newPath: targetUri.fsPath,
					rejected: true,
					message:
						"User rejected the move operation. Please ask the user why they rejected it and what they would like to do instead.",
				};
			}
		}

		// 使用 WorkspaceEdit.renameFile() 来移动文件，VSCode 会自动更新引用
		const workspaceEdit = new vscode.WorkspaceEdit();
		workspaceEdit.renameFile(sourceUri, targetUri, { overwrite: false });

		// 应用编辑并获取结果
		const success = await vscode.workspace.applyEdit(workspaceEdit);
		if (!success) {
			return { success: false, newPath: targetUri.fsPath };
		}

		// 提取更新的引用信息
		const updatedReferences: MoveFileEdit[] = [];
		for (const [fileUri, edits] of workspaceEdit.entries()) {
			// 跳过文件移动操作本身，只记录文本编辑
			if (edits.length > 0) {
				updatedReferences.push({
					file: fileUri.fsPath,
					edits: edits.map((e) => ({
						range: {
							start: {
								line: e.range.start.line + 1,
								character: e.range.start.character,
							},
							end: {
								line: e.range.end.line + 1,
								character: e.range.end.character,
							},
						},
						newText: e.newText,
					})),
				});
			}
		}

		return {
			success: true,
			newPath: targetUri.fsPath,
			updatedReferences:
				updatedReferences.length > 0 ? updatedReferences : undefined,
		};
	}

	/**
	 * 弹窗确认移动文件操作
	 */
	private async confirmMoveFile(
		sourcePath: string,
		targetPath: string,
	): Promise<boolean> {
		const message = vscode.l10n.t(
			"Allow moving file from {0} to {1}?",
			sourcePath,
			targetPath,
		);
		const yes = vscode.l10n.t("Yes");
		const no = vscode.l10n.t("No");
		const result = await vscode.window.showWarningMessage(
			message,
			{ modal: true },
			yes,
			no,
		);
		return result === yes;
	}

	format(result: MoveFileResult): string {
		const sb = new StringBuilder();
		sb.appendLine("## Move File");
		sb.appendLine();
		if (result.rejected) {
			sb.appendLine(`✗ ${result.message}`);
		} else if (result.success) {
			sb.appendLine(`✓ File moved to: \`${result.newPath}\``);
			// 显示更新的引用信息
			if (result.updatedReferences && result.updatedReferences.length > 0) {
				sb.appendLine();
				sb.appendLine("**Updated references:**");
				for (const ref of result.updatedReferences) {
					sb.appendLine(`- \`${ref.file}\`: ${ref.edits.length} edit(s)`);
				}
			}
		} else {
			sb.appendLine("✗ Failed to move file");
		}
		return sb.toString();
	}
}
