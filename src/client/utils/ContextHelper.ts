import * as vscode from "vscode";
import Config from "../Config";

async function getContextByPath(
	filePath: string,
	startLine: number,
	endLine: number,
): Promise<string[]> {
	const uri = vscode.Uri.file(filePath);
	return getContextByUri(uri, startLine, endLine);
}

async function getContextByUri(
	uri: vscode.Uri,
	startLine: number,
	endLine: number,
): Promise<string[]> {
	const doc = await vscode.workspace.openTextDocument(uri);
	const result: string[] = [];

	const start = Math.max(1, startLine);
	const end = Math.min(doc.lineCount, endLine);

	for (let i = start; i <= end; i++) {
		const line = doc.lineAt(i - 1);
		result.push(`${i}|${line.text}`);
	}

	return result;
}

async function getContextAroundLine(
	uri: vscode.Uri,
	line: number,
	contextLines?: number,
): Promise<string[]> {
	const lines = contextLines ?? Config.getContextLines();
	const startLine = Math.max(1, line - lines);
	const endLine = line + lines;
	return getContextByUri(uri, startLine, endLine);
}

function formatContext(contextLines: string[]): string {
	return contextLines.join("\n");
}

export const ContextHelper = {
	getContextByPath,
	getContextByUri,
	getContextAroundLine,
	formatContext,
};
