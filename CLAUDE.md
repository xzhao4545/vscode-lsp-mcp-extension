# CLAUDE.md - IDE-LSP for MCP

## Project Context

- **Repository**: https://github.com/xzhao4545/vscode-lsp-mcp-extension (upstream), https://github.com/bramburn/vscode-lsp-mcp-extension (fork)
- **Current Branch**: `dev` (local), tracking `bramburn/dev`
- **Language**: TypeScript + VSCode Extension
- **i18n**: English (en) + Chinese Simplified (zh-CN)

## Branch Strategy

- `main` - stable release branch
- `dev` - development branch
- Feature branches merged into `dev` via PR

## i18n Requirements (CRITICAL)

All user-facing text MUST be localized in both **English** and **Chinese (Simplified/Mandarin)**.

### Scope

| Location | Example | Files |
|----------|---------|-------|
| Display text | Button labels, status bar | `package.nls.json`, `package.nls.zh-cn.json` |
| Notifications | Messages, alerts | `l10n/bundle.l10n.json`, `l10n/bundle.l10n.zh-cn.json` |
| README.md | All sections | `README.md`, `readme/README.zh-CN.md` |
| CHANGELOG.md | All entries | `CHANGELOG.md` |
| Documentation | Doc files | `doc/**/*.md` |
| Code comments | Inline explanations | All `*.ts` files in `src/` |

### l10n Folder Structure

```
l10n/
├── bundle.l10n.json          # English translations
└── bundle.l10n.zh-cn.json     # Chinese translations
```

### Translation Rules

1. **Key format for bundle.l10n.json**: `{english_key}: {english_value}`
2. **Key format for bundle.l10n.zh-cn.json**: `{english_key}: {chinese_value}`
3. **All keys must match** between language files
4. **Code comments in TypeScript**: Add bilingual comments `// EN: ... // CN: ...`
5. **README/CHANGELOG**: Provide full English version, then add Chinese version in `readme/` folder

### Before Commit Checklist

- [ ] All new display/notification text added to `l10n/bundle.l10n.json` AND `l10n/bundle.l10n.zh-cn.json`
- [ ] All new settings documented in both `package.nls.json` AND `package.nls.zh-cn.json`
- [ ] README changes have corresponding `readme/README.zh-CN.md` entry
- [ ] CHANGELOG entries are in English; Chinese version not required but `readme/README.zh-CN.md` should be updated
- [ ] Code comments use bilingual format when explaining non-obvious logic

### Git Workflow

1. Create feature branch from `dev`
2. Make changes with i18n compliance
3. Push to your fork: `git push -u bramburn <branch>`
4. Create PR to upstream `dev`: `gh pr create --repo xzhao4545/vscode-lsp-mcp-extension --head bramburn:<branch> --base dev`

## Architecture Patterns

### Protocol Pattern (src/shared/protocol.ts)

Communication uses a strictly typed message structure. When adding a new type of communication (e.g., "Progress Update"):

1. Define the interface in `src/shared/protocol.ts`
2. Add it to the `ClientMessage` or `ServerMessage` union types
3. Implement the handler in both `src/server/McpServer.ts` and `src/client/ServerConnection.ts`

See `.claude/rules/claude-dev-patterns.md` for full details.

### Adding Commands and Tools

See `.claude/rules/claude-dev-patterns.md` for patterns on:
- Adding new VSCode commands (package.json → registration)
- Adding new MCP tools (MCPTools.ts schema → Tool class → TaskExecutor)
