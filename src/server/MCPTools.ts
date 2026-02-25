import { z } from 'zod';

// ============ 基础 Schema ============

/** 项目路径 - 所有工具都需要 */
const projectPath = z.string().describe('Project directory absolute path');

/** 文件路径 */
const filePath = z.string().describe('File path (absolute or relative)');

/** 行号 (1-based) */
const line = z.number().describe('Line number (1-based)');

/** 列偏移 (0-based) */
const character = z.number().describe('Column offset (0-based)');

/** 分页 */
const page = z.number().optional().describe('Page number (1-based)');

// ============ 工具定义 ============

export const TOOL_SCHEMAS = {
  listOpenProjects: {
    description: 'List all open workspaces and their directories',
    inputSchema: z.object({
      projectPath: z.string().optional().describe('Optional current directory path'),
    }),
  },

  goToDefinition: {
    description: 'Jump to symbol definition location',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      symbolName: z.string().optional().describe('Optional symbol name for validation'),
    }),
  },

  findReferences: {
    description: 'Find all references to a symbol',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      page,
    }),
  },

  hover: {
    description: 'Get hover information for a symbol',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
    }),
  },

  getFileStruct: {
    description: 'Get all symbol structures in a file',
    inputSchema: z.object({
      projectPath,
      filePath,
    }),
  },

  searchSymbolInWorkspace: {
    description: 'Search symbols in workspace',
    inputSchema: z.object({
      projectPath,
      query: z.string().describe('Search keyword'),
      symbolType: z.enum(['class', 'method', 'field', 'all']).optional(),
      page,
    }),
  },

  goToImplementation: {
    description: 'Find implementations of interface/abstract class',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      page,
    }),
  },

  incomingCalls: {
    description: 'Find callers of a method',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      page,
    }),
  },

  renameSymbol: {
    description: 'Prepare rename edits',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      symbolName: z.string().optional(),
      newName: z.string().describe('New symbol name'),
    }),
  },

  getDiagnostics: {
    description: 'Get file diagnostics (warnings, errors)',
    inputSchema: z.object({
      projectPath,
      filePath,
      severity: z.string().optional(),
      page,
    }),
  },

  getDefinitionText: {
    description: 'Get symbol definition text',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      symbolName: z.string().optional(),
    }),
  },

  syncFiles: {
    description: 'Refresh VSCode index, sync external file changes',
    inputSchema: z.object({
      projectPath,
      paths: z.array(z.string()).optional(),
    }),
  },

  searchFiles: {
    description: 'Search files by name regex',
    inputSchema: z.object({
      projectPath,
      pattern: z.string().describe('Filename regex'),
      directory: z.string().optional(),
      recursive: z.boolean().optional(),
      page,
    }),
  },

  moveFile: {
    description: 'Move file/directory, auto-update references',
    inputSchema: z.object({
      projectPath,
      sourcePath: z.string(),
      targetDir: z.string(),
    }),
  },

  deleteFile: {
    description: 'Safely delete file, check references',
    inputSchema: z.object({
      projectPath,
      filePath,
      force: z.boolean().optional(),
    }),
  },

  getScopeParent: {
    description: 'Find parent symbol at position',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
    }),
  },
} as const;

/** 工具名称类型 */
export type ToolName = keyof typeof TOOL_SCHEMAS;

/** 获取工具输入类型 */
export type ToolInput<T extends ToolName> = z.infer<typeof TOOL_SCHEMAS[T]['inputSchema']>;

export default TOOL_SCHEMAS;
