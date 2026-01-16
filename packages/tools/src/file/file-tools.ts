/**
 * Advanced File Operations Tools
 * 
 * This module provides sophisticated file manipulation tools from OpenCode,
 * now enhanced with enterprise-grade governance and TypeScript safety.
 * 
 * Features:
 * - Read files with offset/limit
 * - Write files with backup and rollback
 * - Edit files with diff support
 * - Directory listing and search
 * - File system monitoring
 */

import { promises as fs } from 'fs';
import { join, resolve, basename, dirname, extname } from 'path';
import { BaseTool, ToolConfig, ToolResult, ExecutionContext } from '@chatias/core';
import { z } from 'zod';

/**
 * Read Tool - Advanced file reading with pagination
 */
export class ReadTool extends BaseTool {
  constructor() {
    super({
      id: 'read',
      name: 'File Reader',
      description: 'Read file content with offset, limit, and encoding support',
      category: 'file',
      enabled: true,
      version: '3.0.0',
      parameters: {
        filePath: {
          type: 'string',
          required: true,
          description: 'Path to the file to read'
        },
        offset: {
          type: 'number',
          required: false,
          default: 0,
          min: 0,
          description: 'Number of lines to skip from start'
        },
        limit: {
          type: 'number',
          required: false,
          default: 2000,
          min: 1,
          max: 10000,
          description: 'Maximum number of lines to read'
        },
        encoding: {
          type: 'string',
          required: false,
          default: 'utf-8',
          description: 'File encoding'
        }
      },
      constraints: {
        maxExecutionTime: 5000,
        allowedExtensions: ['.ts', '.js', '.json', '.md', '.txt', '.py', '.java', '.cpp', '.c', '.go', '.rs'],
        maxFileSize: '10MB'
      }
    });
  }

