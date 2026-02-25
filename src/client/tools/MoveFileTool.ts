import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import { StringBuilder } from './StringBuilder';

interface MoveFileResult {
  success: boolean;
  newPath: string;
}

/**
 * MoveFile - 移动文件
 */
export class MoveFileTool extends BaseTool {
  readonly name = 'moveFile';

  async execute(args: Record<string, unknown>): Promise<MoveFileResult> {
    const projectPath = args.projectPath as string;
    const sourcePath = args.sourcePath as string;
    const targetDir = args.targetDir as string;
    const sourceUri = this.resolveUri(projectPath, sourcePath);
    const targetUri = this.resolveUri(projectPath, path.join(targetDir, path.basename(sourcePath)));
    await vscode.workspace.fs.rename(sourceUri, targetUri);
    return { success: true, newPath: targetUri.fsPath };
  }

  format(result: MoveFileResult): string {
    const sb = new StringBuilder();
    sb.appendLine('## Move File');
    sb.appendLine();
    if (result.success) {
      sb.appendLine(`✓ File moved to: \`${result.newPath}\``);
    } else {
      sb.appendLine('✗ Failed to move file');
    }
    return sb.toString();
  }
}
