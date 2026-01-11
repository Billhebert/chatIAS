/**
 * FileReader - Lê arquivos do sistema com validações de segurança
 *
 * Actions:
 * - read: Lê conteúdo do arquivo
 * - extract_dependencies: Extrai dependências do código
 */

import { BaseTool } from '../core/base-tool.js';
import fs from 'fs';
import path from 'path';

export class FileReader extends BaseTool {
  /**
   * Execução padrão (read)
   */
  async execute(params) {
    const { path: filePath, encoding = 'utf-8' } = params;

    return await this.action_read({ path: filePath, encoding });
  }

  /**
   * Valida path do arquivo por segurança
   */
  validateFilePath(filePath) {
    const errors = [];

    // Check if path is absolute or tries to escape
    if (filePath.includes('..')) {
      errors.push('Path traversal is not allowed');
    }

    // Check allowed extensions
    const allowedExtensions = this.constraints.allowedExtensions || [];
    if (allowedExtensions.length > 0) {
      const ext = path.extname(filePath);
      if (!allowedExtensions.includes(ext)) {
        errors.push(`File extension ${ext} is not allowed. Allowed: ${allowedExtensions.join(', ')}`);
      }
    }

    // Check allowed paths
    const allowedPaths = this.constraints.allowedPaths || [];
    if (allowedPaths.length > 0) {
      const resolvedPath = path.resolve(filePath);
      const isAllowed = allowedPaths.some(allowedPath => {
        const resolvedAllowed = path.resolve(allowedPath);
        return resolvedPath.startsWith(resolvedAllowed);
      });

      if (!isAllowed) {
        errors.push(`Access to path ${filePath} is not allowed. Allowed paths: ${allowedPaths.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Verifica tamanho do arquivo
   */
  checkFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const maxSize = this.constraints.maxFileSize || '10MB';

      // Parse max size
      const sizeMatch = maxSize.match(/^(\d+)(MB|KB|B)?$/i);
      if (!sizeMatch) {
        return { valid: true }; // Não valida se formato inválido
      }

      const [, num, unit = 'B'] = sizeMatch;
      const multipliers = { B: 1, KB: 1024, MB: 1024 * 1024 };
      const maxBytes = parseInt(num) * multipliers[unit.toUpperCase()];

      if (stats.size > maxBytes) {
        return {
          valid: false,
          error: `File size ${stats.size} bytes exceeds maximum ${maxSize}`
        };
      }

      return { valid: true, size: stats.size };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to check file size: ${error.message}`
      };
    }
  }

  /**
   * Action: read
   * Lê conteúdo do arquivo
   */
  async action_read(params) {
    const { path: filePath, encoding = 'utf-8' } = params;

    this.log(`Reading file: ${filePath}`);

    try {
      // Valida path
      const pathValidation = this.validateFilePath(filePath);
      if (!pathValidation.valid) {
        return {
          success: false,
          errors: pathValidation.errors,
          message: 'File path validation failed'
        };
      }

      // Verifica se arquivo existe
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
          message: 'File not found'
        };
      }

      // Verifica tamanho
      const sizeCheck = this.checkFileSize(filePath);
      if (!sizeCheck.valid) {
        return {
          success: false,
          error: sizeCheck.error,
          message: 'File size check failed'
        };
      }

      // Lê arquivo
      const content = fs.readFileSync(filePath, encoding);

      // Obtém metadata
      const stats = fs.statSync(filePath);

      return {
        success: true,
        content,
        metadata: {
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          accessed: stats.atime,
          extension: path.extname(filePath),
          basename: path.basename(filePath),
          dirname: path.dirname(filePath),
          lines: content.split('\n').length
        },
        message: 'File read successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          type: error.name
        },
        message: 'Failed to read file'
      };
    }
  }

  /**
   * Action: extract_dependencies
   * Extrai dependências do código (JavaScript/TypeScript)
   */
  async action_extract_dependencies(params) {
    const { code } = params;

    this.log('Extracting dependencies from code');

    try {
      const dependencies = {
        imports: [],
        requires: [],
        dynamicImports: [],
        exports: []
      };

      // ES6 imports
      const importRegex = /import\s+(?:(?:(\*\s+as\s+\w+)|({[^}]+})|(\w+))\s+from\s+)?['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(code)) !== null) {
        const [fullMatch, namespaceImport, namedImports, defaultImport, module] = match;
        dependencies.imports.push({
          module,
          type: namespaceImport ? 'namespace' : namedImports ? 'named' : defaultImport ? 'default' : 'side-effect',
          statement: fullMatch,
          position: match.index
        });
      }

      // CommonJS requires
      const requireRegex = /(?:const|let|var)\s+(?:({[^}]+})|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = requireRegex.exec(code)) !== null) {
        const [fullMatch, destructured, variable, module] = match;
        dependencies.requires.push({
          module,
          type: destructured ? 'destructured' : 'default',
          variable: destructured || variable,
          statement: fullMatch,
          position: match.index
        });
      }

      // Dynamic imports
      const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      while ((match = dynamicImportRegex.exec(code)) !== null) {
        dependencies.dynamicImports.push({
          module: match[1],
          statement: match[0],
          position: match.index
        });
      }

      // Exports
      const exportRegex = /export\s+(?:(default)\s+)?(?:(class|function|const|let|var)\s+)?(\w+)?/g;
      while ((match = exportRegex.exec(code)) !== null) {
        const [fullMatch, isDefault, type, name] = match;
        if (name || isDefault) {
          dependencies.exports.push({
            name: name || 'default',
            type: type || (isDefault ? 'default' : 'unknown'),
            isDefault: !!isDefault,
            statement: fullMatch,
            position: match.index
          });
        }
      }

      // Categoriza módulos
      const allModules = [
        ...dependencies.imports.map(i => i.module),
        ...dependencies.requires.map(r => r.module),
        ...dependencies.dynamicImports.map(d => d.module)
      ];

      const categorized = {
        npm: [],
        local: [],
        builtin: [],
        unknown: []
      };

      const builtinModules = [
        'fs', 'path', 'http', 'https', 'crypto', 'util', 'os', 'events',
        'stream', 'buffer', 'url', 'querystring', 'assert', 'child_process',
        'cluster', 'dgram', 'dns', 'domain', 'net', 'readline', 'tls', 'tty',
        'vm', 'zlib', 'process', 'v8', 'worker_threads', 'perf_hooks'
      ];

      for (const module of allModules) {
        if (builtinModules.includes(module) || module.startsWith('node:')) {
          categorized.builtin.push(module);
        } else if (module.startsWith('.') || module.startsWith('/')) {
          categorized.local.push(module);
        } else if (module.startsWith('@') || /^[a-z0-9-]+$/.test(module)) {
          categorized.npm.push(module);
        } else {
          categorized.unknown.push(module);
        }
      }

      return {
        success: true,
        dependencies,
        categorized,
        summary: {
          total: allModules.length,
          imports: dependencies.imports.length,
          requires: dependencies.requires.length,
          dynamicImports: dependencies.dynamicImports.length,
          exports: dependencies.exports.length,
          npm: categorized.npm.length,
          local: categorized.local.length,
          builtin: categorized.builtin.length
        },
        message: 'Dependencies extracted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: error.name
        },
        message: 'Failed to extract dependencies'
      };
    }
  }

  /**
   * Lifecycle: Inicialização
   */
  async onInit() {
    this.log('FileReader initialized');

    // Valida constraints
    if (this.constraints.allowedPaths) {
      this.log(`Allowed paths: ${this.constraints.allowedPaths.join(', ')}`, 'debug');
    }
    if (this.constraints.allowedExtensions) {
      this.log(`Allowed extensions: ${this.constraints.allowedExtensions.join(', ')}`, 'debug');
    }
  }

  /**
   * Lifecycle: Destruição
   */
  async onDestroy() {
    this.log('FileReader destroyed');
  }
}

export default FileReader;
