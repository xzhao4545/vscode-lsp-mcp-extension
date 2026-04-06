import { workspace } from "vscode";
import {
	DEFAULT_CONTEXT_LINES,
	DEFAULT_DIAGNOSTICS_TIMEOUT,
	DEFAULT_MAX_STRUCT_LINES,
	DEFAULT_NEAREST_SYMBOLS_COUNT,
	DEFAULT_PAGE_SIZE,
	DEFAULT_PORT,
} from "../shared/constants";

class Config {
	private vsConfig = workspace.getConfiguration("ide-lsp-mcp");

	getPort(): number {
		return this.vsConfig.get<number>("port", DEFAULT_PORT);
	}

	getPageSize(): number {
		return this.vsConfig.get<number>("pageSize", DEFAULT_PAGE_SIZE);
	}

	getAutoStart(): boolean {
		return this.vsConfig.get<boolean>("autoStart", true);
	}

	getEnableDebug(): boolean {
		return this.vsConfig.get<boolean>("enableDebug", false);
	}

	getContextLines(): number {
		return this.vsConfig.get<number>("contextLines", DEFAULT_CONTEXT_LINES);
	}

	getEnableCors(): boolean {
		return this.vsConfig.get<boolean>("enableCors", false);
	}

	getDiagnosticsTimeout(): number {
		return this.vsConfig.get<number>(
			"diagnosticsTimeout",
			DEFAULT_DIAGNOSTICS_TIMEOUT,
		);
	}

	getNearestSymbolsCount(): number {
		return this.vsConfig.get<number>(
			"nearestSymbolsCount",
			DEFAULT_NEAREST_SYMBOLS_COUNT,
		);
	}

	getMaxStructLines(): number {
		return this.vsConfig.get<number>(
			"maxStructLines",
			DEFAULT_MAX_STRUCT_LINES,
		);
	}

	getConfiguration() {
		return this.vsConfig;
	}
}

export default new Config();
