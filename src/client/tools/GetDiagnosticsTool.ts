import * as vscode from "vscode";
import Config from "../Config";
import { PaginationHelper } from "../utils/PaginationHelper";
import type { StringBuilder } from "../utils/StringBuilder";
import { BaseTool } from "./BaseTool";

const DIAGNOSTICS_POLL_INTERVAL_MS = 100;

interface Diagnostic {
	message: string;
	severity: string;
	line: number;
	character: number;
}

interface GetDiagnosticsResult {
	diagnostics: Diagnostic[];
	hasMore: boolean;
	total: number;
}

/**
 * GetDiagnostics - 获取诊断信息
 */
export class GetDiagnosticsTool extends BaseTool {
	readonly name = "getDiagnostics";

	async execute(args: Record<string, unknown>): Promise<GetDiagnosticsResult> {
		const uri = this.resolveUri(
			args.projectPath as string,
			args.filePath as string,
		);
		const query = this.stringToSeverity(args.severity as string);

		// 等待诊断就绪
		await this.waitForDiagnostics(uri);

		const diagnostics = vscode.languages.getDiagnostics(uri);
		const result = diagnostics
			.filter((d) => {
				return d.severity <= query;
			})
			.map((d) => ({
				message: d.message,
				severity: vscode.DiagnosticSeverity[d.severity],
				line: d.range.start.line + 1,
				character: d.range.start.character,
			}));
		return { diagnostics: result, hasMore: false, total: result.length };
	}

	/**
	 * 检查文件是否已加载到内存
	 */
	private isDocumentLoaded(uri: vscode.Uri): boolean {
		return vscode.workspace.textDocuments.some(
			(doc) => doc.uri.toString() === uri.toString(),
		);
	}

	/**
	 * 后台打开文件（不在编辑器中展示）
	 */
	private async openDocumentInBackground(uri: vscode.Uri): Promise<void> {
		await vscode.workspace.openTextDocument(uri);
	}

	/**
	 * 某些语言服务仅在文档出现在可见编辑器后才会发布诊断。
	 * 对于只在当前活动编辑器发布诊断的语言服务，需要真正激活该文档。
	 */
	private async revealDocumentForDiagnostics(
		uri: vscode.Uri,
	): Promise<vscode.TextEditor> {
		const doc = await vscode.workspace.openTextDocument(uri);
		return vscode.window.showTextDocument(doc, {
			preview: true,
			preserveFocus: false,
			viewColumn: vscode.ViewColumn.Active,
		});
	}

	/**
	 * 等待诊断就绪
	 * - 如果文件已加载，直接返回（诊断可能已存在）
	 * - 如果文件未加载，后台打开并等待诊断事件
	 */
	private async waitForDiagnostics(uri: vscode.Uri): Promise<void> {
		if (vscode.languages.getDiagnostics(uri).length > 0) {
			return;
		}

		const wasVisible = vscode.window.visibleTextEditors.some(
			(editor) => editor.document.uri.toString() === uri.toString(),
		);

		// 如果文件已加载，可能已有诊断
		if (this.isDocumentLoaded(uri)) {
			if (
				await this.waitForDiagnosticsEvent(
					uri,
					Math.min(Config.getDiagnosticsTimeout(), 1000),
				)
			) {
				return;
			}
		} else {
			// 后台打开文件
			await this.openDocumentInBackground(uri);

			// 等待诊断事件
			if (await this.waitForDiagnosticsEvent(uri, Config.getDiagnosticsTimeout())) {
				return;
			}
		}

		if (!wasVisible) {
			await this.revealDocumentForDiagnostics(uri);
			await this.waitForDiagnosticsEvent(uri, Config.getDiagnosticsTimeout());
		}
	}

	/**
	 * 等待诊断变化事件
	 * @param uri 文件 URI
	 * @param timeout 超时时间（毫秒）
	 */
	private waitForDiagnosticsEvent(
		uri: vscode.Uri,
		timeout: number,
	): Promise<boolean> {
		if (vscode.languages.getDiagnostics(uri).length > 0) {
			return Promise.resolve(true);
		}

		return new Promise((resolve) => {
			let resolved = false;
			const finish = (ready: boolean) => {
				if (resolved) {
					return;
				}
				resolved = true;
				clearInterval(pollHandle);
				clearTimeout(timeoutHandle);
				disposable.dispose();
				resolve(ready);
			};

			const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
				if (e.uris.some((u) => u.toString() === uri.toString())) {
					if (vscode.languages.getDiagnostics(uri).length > 0) {
						finish(true);
					}
				}
			});
			const pollHandle = setInterval(() => {
				if (vscode.languages.getDiagnostics(uri).length > 0) {
					finish(true);
				}
			}, DIAGNOSTICS_POLL_INTERVAL_MS);

			// 超时处理
			const timeoutHandle = setTimeout(() => {
				finish(vscode.languages.getDiagnostics(uri).length > 0);
			}, timeout);
		});
	}
	stringToSeverity(s: string | undefined) {
		switch (s) {
			case "Error":
				return vscode.DiagnosticSeverity.Error;
			case "Warning":
				return vscode.DiagnosticSeverity.Warning;
			case "Information":
				return vscode.DiagnosticSeverity.Information;
			case "Hint":
				return vscode.DiagnosticSeverity.Hint;
			default:
				return vscode.DiagnosticSeverity.Warning;
		}
	}

	format(result: GetDiagnosticsResult, args: Record<string, unknown>): string {
		if (result.diagnostics.length === 0) {
			return this.emptyContent("No diagnostics found");
		}

		const page = (args.page as number) || 1;
		const paginated = PaginationHelper.paginate(result.diagnostics, page);

		return PaginationHelper.wrapPaginated(
			"Diagnostics",
			paginated.page,
			paginated.totalPages,
			paginated.totalItems,
			paginated.hasMore,
			(sb: StringBuilder) => {
				for (const diag of paginated.items) {
					sb.appendLine(
						`- **[${diag.severity}]** L${diag.line}:${diag.character} - ${diag.message}`,
					);
				}
			},
		);
	}
}
