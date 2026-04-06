import * as vscode from "vscode";

const MAX_DEFINITION_FOLLOW_DEPTH = 8;
const MAX_STATEMENT_SCAN_LINES = 20;

function normalize(
	results:
		| vscode.Location
		| vscode.Location[]
		| vscode.LocationLink[]
		| undefined
		| null,
): vscode.Location[] {
	if (!results) {
		return [];
	}

	if (!Array.isArray(results)) {
		return [results];
	}

	if (results.length === 0) {
		return [];
	}

	return dedupe(results.map((item) => toLocation(item)));
}

function toLocation(
	item: vscode.Location | vscode.LocationLink,
): vscode.Location {
	if (isLocationLink(item)) {
		return new vscode.Location(
			item.targetUri,
			item.targetSelectionRange ?? item.targetRange,
		);
	}
	return item;
}

function isLocationLink(
	item: vscode.Location | vscode.LocationLink,
): item is vscode.LocationLink {
	return "targetUri" in item;
}

function locationKey(location: vscode.Location): string {
	return [
		location.uri.toString(),
		location.range.start.line,
		location.range.start.character,
		location.range.end.line,
		location.range.end.character,
	].join(":");
}

function dedupe(locations: vscode.Location[]): vscode.Location[] {
	const seen = new Set<string>();
	return locations.filter((location) => {
		const key = locationKey(location);
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

function isSameLocation(
	left: vscode.Location,
	right: vscode.Location,
): boolean {
	return locationKey(left) === locationKey(right);
}

async function resolveDefinitionLocations(
	uri: vscode.Uri,
	position: vscode.Position,
	symbolName?: string,
): Promise<vscode.Location[]> {
	let current = normalize(
		await vscode.commands.executeCommand<
			vscode.Location | vscode.Location[] | vscode.LocationLink[]
		>("vscode.executeDefinitionProvider", uri, position),
	);

	const visited = new Set(current.map((location) => locationKey(location)));

	for (let depth = 0; depth < MAX_DEFINITION_FOLLOW_DEPTH; depth++) {
		let followed = false;
		const next: vscode.Location[] = [];

		for (const location of current) {
			const followPosition = await getTransitiveFollowPosition(
				location,
				symbolName,
			);
			if (!followPosition) {
				next.push(location);
				continue;
			}

			const nested = normalize(
				await vscode.commands.executeCommand<
					vscode.Location | vscode.Location[] | vscode.LocationLink[]
				>("vscode.executeDefinitionProvider", location.uri, followPosition),
			).filter((candidate) => !isSameLocation(candidate, location));

			const unseen = nested.filter((candidate) => {
				const key = locationKey(candidate);
				if (visited.has(key)) {
					return false;
				}
				visited.add(key);
				return true;
			});

			if (unseen.length === 0) {
				next.push(location);
				continue;
			}

			next.push(...unseen);
			followed = true;
		}

		current = dedupe(next);
		if (!followed) {
			break;
		}
	}

	return current;
}

async function getTransitiveFollowPosition(
	location: vscode.Location,
	symbolName?: string,
): Promise<vscode.Position | null> {
	const doc = await vscode.workspace.openTextDocument(location.uri);
	const statement = findImportOrReExportStatement(doc, location.range.start.line);
	if (!statement) {
		return null;
	}

	return (
		findSymbolPositionInStatement(
			doc,
			statement.startLine,
			statement.endLine,
			symbolName,
		) ?? location.range.start
	);
}

function findImportOrReExportStatement(
	doc: vscode.TextDocument,
	targetLine: number,
): { startLine: number; endLine: number } | null {
	const minLine = Math.max(0, targetLine - MAX_STATEMENT_SCAN_LINES);
	let startLine = -1;

	for (let line = targetLine; line >= minLine; line--) {
		const text = doc.lineAt(line).text;
		if (isImportStatementStart(text) || isReExportStatementStart(text)) {
			startLine = line;
			break;
		}
		if (line < targetLine && text.includes(";")) {
			break;
		}
	}

	if (startLine < 0) {
		return null;
	}

	const maxLine = Math.min(doc.lineCount - 1, startLine + MAX_STATEMENT_SCAN_LINES);
	let endLine = startLine;
	for (; endLine <= maxLine; endLine++) {
		if (doc.lineAt(endLine).text.includes(";")) {
			break;
		}
	}

	if (targetLine < startLine || targetLine > endLine) {
		return null;
	}

	return { startLine, endLine };
}

function isImportStatementStart(text: string): boolean {
	return /^\s*import\b/.test(text);
}

function isReExportStatementStart(text: string): boolean {
	return /^\s*export\s+(type\s+)?[{*]/.test(text);
}

function findSymbolPositionInStatement(
	doc: vscode.TextDocument,
	startLine: number,
	endLine: number,
	symbolName?: string,
): vscode.Position | null {
	if (!symbolName) {
		return null;
	}

	for (let line = startLine; line <= endLine; line++) {
		const index = doc.lineAt(line).text.indexOf(symbolName);
		if (index >= 0) {
			return new vscode.Position(line, index);
		}
	}

	return null;
}

export const LocationHelper = {
	dedupe,
	isSameLocation,
	normalize,
	resolveDefinitionLocations,
};
