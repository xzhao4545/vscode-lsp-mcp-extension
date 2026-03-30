import { workspace } from 'vscode';
import {
  DEFAULT_CONTEXT_LINES,
  DEFAULT_DIAGNOSTICS_TIMEOUT,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PORT,
  DEFAULT_TIMEOUT
} from '../shared/constants';

class Config {
  private vsConfig = workspace.getConfiguration('ide-lsp-mcp');

  getPort(): number {
    return this.vsConfig.get<number>('port', DEFAULT_PORT);
  }

  getPageSize(): number {
    return this.vsConfig.get<number>('pageSize', DEFAULT_PAGE_SIZE);
  }

  getAutoStart(): boolean {
    return this.vsConfig.get<boolean>('autoStart', true);
  }

  getEnableDebug(): boolean {
    return this.vsConfig.get<boolean>('enableDebug', false);
  }

  getContextLines(): number {
    return this.vsConfig.get<number>('contextLines', DEFAULT_CONTEXT_LINES);
  }

  getAllowMoveFile(): boolean {
    return this.vsConfig.get<boolean>('allowMoveFile', false);
  }

  getAllowDeleteFile(): boolean {
    return this.vsConfig.get<boolean>('allowDeleteFile', false);
  }

  getEnableCors(): boolean {
    return this.vsConfig.get<boolean>('enableCors', false);
  }

  getDiagnosticsTimeout(): number {
    return this.vsConfig.get<number>('diagnosticsTimeout', DEFAULT_DIAGNOSTICS_TIMEOUT);
  }

  getConfiguration() {
    return this.vsConfig;
  }
}

export default new Config();
