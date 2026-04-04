import * as vscode from "vscode";

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

	return results.map((item) => toLocation(item));
}

function toLocation(
	item: vscode.Location | vscode.LocationLink,
): vscode.Location {
	if (isLocationLink(item)) {
		return new vscode.Location(item.targetUri, item.targetRange);
	}
	return item;
}

function isLocationLink(
	item: vscode.Location | vscode.LocationLink,
): item is vscode.LocationLink {
	return "targetUri" in item;
}

export const LocationHelper = {
	normalize,
};
