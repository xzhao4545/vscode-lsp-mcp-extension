import * as vscode from 'vscode';
import * as path from 'path';
import { BaseTool } from './BaseTool';
import { StringBuilder } from './StringBuilder';
import { PaginationHelper } from './PaginationHelper';

interface SearchFilesResult {
  files: string[];
  hasMore: boolean;
  total: number;
}

/**
 * SearchFiles - 搜索文件
 */
export class SearchFilesTool extends BaseTool {
  readonly name = 'searchFiles';

  async execute(args: Record<string, unknown>): Promise<SearchFilesResult> {
    const projectPath = args.projectPath as string;
    const pattern = args.pattern as string;
    const directory = args.directory as string | undefined;
    const searchPath = directory ? path.join(projectPath, directory) : projectPath;
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(searchPath, '**/*'),
      '**/node_modules/**'
    );
    const regex = new RegExp(pattern, 'i');
    const matched = files.filter(f => regex.test(path.basename(f.fsPath)));
    return { files: matched.map(f => f.fsPath), hasMore: false, total: matched.length };
  }

  format(result: SearchFilesResult, args: Record<string, unknown>): string {
    if (result.files.length === 0) {
      return this.emptyContent('No files found');
    }

    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.files, page);

    return PaginationHelper.wrapPaginated(
      'Search Files',
      paginated.page,
      paginated.totalPages,
      paginated.totalItems,
      paginated.hasMore,
      (sb: StringBuilder) => {
        for (const file of paginated.items) {
          sb.appendLine(`- \`${file}\``);
        }
      }
    );
  }
}
