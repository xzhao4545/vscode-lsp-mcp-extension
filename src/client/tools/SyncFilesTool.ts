import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from './StringBuilder';

interface SyncFilesResult {
  success: boolean;
  message: string;
}

/**
 * SyncFiles - 同步文件
 */
export class SyncFilesTool extends BaseTool {
  readonly name = 'syncFiles';

  async execute(args: Record<string, unknown>): Promise<SyncFilesResult> {
    const projectPath = args.projectPath as string;
    const paths = args.paths as string[] | undefined;
    if (paths && paths.length > 0) {
      for (const p of paths) {
        const uri = this.resolveUri(projectPath, p);
        await vscode.workspace.fs.stat(uri);
      }
    }
    return { success: true, message: 'Files synced' };
  }

  format(result: SyncFilesResult): string {
    const sb = new StringBuilder();
    sb.appendLine('## Sync Files');
    sb.appendLine();
    if (result.success) {
      sb.appendLine(`✓ ${result.message}`);
    } else {
      sb.appendLine(`✗ ${result.message}`);
    }
    return sb.toString();
  }
}
