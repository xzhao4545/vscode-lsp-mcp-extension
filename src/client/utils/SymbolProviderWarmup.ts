import * as path from "node:path";
import * as vscode from "vscode";

const DEFAULT_WARMUP_DELAY_MS = 150;
const DEFAULT_WARMUP_FILE_LIMIT = 5;
const DEFAULT_WARMUP_RETRIES = 4;
const DEFAULT_WORKSPACE_READY_TTL_MS = 30000;
const WARMUP_FILE_PATTERNS = [
	"**/*.ts",
	"**/*.tsx",
	"**/*.js",
	"**/*.jsx",
	"**/*.py",
	"**/*.java",
	"**/*.go",
	"**/*.rs",
] as const;
const workspaceSymbolReadyCache = new Map<string, number>();

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryUntilReady<T>(
	load: () => Promise<T>,
	isReady: (value: T) => boolean,
	retries: number = DEFAULT_WARMUP_RETRIES,
	delayMs: number = DEFAULT_WARMUP_DELAY_MS,
): Promise<T> {
	let lastValue = await load();

	for (let attempt = 0; attempt < retries && !isReady(lastValue); attempt++) {
		await sleep(delayMs * (attempt + 1));
		lastValue = await load();
	}

	return lastValue;
}

async function findWarmupFiles(basePath: string): Promise<vscode.Uri[]> {
	for (const pattern of WARMUP_FILE_PATTERNS) {
		const files = await vscode.workspace.findFiles(
			new vscode.RelativePattern(basePath, pattern),
			"**/node_modules/**",
			DEFAULT_WARMUP_FILE_LIMIT,
		);
		if (files.length > 0) {
			return files;
		}
	}

	return [];
}

async function collectWarmupUris(
	projectPath: string,
	paths?: string[],
): Promise<vscode.Uri[]> {
	const candidates = paths && paths.length > 0 ? paths : [projectPath];
	const uris: vscode.Uri[] = [];

	for (const candidate of candidates) {
		const resolvedPath = path.isAbsolute(candidate)
			? candidate
			: path.join(projectPath, candidate);
		const uri = vscode.Uri.file(resolvedPath);
		let stat: vscode.FileStat | null = null;

		try {
			stat = await vscode.workspace.fs.stat(uri);
		} catch {
			stat = null;
		}

		if (!stat) {
			continue;
		}

		if (stat.type & vscode.FileType.Directory) {
			uris.push(...(await findWarmupFiles(uri.fsPath)));
			continue;
		}

		uris.push(uri);
	}

	return uris.slice(0, DEFAULT_WARMUP_FILE_LIMIT);
}

function matchesProjectPath(projectPath: string, candidatePath: string): boolean {
	const relative = path.relative(path.resolve(projectPath), path.resolve(candidatePath));
	return (
		relative === "" ||
		(!relative.startsWith("..") && !path.isAbsolute(relative))
	);
}

async function loadWorkspaceSymbolsForProject(
	projectPath: string,
): Promise<vscode.SymbolInformation[]> {
	const symbols =
		(await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
			"vscode.executeWorkspaceSymbolProvider",
			"",
		)) || [];

	return symbols.filter((symbol) =>
		matchesProjectPath(projectPath, symbol.location.uri.fsPath),
	);
}

export async function getDocumentSymbolsWithWarmup(
	uri: vscode.Uri,
): Promise<vscode.DocumentSymbol[]> {
	await vscode.workspace.openTextDocument(uri);
	return retryUntilReady(
		async () =>
			(await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
				"vscode.executeDocumentSymbolProvider",
				uri,
			)) || [],
		(symbols) => symbols.length > 0,
	);
}

export async function warmWorkspaceSymbolProvider(
	projectPath: string,
	paths?: string[],
): Promise<void> {
	const uris = await collectWarmupUris(projectPath, paths);

	for (const uri of uris) {
		await getDocumentSymbolsWithWarmup(uri);
	}

	if (uris.length > 0) {
		await sleep(DEFAULT_WARMUP_DELAY_MS);
	}
}

export async function ensureWorkspaceSymbolProviderReady(
	projectPath: string,
	paths?: string[],
): Promise<boolean> {
	const normalizedProjectPath = path.resolve(projectPath);
	const lastReadyAt = workspaceSymbolReadyCache.get(normalizedProjectPath);
	if (
		lastReadyAt &&
		Date.now() - lastReadyAt < DEFAULT_WORKSPACE_READY_TTL_MS
	) {
		return true;
	}

	const currentSymbols = await loadWorkspaceSymbolsForProject(normalizedProjectPath);
	if (currentSymbols.length > 0) {
		workspaceSymbolReadyCache.set(normalizedProjectPath, Date.now());
		return true;
	}

	await warmWorkspaceSymbolProvider(normalizedProjectPath, paths);
	const warmedSymbols = await retryUntilReady(
		() => loadWorkspaceSymbolsForProject(normalizedProjectPath),
		(symbols) => symbols.length > 0,
		3,
		DEFAULT_WARMUP_DELAY_MS,
	);

	if (warmedSymbols.length > 0) {
		workspaceSymbolReadyCache.set(normalizedProjectPath, Date.now());
		return true;
	}

	return false;
}
