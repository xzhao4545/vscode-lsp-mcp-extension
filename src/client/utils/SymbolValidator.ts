import * as vscode from "vscode";
import Config from "../Config";

export interface SymbolPosition {
	line: number;
	character: number;
}

export interface ValidationResult {
	valid: boolean;
	error?: string;
	suggestedPositions?: SymbolPosition[];
}

async function getSymbolAtPosition(
	uri: vscode.Uri,
	position: vscode.Position,
): Promise<string | null> {
	const doc = await vscode.workspace.openTextDocument(uri);
	const wordRange = doc.getWordRangeAtPosition(position);
	if (!wordRange) {
		return null;
	}
	return doc.getText(wordRange);
}

async function validate(
	uri: vscode.Uri,
	position: vscode.Position,
	expectedName: string,
): Promise<ValidationResult> {
	const actualName = await getSymbolAtPosition(uri, position);

	if (!actualName) {
		const suggested = await findNearestSymbols(uri, position, expectedName);
		return {
			valid: false,
			error: `No symbol found at position (${position.line + 1}:${position.character})`,
			suggestedPositions: suggested,
		};
	}

	if (actualName !== expectedName) {
		const suggested = await findNearestSymbols(uri, position, expectedName);
		return {
			valid: false,
			error: `Symbol mismatch: expected "${expectedName}", found "${actualName}"`,
			suggestedPositions: suggested,
		};
	}

	return { valid: true };
}

async function findNearestSymbols(
	uri: vscode.Uri,
	position: vscode.Position,
	symbolName: string,
	count?: number,
): Promise<SymbolPosition[]> {
	const maxCount = count ?? Config.getNearestSymbolsCount();
	const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
		"vscode.executeDocumentSymbolProvider",
		uri,
	);

	if (!symbols || symbols.length === 0) {
		return [];
	}

	const allSymbols: { name: string; line: number; character: number }[] = [];
	collectSymbols(symbols, allSymbols);

	return allSymbols
		.filter((s) => s.name === symbolName)
		.map((s) => ({
			line: s.line + 1,
			character: s.character,
			distance: calculateDistance(
				position,
				new vscode.Position(s.line, s.character),
			),
		}))
		.sort((a, b) => a.distance - b.distance)
		.slice(0, maxCount)
		.map((s) => ({ line: s.line, character: s.character }));
}

function collectSymbols(
	symbols: vscode.DocumentSymbol[],
	result: { name: string; line: number; character: number }[],
): void {
	for (const symbol of symbols) {
		result.push({
			name: symbol.name,
			line: symbol.selectionRange.start.line,
			character: symbol.selectionRange.start.character,
		});

		if (symbol.children.length > 0) {
			collectSymbols(symbol.children, result);
		}
	}
}

function calculateDistance(
	pos1: vscode.Position,
	pos2: vscode.Position,
): number {
	const lineDiff = Math.abs(pos1.line - pos2.line);
	const charDiff = Math.abs(pos1.character - pos2.character);
	return lineDiff * 1000 + charDiff;
}

export const SymbolValidator = {
	getSymbolAtPosition,
	validate,
	findNearestSymbols,
};
