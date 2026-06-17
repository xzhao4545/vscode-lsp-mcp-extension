# Testing Strategy - VSCode LSP MCP Extension

This document defines the testing patterns and requirements for the vscode-lsp-mcp-extension.

## Test Architecture

```
src/test/
├── extension.test.ts          # VSCode integration tests (vscode-test)
├── mcp.test.ts                # MCP tool integration tests
├── McpTestClient.ts           # MCP client for integration testing
├── sourceMapLoc.ts            # Source map utilities
└── testData/
    └── mcp/
        ├── expected/          # Expected results by tool
        │   └── {toolName}/
        │       └── {testCase}.md
        └── {toolName}.json    # Test input data
```

## Test Types

### 1. Unit Tests
- **Location**: Near source files (`*.test.ts` alongside `*.ts`)
- **Framework**: Mocha + Chai
- **Run**: `pnpm test-mcp` (mocha directly)
- **Use for**: Pure functions, utilities, schema validation

### 2. Integration Tests (MCP Tools)
- **Location**: `src/test/mcp.test.ts`
- **Framework**: Mocha + custom `McpTestClient`
- **Run**: `pnpm test-mcp` (requires MCP server running)
- **Use for**: Testing MCP tool end-to-end behavior

### 3. VSCode Extension Tests
- **Location**: `src/test/extension.test.ts`
- **Framework**: `@vscode/test-electron`
- **Run**: `pnpm test` (opens VSCode window)
- **Use for**: Testing VSCode-specific APIs, commands, UI

## Test Commands

```bash
# Type check only
pnpm run check-types

# Lint
pnpm run lint

# Compile (type check + lint + build)
pnpm run compile

# Run MCP integration tests only
pnpm test-mcp

# Run VSCode extension tests
pnpm test

# Full test suite (compile + test)
pnpm run pretest
```

## Adding Tests for a New Tool

### Step 1: Add Test Data

Create `src/test/testData/mcp/{toolName}.json`:

```json
[
  {
    "name": "test case name",
    "args": {
      "projectPath": "${projectPath}",
      "filePath": "src/client/tools/MyTool.ts",
      "line": 1,
      "character": 0
    },
    "expectedFile": "testCaseName.md"
  }
]
```

### Step 2: Add Expected Results

Create `src/test/testData/mcp/expected/{toolName}/{testCaseName}.md`:
```
Expected output content here
```

### Step 3: Register the Test

Add to `src/test/mcp.test.ts` in the test suite:

```typescript
test("{toolName}", () => runToolTest(client, "{toolName}"));
```

### Step 4: Run the Test

```bash
# Set the test project path
export TEST_PROJECT_PATH="/path/to/test/project"

# Run MCP tests
pnpm test-mcp
```

## McpTestClient Usage

The `McpTestClient` connects to the running MCP server and calls tools:

```typescript
import { McpTestClient } from "./McpTestClient";

const client = new McpTestClient();
await client.connect();

const result = await client.callTool("toolName", {
  projectPath: "/path/to/project",
  filePath: "src/file.ts",
  line: 1,
  character: 0
});

await client.disconnect();
```

### McpTestClient Methods

| Method | Description |
|--------|-------------|
| `connect()` | Connect to MCP server (waits for server ready) |
| `disconnect()` | Close connection |
| `callTool(name, args)` | Call MCP tool, returns `{ content, isError }` |
| `isServerRunning()` | Check if server is accessible |

### Tool Name Convention

Tools are prefixed with `IDE-` when calling via MCP:
- `listOpenProjects` → `IDE-listOpenProjects`
- `goToDefinition` → `IDE-goToDefinition`

The `McpTestClient.callTool()` handles this automatically.

## Test Data Placeholders

Use `${projectPath}` in test data for paths that should be replaced at runtime:

```json
{
  "args": {
    "projectPath": "${projectPath}",
    "filePath": "${projectPath}/src/main.ts"
  }
}
```

Set via environment variable:
```bash
export TEST_PROJECT_PATH="/path/to/your/project"
```

## Pre-commit Testing

Before committing:

1. **Run type check**: `pnpm run check-types`
2. **Run lint**: `pnpm run lint`
3. **Run tests** (if affected):
   ```bash
   pnpm test-mcp  # If modifying tools
   pnpm test      # If modifying extension
   ```

## Test Checklist for New Tools

- [ ] Add test data JSON in `src/test/testData/mcp/{toolName}.json`
- [ ] Add expected result MD files in `src/test/testData/mcp/expected/{toolName}/`
- [ ] Register test in `src/test/mcp.test.ts`
- [ ] Verify `pnpm test-mcp` passes
- [ ] For VSCode-specific behavior, add test to `extension.test.ts`

## Testing i18n

All user-facing strings in tests should use `l10n.t()`:

```typescript
assert.equal(
  result.content,
  l10n.t("Expected message"),
  "Message should be localized"
);
```

## Continuous Integration

The `pretest` script runs before `pnpm test`:

```bash
pnpm run check-types  # TypeScript compilation
pnpm run lint         # ESLint
pnpm run compile      # Build
```

If any fail, tests will not run.

## Troubleshooting

### Server not starting
- Ensure MCP server is running: `pnpm run server:dev`
- Check port 53221 is accessible: `curl http://127.0.0.1:53221/health`

### Test timeout
- Default mocha timeout is 5000ms (configured in package.json)
- MCP tests use 60000ms (60s) timeout
- Increase via `this.timeout(ms)` in test suite

### Expected results mismatch
- Run test to regenerate: expected files are created on first run if missing
- Review diff and update expected files if output changes are correct
