# 窗口侧实现细节

## ServerConnection 类

```typescript
class ServerConnection {
  private ws: WebSocket | null = null;
  private windowId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  constructor(
    private port: number,
    private onTask: (task: Task) => Promise<any>
  ) {}
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:${this.port}/ws`);
      
      this.ws.on('open', () => {
        this.register();
        resolve();
      });
      
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', () => this.handleClose());
      this.ws.on('error', reject);
    });
  }
  
  private register(): void {
    const folders = vscode.workspace.workspaceFolders?.map(f => ({
      name: f.name,
      path: f.uri.fsPath
    })) || [];
    
    this.send({ type: 'register', folders });
  }
  
  private async handleMessage(data: WebSocket.Data): Promise<void> {
    const msg = JSON.parse(data.toString());
    
    switch (msg.type) {
      case 'registered':
        this.windowId = msg.windowId;
        break;
        
      case 'task':
        await this.executeTask(msg);
        break;
    }
  }
  
  private async executeTask(msg: TaskMessage): Promise<void> {
    try {
      const result = await this.onTask(msg);
      this.send({ type: 'result', requestId: msg.requestId, data: result });
    } catch (error) {
      this.send({ 
        type: 'error', 
        requestId: msg.requestId, 
        error: { message: error.message } 
      });
    }
  }
  
  disconnect(): void {
    this.ws?.close();
  }
  
  private send(msg: any): void {
    this.ws?.send(JSON.stringify(msg));
  }
}
```


## TaskExecutor 任务执行器

TaskExecutor 通过 ToolRegistry 管理和调度工具执行。

```typescript
class TaskExecutor {
  private registry: ToolRegistry;

  constructor() {
    this.registry = new ToolRegistry();
    this.registerTools();
  }

  private registerTools(): void {
    this.registry.registerAll([
      new GoToDefinitionTool(),
      new FindReferencesTool(),
      new HoverTool(),
      // ... 其他工具
    ]);
  }

  async execute(task: TaskMessage): Promise<unknown> {
    const tool = this.registry.get(task.tool);
    if (!tool) throw new Error(`Unknown tool: ${task.tool}`);
    return tool.execute(task.args);
  }

  async executeWithFormat(task: TaskMessage): Promise<ToolResult> {
    const tool = this.registry.get(task.tool);
    if (!tool) throw new Error(`Unknown tool: ${task.tool}`);
    return tool.run(task.args);  // 返回 { data, formatted }
  }
}
```

## 工具基类 (BaseTool)

```typescript
abstract class BaseTool {
  abstract readonly name: string;
  abstract execute(args: Record<string, unknown>): Promise<unknown>;
  abstract format(result: unknown, args: Record<string, unknown>): string;

  async run(args: Record<string, unknown>): Promise<ToolResult> {
    const data = await this.execute(args);
    const formatted = this.format(data, args);
    return { data, formatted };
  }

  protected resolveUri(projectPath: string, filePath: string): vscode.Uri {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(projectPath, filePath);
    return vscode.Uri.file(fullPath);
  }

  protected emptyContent(message: string = 'No content available'): string {
    return `*${message}*`;
  }
}
```

## 工具实现示例

```typescript
class GoToDefinitionTool extends BaseTool {
  readonly name = 'goToDefinition';

  async execute(args: Record<string, unknown>): Promise<GoToDefinitionResult> {
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider', uri, position
    );
    if (!locations?.length) return { found: false };
    const loc = locations[0];
    return {
      found: true,
      uri: loc.uri.fsPath,
      line: loc.range.start.line + 1,
      character: loc.range.start.character
    };
  }

  format(result: GoToDefinitionResult): string {
    const sb = new StringBuilder();
    sb.appendLine('## Go To Definition');
    sb.appendLine();
    if (!result.found) {
      sb.appendLine(this.emptyContent('No definition found'));
    } else {
      sb.appendLine(`**File:** \`${result.uri}\``);
      sb.appendLine(`**Location:** Line ${result.line}, Column ${result.character}`);
    }
    return sb.toString();
  }
}
```

## 分页工具 (PaginationHelper)

包含 page 参数的工具使用 PaginationHelper 进行分页：

```typescript
class FindReferencesTool extends BaseTool {
  format(result: FindReferencesResult, args: Record<string, unknown>): string {
    if (result.references.length === 0) {
      return this.emptyContent('No references found');
    }
    const page = (args.page as number) || 1;
    const paginated = PaginationHelper.paginate(result.references, page);
    return PaginationHelper.wrapPaginated(
      'References',
      paginated.page, paginated.totalPages, paginated.totalItems, paginated.hasMore,
      (sb) => {
        for (const ref of paginated.items) {
          sb.appendLine(`- \`${ref.uri}\` : Line ${ref.line}`);
        }
      }
    );
  }
}
```

## 工具列表

| 工具类 | 功能 | 支持分页 |
|--------|------|----------|
| GoToDefinitionTool | 跳转到定义 | 否 |
| FindReferencesTool | 查找引用 | 是 |
| HoverTool | 悬停信息 | 否 |
| GetFileStructTool | 文件符号结构 | 否 |
| SearchSymbolInWorkspaceTool | 工作区符号搜索 | 是 |
| GoToImplementationTool | 查找实现 | 是 |
| IncomingCallsTool | 查找调用者 | 是 |
| RenameSymbolTool | 重命名 | 否 |
| GetDiagnosticsTool | 获取诊断信息 | 是 |
| GetDefinitionTextTool | 获取定义文本 | 否 |
| SyncFilesTool | 同步文件 | 否 |
| SearchFilesTool | 搜索文件 | 是 |
| GetScopeParentTool | 查找父级符号 | 否 |
