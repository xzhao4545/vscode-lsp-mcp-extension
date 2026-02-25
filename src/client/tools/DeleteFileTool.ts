import * as vscode from 'vscode';
import { BaseTool } from './BaseTool';
import { StringBuilder } from './StringBuilder';

interface DeleteFileReference {
  uri: string;
  line: number;
}

interface DeleteFileResult {
  success: boolean;
  message?: string;
  references?: DeleteFileReference[];
}

/**
 * DeleteFile - 删除文件
 */
export class DeleteFileTool extends BaseTool {
  readonly name = 'deleteFile';

  async execute(args: Record<string, unknown>): Promise<DeleteFileResult> {
    const projectPath = args.projectPath as string;
    const filePath = args.filePath as string;
    const uri = this.resolveUri(projectPath, filePath);
    
    // 检查引用
    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      uri,
      new vscode.Position(0, 0)
    );
    
    if (refs && refs.length > 0 && !args.force) {
      return {
        success: false,
        message: 'File has references',
        references: refs.map(r => ({ uri: r.uri.fsPath, line: r.range.start.line + 1 }))
      };
    }
    
    await vscode.workspace.fs.delete(uri);
    return { success: true };
  }

  format(result: DeleteFileResult): string {
    const sb = new StringBuilder();
    sb.appendLine('## Delete File');
    sb.appendLine();
    
    if (result.success) {
      sb.appendLine('✓ File deleted successfully');
    } else {
      sb.appendLine(`✗ ${result.message || 'Failed to delete file'}`);
      if (result.references && result.references.length > 0) {
        sb.appendLine();
        sb.appendLine('**References found:**');
        for (const ref of result.references) {
          sb.appendLine(`- \`${ref.uri}\`:${ref.line}`);
        }
      }
    }
    return sb.toString();
  }
}
