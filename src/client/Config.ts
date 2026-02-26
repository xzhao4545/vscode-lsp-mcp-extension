import { workspace } from 'vscode';
import {
  DEFAULT_CONTEXT_LINES,
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

  getConfiguration() {
    return this.vsConfig;
  }
}

export default new Config();