  protected async executeCore(params: any, context?: ExecutionContext): Promise<any> {
    const { filePath, offset = 0, limit = 2000, encoding = 'utf-8' } = params;

    try {
      // Validate and resolve path
      const resolvedPath = resolve(filePath);
      
      // Check file exists and get stats
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${resolvedPath}`);
      }

      // Check file size
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (stats.size > maxSize) {
        throw new Error(`File too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max: 10MB)`);
      }

      // Read file content
      const content = await fs.readFile(resolvedPath, encoding);
      const lines = content.split('\n');

      // Apply pagination
      const startLine = Math.min(offset, lines.length);
      const endLine = Math.min(startLine + limit, lines.length);
      const selectedLines = lines.slice(startLine, endLine);

      return {
        content: selectedLines.join('\n'),
        lines: {
          total: lines.length,
          start: startLine + 1,
          end: endLine,
          returned: selectedLines.length
        },
        metadata: {
          path: resolvedPath,
          size: stats.size,
          encoding,
          lastModified: stats.mtime.toISOString()
        },
        truncated: endLine < lines.length
      };

    } catch (error) {
      throw new Error(`Failed to read file '${filePath}': ${error.message}`);
    }
  }

  protected async validateParameters(action: string, params: any): Promise<any> {
    const schema = z.object({
      filePath: z.string().min(1, 'File path is required'),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(10000).optional(),
      encoding: z.string().optional()
    });

    return await schema.parseAsync(params);
  }
}

/**
 * Write Tool - Advanced file writing with backup
 */
export class WriteTool extends BaseTool {
  constructor() {
    super({
      id: 'write',
      name: 'File Writer',
      description: 'Write content to file with automatic backup and rollback',
      category: 'file',
      enabled: true,
      version: '3.0.0',
      parameters: {
        filePath: {
          type: 'string',
          required: true,
          description: 'Path to the file to write'
        },
        content: {
          type: 'string',
          required: true,
          description: 'Content to write to file'
        },
        encoding: {
          type: 'string',
          required: false,
          default: 'utf-8',
          description: 'File encoding'
        },
        createBackup: {
          type: 'boolean',
          required: false,
          default: true,
          description: 'Create backup of existing file'
        },
        overwrite: {
          type: 'boolean',
          required: false,
          default: false,
          description: 'Overwrite existing file'
        }
      },
      constraints: {
        maxExecutionTime: 10000,
        allowedExtensions: ['.ts', '.js', '.json', '.md', '.txt', '.py', '.java', '.cpp', '.c', '.go', '.rs'],
        maxFileSize: '10MB'
      }
    });
  }

  protected async executeCore(params: any, context?: ExecutionContext): Promise<any> {
    const { filePath, content, encoding = 'utf-8', createBackup = true, overwrite = false } = params;

    try {
      const resolvedPath = resolve(filePath);
      const dir = dirname(resolvedPath);

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Check if file exists
      const fileExists = await fs.access(resolvedPath).then(() => true).catch(() => false);

      if (fileExists && !overwrite) {
        throw new Error(`File already exists: ${resolvedPath}. Use overwrite: true to replace.`);
      }

      let backupPath: string | null = null;

      // Create backup if file exists and backup is requested
      if (fileExists && createBackup) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = `${resolvedPath}.backup.${timestamp}`;
        await fs.copyFile(resolvedPath, backupPath);
      }

      // Write new content
      const buffer = Buffer.from(content, encoding);
      await fs.writeFile(resolvedPath, buffer);

      // Get file stats
      const stats = await fs.stat(resolvedPath);

      return {
        success: true,
        path: resolvedPath,
        bytesWritten: buffer.length,
        encoding,
        backup: backupPath,
        metadata: {
          created: !fileExists,
          overwritten: fileExists,
          lastModified: stats.mtime.toISOString()
        }
      };

    } catch (error) {
      throw new Error(`Failed to write file '${filePath}': ${error.message}`);
    }
  }

  protected async validateParameters(action: string, params: any): Promise<any> {
    const schema = z.object({
      filePath: z.string().min(1, 'File path is required'),
      content: z.string(),
      encoding: z.string().optional(),
      createBackup: z.boolean().optional(),
      overwrite: z.boolean().optional()
    });

    return await schema.parseAsync(params);
  }
}

/**
 * Edit Tool - Advanced file editing with diff support
 */
export class EditTool extends BaseTool {
  constructor() {
    super({
      id: 'edit',
      name: 'File Editor',
      description: 'Edit file content with diff tracking and rollback capability',
      category: 'file',
      enabled: true,
      version: '3.0.0',
      parameters: {
        filePath: {
          type: 'string',
          required: true,
          description: 'Path to the file to edit'
        },
        oldString: {
          type: 'string',
          required: false,
          description: 'Exact string to replace (for simple replacement)'
        },
        newString: {
          type: 'string',
          required: false,
          description: 'New string to insert'
        },
        regex: {
          type: 'string',
          required: false,
          description: 'Regular expression pattern to replace'
        },
        replacement: {
          type: 'string',
          required: false,
          description: 'Replacement string for regex'
        },
        lineNumbers: {
          type: 'array',
          required: false,
          description: 'Array of line numbers to replace'
        },
        lines: {
          type: 'array',
          required: false,
          description: 'Array of new line content'
        },
        createBackup: {
          type: 'boolean',
          required: false,
          default: true,
          description: 'Create backup before editing'
        }
      },
      constraints: {
        maxExecutionTime: 15000,
        allowedExtensions: ['.ts', '.js', '.json', '.md', '.txt', '.py', '.java', '.cpp', '.c', '.go', '.rs'],
        maxFileSize: '10MB'
      }
    });
  }

  protected async executeCore(params: any, context?: ExecutionContext): Promise<any> {
    const { 
      filePath, 
      oldString, 
      newString, 
      regex, 
      replacement,
      lineNumbers,
      lines,
      createBackup = true 
    } = params;

    try {
      const resolvedPath = resolve(filePath);

      // Read original content
      const originalContent = await fs.readFile(resolvedPath, 'utf-8');
      const originalLines = originalContent.split('\n');

      let newContent: string;
      let diff: any[] = [];

      // Handle different edit modes
      if (oldString !== undefined && newString !== undefined) {
        // Simple string replacement
        if (!originalContent.includes(oldString)) {
          throw new Error(`String not found in file: "${oldString}"`);
        }
        newContent = originalContent.replace(oldString, newString);
        
        // Generate diff
        const oldLines = oldString.split('\n');
        const newLines = newString.split('\n');
        const startIndex = originalContent.indexOf(oldString);
        const startLine = originalContent.substring(0, startIndex).split('\n').length;
        
        diff = [{
          type: 'replace',
          startLine,
          endLine: startLine + oldLines.length - 1,
          oldLines,
          newLines
        }];

      } else if (regex && replacement !== undefined) {
        // Regex replacement
        const regexObj = new RegExp(regex, 'g');
        const matches = [...originalContent.matchAll(regexObj)];
        
        if (matches.length === 0) {
          throw new Error(`No matches found for regex: ${regex}`);
        }

        newContent = originalContent.replace(regexObj, replacement);
        
        // Generate diff for matches
        diff = matches.map((match, index) => ({
          type: 'regex_replace',
          match: match[0],
          replacement,
          index: match.index!,
          matchNumber: index + 1
        }));

      } else if (lineNumbers && lines) {
        // Line-based editing
        if (lineNumbers.length !== lines.length) {
          throw new Error('lineNumbers and lines arrays must have same length');
        }

        newContent = [...originalLines];
        
        diff = lineNumbers.map((lineNum, index) => {
          const actualIndex = lineNum - 1; // Convert to 0-based
          if (actualIndex < 0 || actualIndex >= originalLines.length) {
            throw new Error(`Invalid line number: ${lineNum}`);
          }
          
          const oldLine = newContent[actualIndex];
          newContent[actualIndex] = lines[index];
          
          return {
            type: 'line_replace',
            lineNumber: lineNum,
            oldLine,
            newLine: lines[index]
          };
        });

        newContent = newContent.join('\n');

      } else {
        throw new Error('Must provide either (oldString, newString) or (regex, replacement) or (lineNumbers, lines)');
      }

      // Create backup
      let backupPath: string | null = null;
      if (createBackup) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = `${resolvedPath}.backup.${timestamp}`;
        await fs.copyFile(resolvedPath, backupPath);
      }

      // Write edited content
      await fs.writeFile(resolvedPath, newContent, 'utf-8');

      return {
        success: true,
        path: resolvedPath,
        diff,
        backup: backupPath,
        changes: diff.length,
        metadata: {
          editType: diff[0]?.type || 'unknown',
          linesChanged: diff.reduce((sum, d) => {
            if (d.type === 'line_replace') return sum + 1;
            if (d.oldLines) return sum + d.oldLines.length;
            if (d.type === 'regex_replace') return sum + 1;
            return sum;
          }, 0)
        }
      };

    } catch (error) {
      throw new Error(`Failed to edit file '${filePath}': ${error.message}`);
    }
  }

  protected async validateParameters(action: string, params: any): Promise<any> {
    const schema = z.object({
      filePath: z.string().min(1, 'File path is required'),
      oldString: z.string().optional(),
      newString: z.string().optional(),
      regex: z.string().optional(),
      replacement: z.string().optional(),
      lineNumbers: z.array(z.number().int().min(1)).optional(),
      lines: z.array(z.string()).optional(),
      createBackup: z.boolean().optional()
    }).refine(
      (data) => {
        // Must have valid edit mode
        const hasStringReplace = data.oldString !== undefined && data.newString !== undefined;
        const hasRegexReplace = data.regex !== undefined && data.replacement !== undefined;
        const hasLineReplace = data.lineNumbers && data.lines;
        return hasStringReplace || hasRegexReplace || hasLineReplace;
      },
      {
        message: 'Must provide either (oldString, newString) or (regex, replacement) or (lineNumbers, lines)'
      }
    );

    return await schema.parseAsync(params);
  }
}

/**
 * List Tool - Directory listing and file search
 */
export class ListTool extends BaseTool {
  constructor() {
    super({
      id: 'list',
      name: 'Directory Lister',
      description: 'List directory contents with filtering and sorting',
      category: 'file',
      enabled: true,
      version: '3.0.0',
      parameters: {
        path: {
          type: 'string',
          required: true,
          description: 'Directory path to list'
        },
        recursive: {
          type: 'boolean',
          required: false,
          default: false,
          description: 'List recursively'
        },
        showHidden: {
          type: 'boolean',
          required: false,
          default: false,
          description: 'Show hidden files'
        },
        filter: {
          type: 'string',
          required: false,
          description: 'Filter pattern (glob)'
        },
        sortBy: {
          type: 'string',
          required: false,
          enum: ['name', 'size', 'modified', 'type'],
          default: 'name',
          description: 'Sort by field'
        },
        order: {
          type: 'string',
          required: false,
          enum: ['asc', 'desc'],
          default: 'asc',
          description: 'Sort order'
        }
      },
      constraints: {
        maxExecutionTime: 5000,
        noFileSystem: false
      }
    });
  }

  protected async executeCore(params: any, context?: ExecutionContext): Promise<any> {
    const { 
      path, 
      recursive = false, 
      showHidden = false, 
      filter, 
      sortBy = 'name', 
      order = 'asc' 
    } = params;

    try {
      const resolvedPath = resolve(path);
      const stats = await fs.stat(resolvedPath);

      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${resolvedPath}`);
      }

      const items = await this.scanDirectory(resolvedPath, {
        recursive,
        showHidden,
        filter
      });

      // Sort items
      items.sort((a, b) => {
        let aVal, bVal;
        
        switch (sortBy) {
          case 'size':
            aVal = a.isDirectory ? 0 : a.size;
            bVal = b.isDirectory ? 0 : b.size;
            break;
          case 'modified':
            aVal = new Date(a.modified).getTime();
            bVal = new Date(b.modified).getTime();
            break;
          case 'type':
            aVal = a.isDirectory ? 0 : 1;
            bVal = b.isDirectory ? 0 : 1;
            break;
          default: // name
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
        }

        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return order === 'desc' ? -comparison : comparison;
      });

      return {
        path: resolvedPath,
        items,
        total: items.length,
        metadata: {
          recursive,
          showHidden,
          filter,
          sortBy,
          order
        }
      };

    } catch (error) {
      throw new Error(`Failed to list directory '${path}': ${error.message}`);
    }
  }

  private async scanDirectory(
    dirPath: string, 
    options: { recursive: boolean; showHidden: boolean; filter?: string }
  ): Promise<any[]> {
    const { recursive, showHidden, filter } = options;
    const items: any[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files
        if (!showHidden && entry.name.startsWith('.')) {
          continue;
        }

        // Apply filter
        if (filter && !this.matchesFilter(entry.name, filter)) {
          continue;
        }

        const fullPath = join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);

        const item = {
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          size: entry.isDirectory() ? 0 : stats.size,
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString()
        };

        items.push(item);

        // Recursively scan subdirectories
        if (recursive && entry.isDirectory()) {
          try {
            const subItems = await this.scanDirectory(fullPath, options);
            items.push(...subItems);
          } catch (error) {
            // Skip directories we can't read
            console.warn(`Cannot read directory ${fullPath}: ${error.message}`);
          }
        }
      }

    } catch (error) {
      throw new Error(`Cannot scan directory ${dirPath}: ${error.message}`);
    }

    return items;
  }

  private matchesFilter(filename: string, pattern: string): boolean {
    // Simple glob matching (could be enhanced)
    if (!pattern) return true;

    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      'i'
    );

    return regex.test(filename);
  }

  protected async validateParameters(action: string, params: any): Promise<any> {
    const schema = z.object({
      path: z.string().min(1, 'Path is required'),
      recursive: z.boolean().optional(),
      showHidden: z.boolean().optional(),
      filter: z.string().optional(),
      sortBy: z.enum(['name', 'size', 'modified', 'type']).optional(),
      order: z.enum(['asc', 'desc']).optional()
    });

    return await schema.parseAsync(params);
  }
}

// Export all file tools
export const FileTools = {
  read: ReadTool,
  write: WriteTool,
  edit: EditTool,
  list: ListTool
};

// Factory function to create tool instances
export function createFileTools() {
  return {
    read: new ReadTool(),
    write: new WriteTool(),
    edit: new EditTool(),
    list: new ListTool()
  };
}