const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const serverOnly = process.argv.includes('--server-only');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				if (location) {
					console.error(`    ${location.file}:${location.line}:${location.column}:`);
				}
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	// Extension build config
	const extensionConfig = {
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	};

	// Server build config
	const serverConfig = {
		entryPoints: ['src/server/main.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/server/main.js',
		external: [],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	};

	if (serverOnly) {
		// Only build server (for debugging)
		const ctx = await esbuild.context(serverConfig);
		if (watch) {
			await ctx.watch();
		} else {
			await ctx.rebuild();
			await ctx.dispose();
		}
	} else if (watch) {
		// Watch mode: build both
		const extCtx = await esbuild.context(extensionConfig);
		const srvCtx = await esbuild.context(serverConfig);
		await Promise.all([extCtx.watch(), srvCtx.watch()]);
	} else {
		// Production: build both
		const extCtx = await esbuild.context(extensionConfig);
		const srvCtx = await esbuild.context(serverConfig);
		await Promise.all([extCtx.rebuild(), srvCtx.rebuild()]);
		await Promise.all([extCtx.dispose(), srvCtx.dispose()]);
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
