/**
 * 任务执行器 - 执行 VSCode LSP 命令
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { TaskMessage } from '../shared/protocol';

export class TaskExecutor {
  /**
   * 执行任务
   */
  async execute(task: TaskMessage): Promise<unknown> {
    const { tool, args } = task;

    switch (tool) {
      case 'goToDefinition':
        return this.goToDefinition(args);
      case 'findReferences':
        return this.findReferences(args);
      case 'hover':
        return this.hover(args);
      case 'getFileStruct':
        return this.getFileStruct(args);
      case 'searchSymbolInWorkspace':
        return this.searchSymbolInWorkspace(args);
      case 'goToImplementation':
        return this.goToImplementation(args);
      case 'incomingCalls':
        return this.incomingCalls(args);
      case 'renameSymbol':
        return this.renameSymbol(args);
      case 'getDiagnostics':
        return this.getDiagnostics(args);
      case 'getDefinitionText':
        return this.getDefinitionText(args);
      case 'syncFiles':
        return this.syncFiles(args);
      case 'searchFiles':
        return this.searchFiles(args);
      case 'moveFile':
        return this.moveFile(args);
      case 'deleteFile':
        return this.deleteFile(args);
      case 'getScopeParent':
        return this.getScopeParent(args);
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  }
  /**
   * 解析 URI
   */
  private resolveUri(projectPath: string, filePath: string): vscode.Uri {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(projectPath, filePath);
    return vscode.Uri.file(fullPath);
  }
  /**
   * goToDefinition - 跳转到定义
   */
  private async goToDefinition(args: Record<string, unknown>): Promise<unknown> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      uri,
      position
    );
    if (!locations || locations.length === 0) {
      return { found: false };
    }
    const loc = locations[0];
    return {
      found: true,
      uri: loc.uri.fsPath,
      line: loc.range.start.line + 1,
      character: loc.range.start.character
    };
  }
  /**
   * findReferences - 查找引用
   */
  private async findReferences(args: Record<string, unknown>): Promise<unknown> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      uri,
      position
    );
    const references = (locations || []).map(loc => ({
      uri: loc.uri.fsPath,
      line: loc.range.start.line + 1,
      character: loc.range.start.character
    }));
    return { references, hasMore: false, total: references.length };
  }
  /**
   * hover - 悬停信息
   */
  private async hover(args: Record<string, unknown>): Promise<unknown> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      uri,
      position
    );
    if (!hovers || hovers.length === 0) {
      return { contents: '' };
    }
    const contents = hovers[0].contents.map(c => {
      if (typeof c === 'string') {
        return c;
      }
      return (c as vscode.MarkdownString).value;
    }).join('\n');
    return { contents };
  }
  /**
   * getFileStruct - 文件符号结构
   */
  private async getFileStruct(args: Record<string, unknown>): Promise<unknown> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri
    );
    const mapSymbol = (s: vscode.DocumentSymbol): unknown => ({
      name: s.name,
      kind: vscode.SymbolKind[s.kind],
      range: {
        start: { line: s.range.start.line + 1, character: s.range.start.character },
        end: { line: s.range.end.line + 1, character: s.range.end.character }
      },
      children: s.children?.map(mapSymbol)
    });
    return { symbols: (symbols || []).map(mapSymbol) };
  }
  /**
   * searchSymbolInWorkspace - 工作区符号搜索
   */
  private async searchSymbolInWorkspace(args: Record<string, unknown>): Promise<unknown> {
    const query = args.query as string;
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
      'vscode.executeWorkspaceSymbolProvider',
      query
    );
    const result = (symbols || []).map(s => ({
      name: s.name,
      kind: vscode.SymbolKind[s.kind],
      uri: s.location.uri.fsPath,
      line: s.location.range.start.line + 1
    }));
    return { symbols: result, hasMore: false, total: result.length };
  }
  /**
   * goToImplementation - 查找实现
   */
  private async goToImplementation(args: Record<string, unknown>): Promise<unknown> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeImplementationProvider',
      uri,
      position
    );
    const implementations = (locations || []).map(loc => ({
      uri: loc.uri.fsPath,
      line: loc.range.start.line + 1,
      character: loc.range.start.character
    }));
    return { implementations, hasMore: false, total: implementations.length };
  }
  /**
   * incomingCalls - 查找调用者
   */
  private async incomingCalls(args: Record<string, unknown>): Promise<unknown> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, 0);
    const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      'vscode.prepareCallHierarchy',
      uri,
      position
    );
    if (!items || items.length === 0) {
      return { incomingCalls: [], hasMore: false, total: 0 };
    }
    const calls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
      'vscode.provideIncomingCalls',
      items[0]
    );
    const result = (calls || []).map(c => ({
      uri: c.from.uri.fsPath,
      line: c.from.range.start.line + 1,
      character: c.from.range.start.character,
      name: c.from.name
    }));
    return { incomingCalls: result, hasMore: false, total: result.length };
  }
  /**
   * renameSymbol - 重命名
   */
  private async renameSymbol(args: Record<string, unknown>): Promise<unknown> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const newName = args.newName as string;
    const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
      'vscode.executeDocumentRenameProvider',
      uri,
      position,
      newName
    );
    if (!edit) {
      return { changes: {} };
    }
    const changes: Record<string, Array<{ range: unknown; newText: string }>> = {};
    for (const [fileUri, edits] of edit.entries()) {
      changes[fileUri.fsPath] = edits.map(e => ({
        range: {
          start: { line: e.range.start.line + 1, character: e.range.start.character },
          end: { line: e.range.end.line + 1, character: e.range.end.character }
        },
        newText: e.newText
      }));
    }
    return { changes };
  }
  /**
   * getDiagnostics - 获取诊断信息
   */
  private async getDiagnostics(args: Record<string, unknown>): Promise<unknown> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const diagnostics = vscode.languages.getDiagnostics(uri);
    const result = diagnostics.map(d => ({
      message: d.message,
      severity: vscode.DiagnosticSeverity[d.severity],
      line: d.range.start.line + 1,
      character: d.range.start.character
    }));
    return { diagnostics: result, hasMore: false, total: result.length };
  }
  /**
   * getDefinitionText - 获取定义文本
   */
  private async getDefinitionText(args: Record<string, unknown>): Promise<unknown> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      uri,
      position
    );
    if (!locations || locations.length === 0) {
      return { definition: [] };
    }
    const definitions = await Promise.all(locations.map(async loc => {
      const doc = await vscode.workspace.openTextDocument(loc.uri);
      const text = doc.getText(loc.range);
      return {
        uri: loc.uri.fsPath,
        line: loc.range.start.line + 1,
        text,
        kind: 'definition'
      };
    }));
    return { definition: definitions };
  }
  /**
   * syncFiles - 同步文件
   */
  private async syncFiles(args: Record<string, unknown>): Promise<unknown> {
    // 刷新文件系统缓存
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
  /**
   * searchFiles - 搜索文件
   */
  private async searchFiles(args: Record<string, unknown>): Promise<unknown> {
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
  /**
   * moveFile - 移动文件
   */
  private async moveFile(args: Record<string, unknown>): Promise<unknown> {
    const projectPath = args.projectPath as string;
    const sourcePath = args.sourcePath as string;
    const targetDir = args.targetDir as string;
    const sourceUri = this.resolveUri(projectPath, sourcePath);
    const targetUri = this.resolveUri(projectPath, path.join(targetDir, path.basename(sourcePath)));
    await vscode.workspace.fs.rename(sourceUri, targetUri);
    return { success: true, newPath: targetUri.fsPath };
  }
  /**
   * deleteFile - 删除文件
   */
  private async deleteFile(args: Record<string, unknown>): Promise<unknown> {
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
  /**
   * getScopeParent - 查找父级符号
   */
  private async getScopeParent(args: Record<string, unknown>): Promise<unknown> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const line = (args.line as number) - 1;
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri
    );
    if (!symbols || symbols.length === 0) {
      return { found: false };
    }
    const findParent = (syms: vscode.DocumentSymbol[], targetLine: number): vscode.DocumentSymbol | null => {
      for (const s of syms) {
        if (s.range.start.line <= targetLine && s.range.end.line >= targetLine) {
          const child = findParent(s.children || [], targetLine);
          return child || s;
        }
      }
      return null;
    };
    const parent = findParent(symbols, line);
    if (!parent) {
      return { found: false };
    }
    return {
      found: true,
      name: parent.name,
      kind: vscode.SymbolKind[parent.kind],
      uri: uri.fsPath,
      line: parent.range.start.line + 1
    };
  }
}
