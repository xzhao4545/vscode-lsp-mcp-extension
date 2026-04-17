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

---

Add new tool to vscode-lsp-mcp-extension.

## Tool Pattern

1. **src/server/MCPTools.ts** - Add schema under `TOOL_SCHEMAS`
2. **src/client/tools/ToolNameTool.ts** - Create class extending `BaseTool`
3. **src/client/TaskExecutor.ts** - Import and register in `registerTools()`
4. Add any user-facing strings to l10n bundles

See `.claude/rules/claude-dev-patterns.md` for full details.