# Skill: claude-dev-patterns

Add new command to vscode-lsp-mcp-extension.

## Command Pattern

1. **package.json** - Add under `contributes.commands`:
```json
{
  "command": "ide-lsp-mcp.<name>",
  "title": "%command.<name>%"
}
```

2. **package.nls.json** / **package.nls.zh-cn.json** - Add title translations

3. **src/client/commands/index.ts** - Register:
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand("ide-lsp-mcp.<name>", async (args) => {
    // Use l10n.t() for user-facing strings
  }),
);
```

Add new tool to vscode-lsp-mcp-extension.

## Tool Pattern

1. **src/server/MCPTools.ts** - Add schema under `TOOL_SCHEMAS`
2. **src/client/tools/ToolNameTool.ts** - Create class extending `BaseTool`
3. **src/client/TaskExecutor.ts** - Import and register in `registerTools()`
4. Add any user-facing strings to l10n bundles

---

Add new protocol message to vscode-lsp-mcp-extension.

## Protocol Pattern

1. **src/shared/protocol.ts** - Define interface, add to `ClientMessage` or `ServerMessage` union
2. **src/server/McpServer.ts** - Add case in `handleMessage()` switch
3. **src/client/ServerConnection.ts** - Add case in `handleMessage()` switch

---

Add tests for a new tool in vscode-lsp-mcp-extension.

## Testing Pattern

1. **src/test/testData/mcp/{toolName}.json** - Add test input data
2. **src/test/testData/mcp/expected/{toolName}/** - Add expected result MD files
3. **src/test/mcp.test.ts** - Register: `test("{toolName}", () => runToolTest(client, "{toolName}"))`
4. Run: `export TEST_PROJECT_PATH="/path"` && `pnpm test-mcp`

See `.claude/rules/testing-strategy.md` for full details.