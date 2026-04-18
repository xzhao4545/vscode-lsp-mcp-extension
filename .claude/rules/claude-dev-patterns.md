# Claude Dev Patterns - VSCode Extension

This document details patterns for developing the vscode-lsp-mcp-extension.

## 1. Adding a New Command

### package.json

Add command definition under `contributes.commands`:

```json
{
  "command": "ide-lsp-mcp.<commandName>",
  "title": "%command.<commandName>%",
  "icon": "$(icon-name)"
}
```

### package.nls.json / package.nls.zh-cn.json

Add translations:
```json
"command.<commandName%": "Display Text"
```

### extension.ts - Register the command

In the `registerCommands` call, the commands are already registered in `src/client/commands/index.ts`. To add a new command:

1. Open `src/client/commands/index.ts`
2. Add a new `vscode.commands.registerCommand` entry:

```typescript
// EN: Command description // CN: 命令描述
context.subscriptions.push(
  vscode.commands.registerCommand("ide-lsp-mcp.<commandName>", async (args) => {
    // EN: Implementation // CN: 实现
  }),
);
```

### Localize user-facing strings

Use `l10n.t()` for any user-facing text in commands:

```typescript
vscode.window.showInformationMessage(l10n.t("Message text"));
vscode.window.showErrorMessage(l10n.t("Error: {0}", errorMessage));
```

### i18n Checklist

- [ ] Add command to `package.json` contributes
- [ ] Add title key to `package.nls.json` (English)
- [ ] Add title key to `package.nls.zh-cn.json` (Chinese)
- [ ] Use `l10n.t()` for any user-facing strings
- [ ] Add keys to `l10n/bundle.l10n.json` and `l10n/bundle.l10n.zh-cn.json` if needed

---

## 2. Adding a New Tool

### Step 1: Define in `src/server/MCPTools.ts`

Add tool schema under `TOOL_SCHEMAS`:

```typescript
toolName: {
  description: "Tool description for MCP protocol",
  inputSchema: z.object({
    projectPath: z.string().describe("Project root path (absolute)"),
    filePath: z.string().describe("File path (absolute or relative to project)"),
    line: z.number().describe("Line number (1-based)"),
    character: z.number().describe("Column offset (0-based)"),
    // ... other args
  }),
},
```

### Step 2: Create tool class in `src/client/tools/`

Create `ToolNameTool.ts` extending `BaseTool`:

```typescript
import * as vscode from "vscode";
import { BaseTool } from "./BaseTool";
import { StringBuilder } from "../utils/StringBuilder";

interface ToolResult {
  found: boolean;
  data: any;
  // ...
}

/**
 * ToolNameTool - Tool description
 * // CN: 工具描述
 */
export class ToolNameTool extends BaseTool {
  readonly name = "toolName";

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    // EN: Implementation // CN: 实现
    const uri = this.resolveUri(args.projectPath as string, args.filePath as string);
    const position = new vscode.Position((args.line as number) - 1, args.character as number);
    // ... tool logic
    return { found: true, data: result };
  }

  format(result: ToolResult, _args: Record<string, unknown>): string {
    if (!result.found) {
      return this.emptyContent("No content available");
    }
    const sb = new StringBuilder();
    // EN: Format output // CN: 格式化输出
    return sb.toString();
  }
}
```

### Step 3: Register in `src/client/TaskExecutor.ts`

Import and register the tool:

```typescript
import { ToolNameTool } from "./tools/ToolNameTool";

private registerTools(): void {
  this.registry.registerAll([
    // ... existing tools
    new ToolNameTool(),
  ]);
}
```

### Step 4: i18n for user-facing strings

Add any user-facing strings to `l10n/bundle.l10n.json` and `l10n/bundle.l10n.zh-cn.json`.

### Tool Pattern Checklist

- [ ] Add schema to `src/server/MCPTools.ts`
- [ ] Create tool class in `src/client/tools/ToolNameTool.ts`
- [ ] Extend `BaseTool`, implement `name`, `execute()`, `format()`
- [ ] Register in `src/client/TaskExecutor.ts`
- [ ] Add `l10n.t()` strings to l10n bundles if any user-facing text

---

## 3. Modifying Protocol Communications (JSON-RPC IPC)

The extension uses `vscode-jsonrpc` for IPC over Named Pipes (Domain Sockets) between the VSCode extension clients and the standalone Node server. We strictly DO NOT use WebSockets or raw JSON passing.

### Step 1: Define Protocol Types in `src/shared/protocol.ts`

Always use `RequestType` for calls expecting a response and `NotificationType` for fire-and-forget events.

```typescript
import { RequestType, NotificationType } from "vscode-jsonrpc/node";

/** Task execution request */
export const taskRequest = new RequestType<{ tool: string, args: Record<string, unknown> }, unknown, Error>("task");

/** Progress update notification */
export const progressNotification = new NotificationType<{ progress: number, message?: string }>("progress");
```

### Step 2: Implement Request/Notification Handlers

**Client-side (`src/client/ServerConnection.ts`):**

To send a notification to the server:
```typescript
this.connection.sendNotification(progressNotification, { progress: 50 });
```

To handle a request from the server, with cancellation support:
```typescript
this.connection.onRequest(taskRequest, async (params, token) => {
  // `token` is a CancellationToken. Pass it down to your tool executions!
  return await this.executeTask(params, token);
});
```

**Server-side (`src/server/TaskManager.ts` or `src/server/IpcServer.ts`):**

To send a request to a connected extension host window (and `await` the response):
```typescript
try {
  const result = await connection.sendRequest(taskRequest, { tool, args }, mcpCancellationToken);
  return result;
} catch (error) {
  // Error handling is handled natively by jsonrpc
  throw error;
}
```

### Step 3: Cancellation Tokens (Guardrail)

* **NEVER** ignore the `CancellationToken` provided by JSON-RPC.
* When executing tasks, pass the token down to the tools.
* Check `token.isCancellationRequested` during long-running loops or pass it to standard VSCode APIs.

### Protocol Pattern Checklist

- [ ] Define `RequestType` or `NotificationType` in `src/shared/protocol.ts`
- [ ] Connect handlers using `.onRequest()` or `.onNotification()`
- [ ] Pass the `CancellationToken` consistently from request handlers through execution logic.
- [ ] Never use manual `requestId` tracking or `Math.random` generated IDs. Let JSON-RPC handle it.

---

## File Locations

| Purpose | File |
|---------|------|
| Command definitions | `package.json` → `contributes.commands` |
| Command titles | `package.nls.json`, `package.nls.zh-cn.json` |
| Command registration | `src/client/commands/index.ts` |
| Tool schemas | `src/server/MCPTools.ts` |
| Tool classes | `src/client/tools/*.ts` |
| Tool registration | `src/client/TaskExecutor.ts` |
| Runtime messages | `l10n/bundle.l10n.json`, `l10n/bundle.l10n.zh-cn.json` |
| Protocol messages | `src/shared/protocol.ts` |