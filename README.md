# IDE-LSP for MCP

A VSCode extension that exposes IDE code intelligence capabilities through the MCP (Model Context Protocol).

As long as VSCode supports parsing a certain language, this extension can provide LSP services for that language to AI models.

> **中文**: [中文版本](./readme/README.zh-CN.md)

## Features

- 17 MCP tools covering navigation, search, diagnostics, and safe refactoring workflows
- Standalone MCP server architecture that works across multiple VSCode windows and workspaces
- Pagination and code-context output for high-volume symbol/location queries
- Symbol validation with nearest-position suggestions when the requested symbol no longer matches the cursor position
- Auto-collapsed file and symbol structure output for large files
- Debug panel and status-bar integration for observing MCP traffic and connection state

## MCP Tools

| Tool | Description |
|------|-------------|
| `listOpenProjects` | List all open workspaces, optionally filtered by a parent `projectPath` |
| `goToDefinition` | Navigate to symbol definition |
| `findReferences` | Find symbol references |
| `hover` | Get hover information |
| `getFileStruct` | Get file symbol structure (with auto-collapse) |
| `getSymbolStruct` | Get specific symbol's structure |
| `searchSymbolInWorkspace` | Search symbols in workspace |
| `goToImplementation` | Find interface implementations |
| `incomingCalls` | Find methods that call this method |
| `renameSymbol` | Rename symbol |
| `getDiagnostics` | Get diagnostic information |
| `getDefinitionText` | Get definition text |
| `syncFiles` | Sync file changes |
| `searchFiles` | Search files |
| `moveFile` | Move file |
| `deleteFile` | Delete file |
| `getScopeParent` | Get parent scope symbol |

## Requirements

- VSCode 1.85.0+
- Node.js 22.x for local development and packaging

## Usage

### Installation

1. Install the extension from VSCode Extension Marketplace, or install from a local `.vsix` file.

2. Start VSCode and keep the extension enabled. By default, the MCP server starts automatically on port `53221`.

3. Add the following configuration to your MCP configuration file (`mcp.json`):

```json
{
  "mcpServers": {
    "ide-lsp": {
      "url": "http://localhost:53221/mcp",
      "type": "http"
    }
  }
}
```

If you change `ide-lsp-mcp.port`, update the MCP server URL to match the configured port.

### Notes for MCP Clients

- `listOpenProjects` accepts an optional `projectPath`; when provided, it returns workspaces whose opened project folders are inside that path.
- Pagination is available on large result sets such as references, implementations, diagnostics, and file search.
- `moveFile` and `deleteFile` are safe by default and require confirmation unless explicitly allowed by settings.

### Debug Panel

- Set `ide-lsp-mcp.enableDebug` to `true` to show the MCP debug panel in the debug sidebar.
- The panel records tool name, arguments, result summary, duration, and success state for up to 500 entries.
- Double-click a log entry to open the full request and response in a read-only virtual document.
- The `listOpenProjects` tool runs only on the MCP server side and will not appear in the debug panel.

### Commands

| Command | Description |
|---------|-------------|
| `IDE-LSP-MCP: Show Status` | Show the current MCP server connection status |
| `IDE-LSP-MCP: Reconnect` | Reconnect to the MCP server and start it if needed |
| `IDE-LSP-MCP: Restart MCP Server` | Restart the standalone MCP server after confirmation |
| `IDE-LSP-MCP: Clear Debug Log` | Clear all entries from the debug panel |

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ide-lsp-mcp.port` | number | 53221 | MCP server port |
| `ide-lsp-mcp.autoStart` | boolean | true | Auto-start server on launch |
| `ide-lsp-mcp.pageSize` | number | 50 | Page size |
| `ide-lsp-mcp.contextLines` | number | 2 | Number of surrounding context lines to include in location results (`2n+1` total lines) |
| `ide-lsp-mcp.enableDebug` | boolean | false | Enable debug panel |
| `ide-lsp-mcp.allowMoveFile` | boolean | false | Allow MCP client to move files without confirmation |
| `ide-lsp-mcp.allowDeleteFile` | boolean | false | Allow MCP client to delete files without confirmation |
| `ide-lsp-mcp.enableCors` | boolean | false | Enable CORS for MCP server |
| `ide-lsp-mcp.diagnosticsTimeout` | number | 5000 | Timeout for waiting diagnostics to be produced |
| `ide-lsp-mcp.nearestSymbolsCount` | number | 3 | Number of nearest matching symbol suggestions returned on symbol validation failure |
| `ide-lsp-mcp.maxStructLines` | number | 200 | Maximum output lines for file or symbol structure in auto mode |

## Behavior Notes

- `getFileStruct` and `getSymbolStruct` support `maxDepth`; negative values use auto mode and respect `ide-lsp-mcp.maxStructLines`.
- Symbol-aware tools validate `symbolName` and can return suggested positions if the target symbol has moved.
- `getDiagnostics` can wait for diagnostics on unopened files before returning results, controlled by `ide-lsp-mcp.diagnosticsTimeout`.

## Architecture

```
┌─────────────────┐     HTTP/SSE      ┌─────────────────┐
│   MCP Client    │ ◄──────────────► │   MCP Server    │
│  (AI Model)     │                   │ (Standalone Node.js) │
└─────────────────┘                   └────────┬────────┘
                                               │ WebSocket
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
             ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
             │  Window 1   │           │  Window 2   │           │  Window 3   │
             │  ExtHost    │           │  ExtHost    │           │  ExtHost    │
             └─────────────┘           └─────────────┘           └─────────────┘
```

## Documentation

- [Features](./doc/FEATURES.md)
- [Architecture](./doc/ARCHITECTURE.md)
- [Project Structure](./doc/STRUCTURE.md)
- [Settings & Debugging](./doc/SETTINGS.md)

## License

MIT
