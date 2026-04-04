import * as vscode from "vscode";
import config from "../Config";
import { StringBuilder } from "../utils/StringBuilder";
import { BaseTool } from "./BaseTool";

interface DeleteFileReference {
	uri: string;
	line: number;
}

interface DeleteFileResult {
	success: boolean;
	message?: string;
	references?: DeleteFileReference[];
	rejected?: boolean;
}

/**
 * DeleteFile - 删除文件
 */
export class DeleteFileTool extends BaseTool {
	readonly name = "deleteFile";

	async execute(args: Record<string, unknown>): Promise<DeleteFileResult> {
		const projectPath = args.projectPath as string;
		const filePath = args.filePath as string;
		const uri = this.resolveUri(projectPath, filePath);

		// 检查引用
		const refs = await vscode.commands.executeCommand<vscode.Location[]>(
			"vscode.executeReferenceProvider",
			uri,
			new vscode.Position(0, 0),
		);

		const references =
			refs && refs.length > 0
				? refs.map((r) => ({ uri: r.uri.fsPath, line: r.range.start.line + 1 }))
				: undefined;

		// 无论 force 是否为 true，都返回引用信息
		if (references && references.length > 0 && !args.force) {
			return {
				success: false,
				message: "File has references",
				references,
			};
		}

		// 检查是否需要用户确认（仅在真正执行删除前询问）
		if (!config.getAllowDeleteFile()) {
			const confirmed = await this.confirmDeleteFile(uri.fsPath);
			if (!confirmed) {
				return {
					success: false,
					rejected: true,
					message:
						"User rejected the delete operation. Please ask the user why they rejected it and what they would like to do instead.",
					references,
				};
			}
		}

		await vscode.workspace.fs.delete(uri);
		// force=true 时也返回引用信息，方便用户了解哪些地方需要修改
		return { success: true, references };
	}

	/**
	 * 弹窗确认删除文件操作
	 */
	private async confirmDeleteFile(filePath: string): Promise<boolean> {
		const message = vscode.l10n.t("Allow deleting file {0}?", filePath);
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

	format(result: DeleteFileResult): string {
		const sb = new StringBuilder();
		sb.appendLine("## Delete File");
		sb.appendLine();

		if (result.rejected) {
			sb.appendLine(`✗ ${result.message}`);
		} else if (result.success) {
			sb.appendLine("✓ File deleted successfully");
			// 成功删除时也显示引用信息，方便用户修改
			if (result.references && result.references.length > 0) {
				sb.appendLine();
				sb.appendLine("**References that may need updating:**");
				for (const ref of result.references) {
					sb.appendLine(`- \`${ref.uri}\`:${ref.line}`);
				}
			}
		} else {
			sb.appendLine(`✗ ${result.message || "Failed to delete file"}`);
			if (result.references && result.references.length > 0) {
				sb.appendLine();
				sb.appendLine("**References found:**");
				for (const ref of result.references) {
					sb.appendLine(`- \`${ref.uri}\`:${ref.line}`);
				}
			}
			sb.appendLine("Use the force parameter to forcibly delete the file.");
		}
		return sb.toString();
	}
}
