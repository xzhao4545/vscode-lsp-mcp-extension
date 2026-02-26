import { z } from 'zod';

// ============ 基础 Schema ============

/** 项目路径 - 所有工具都需要 */
const projectPath = z.string().describe('Project root path (absolute)');

/** 文件路径 */
const filePath = z.string().describe('File path (absolute or relative to project)');

/** 行号 (1-based) */
const line = z.number().describe('Line number (1-based)');

/** 列偏移 (0-based) */
const character = z.number().describe('Column offset (0-based)');

/** 分页 */
const page = z.number().optional().describe('Page number (1-based), default 1');

const symbolName = z.string().describe('Symbol name for validation');

// ============ 工具定义 ============

export const TOOL_SCHEMAS = {
  listOpenProjects: {
    description: '<important>Prioritize methods including with "IDE-" to ensure better performance and cache utilization.\n' +
      'You are connected to the IDE-LSP-MCP Server. All methods prefixed with "IDE-" are provided by this service. ' +
      'These methods directly reuse the LSP service exported from the currently opened IDE, eliminating the need to re-parse files. ' +
      'As a result, they offer better performance compared to other LSP instances or text-based searches (e.g., grep).\n' +
      'When performing operations such as symbol lookup, rename, find references, or go to definition, always prioritize methods that start with "IDE-" instead of using text search or launching a new LSP service.\n' +
      'In addition, all "IDE-" methods that include a page parameter support caching. When requesting the next page, keep all other parameters unchanged to ensure cache hits and reduce the number of queries.</important>\n\n' +
      'listOpenProjects: List all currently open project paths in the IDE. Use this to discover available projects.',
    inputSchema: z.object({
      projectPath: z.string().optional().describe('Optional current directory path'),
    }),
  },

  goToDefinition: {
    description: 'Navigate to symbol definition. Prefer this over grep for finding where a variable/method/class is defined.',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      symbolName,
    }),
  },

  findReferences: {
    description: 'Find all references to a symbol.',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      page,
      symbolName,
    }),
  },

  hover: {
    description: 'Get hover information (name and doc comment) for a symbol. Use this to understand what a symbol is.',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      symbolName,
    }),
  },

  getFileStruct: {
    description: 'Retrieve the file structure in a tree format. If you want to quickly understand the file structure, you should use this method instead of reading the entire file directly.\n' +
      'After obtaining the file structure, you can call the "hover" method to view documentation, or call the "getDefinitionText" method to access the corresponding implementation details.',
    inputSchema: z.object({
      projectPath,
      filePath,
    }),
  },

  searchSymbolInWorkspace: {
    description: 'Search for symbols by name across workspace.',
    inputSchema: z.object({
      projectPath,
      query: z.string().describe('Search query (case-insensitive substring match)'),
      symbolType: z.enum(['class', 'method', 'field', 'all']).optional().describe("Symbol type filter: 'class', 'method', 'field', or 'all'"),
      page,
    }),
  },

  goToImplementation: {
    description: 'Find implementations of an interface/abstract class/method.',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      page,
      symbolName,
    }),
  },

  incomingCalls: {
    description: 'Find all methods that call the specified method.',
    inputSchema: z.object({
      projectPath,
      filePath,
      line: z.number().describe('Line number (1-based), can be method definition or inside method body'),
      page,
    }),
  },

  renameSymbol: {
    description: 'Prepare rename edits for a symbol. Returns all locations to change without applying. Use this for safe refactoring across the project.',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      symbolName: z.string().describe('Current symbol name for validation'),
      newName: z.string().describe('New name for the symbol'),
    }),
  },

  getDiagnostics: {
    description: 'Get code diagnostics (errors, warnings) for a file. You should call this method after modifying the file to check for syntax errors.',
    inputSchema: z.object({
      projectPath,
      filePath,
      severity: z.enum(["Error","Warning","Information","Hint"]).default("Warning").optional().describe("Min severity filter: Error|Warning|Information|Hint (default: Warning)"),
      page,
    }),
  },

  getDefinitionText: {
    description: 'Retrieve the complete definition text of the specified element (whether at its declaration or reference point), ' +
      'including comments and code. Quickly view the implementation details without any irrelevant content. ' +
      'When you only need to check the specific implementation of a method or class, prioritize this approach to reduce unnecessary context distractions.',
    inputSchema: z.object({
      projectPath,
      filePath,
      line,
      character,
      symbolName,
    }),
  },

  syncFiles: {
    description: 'Force IDE to sync virtual file system with external changes. Call after files are created/modified/deleted outside IDE.',
    inputSchema: z.object({
      projectPath,
      paths: z.array(z.string()).optional().describe('File/directory paths to sync (relative to project).'),
    }),
  },

  searchFiles: {
    description: 'Search files by name pattern in a directory. Supports regex matching.',
    inputSchema: z.object({
      projectPath,
      pattern: z.string().describe('File name pattern (regex)'),
      directory: z.string().optional().describe('Directory to search (relative to project, empty for project root)'),
      recursive: z.boolean().optional().describe('Search recursively (default: true)'),
      page: z.number().optional().describe('Page number (default: 1)'),
    }),
  },

  moveFile: {
    description: 'Move file using IDE refactoring. Updates all references automatically.',
    inputSchema: z.object({
      projectPath,
      sourcePath: z.string().describe('Source file/directory path (relative to project)'),
      targetDir: z.string().describe('Target directory path (relative to project)'),
    }),
  },

  deleteFile: {
    description: 'Delete file safely. If usages exist, returns their locations; use force=true to delete anyway and get remaining usages for manual cleanup.',
    inputSchema: z.object({
      projectPath,
      filePath: z.string().describe('File path to delete (relative to project)'),
      force: z.boolean().optional().describe('Force delete even if usages exist (default: false)'),
    }),
  },

  getScopeParent: {
    description: 'Find the enclosing symbol (method, class, function) at a given line and return its definition location with code context.',
    inputSchema: z.object({
      projectPath,
      filePath,
      line: z.number().describe('Line number (1-based), can be method/class definition or inside method/class body'),
    }),
  },
} as const;

/** 工具名称类型 */
export type ToolName = keyof typeof TOOL_SCHEMAS;

/** 获取工具输入类型 */
export type ToolInput<T extends ToolName> = z.infer<typeof TOOL_SCHEMAS[T]['inputSchema']>;

export default TOOL_SCHEMAS;
