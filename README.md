# IDE-LSP for MCP

A VSCode extension that exposes IDE code intelligence capabilities through the MCP (Model Context Protocol).

As long as VSCode supports parsing a certain language, this extension can provide LSP services for that language to AI models.

> **中文**: [中文版本](./readme/README.zh-CN.md)

## Features

- 16 MCP Tools covering common code intelligence operations
- Multi-window and multi-workspace support
- Pagination support to avoid large data transfers
- Code context information for AI understanding
- Debug panel for tool call logs

## MCP Tools

| Tool | Description |
|------|-------------|
| `listOpenProjects` | List all open workspaces |
| `goToDefinition` | Navigate to symbol definition |
| `findReferences` | Find symbol references |
| `hover` | Get hover information |
| `getFileStruct` | Get file symbol structure |
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
- Node.js 22.x

## Usage

### Installation

1. Install the extension from VSCode Extension Marketplace, or install from a local `.vsix` file

2. After installation, add the following configuration to your MCP configuration file (`mcp.json`):

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

### Debug Panel

- Set `ide-lsp-mcp.enableDebug` to `true` to enable the MCP debug panel in the debug sidebar, where you can view MCP tool calls and output parameters.
- The `listOpenProjects` tool runs only on the MCP server side and will not appear in the debug panel.

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `ide-lsp-mcp.port` | number | 53221 | MCP server port |
| `ide-lsp-mcp.autoStart` | boolean | true | Auto-start server on launch |
| `ide-lsp-mcp.pageSize` | number | 50 | Page size |
| `ide-lsp-mcp.contextLines` | number | 2 | Context lines |
| `ide-lsp-mcp.enableDebug` | boolean | false | Enable debug panel |

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
