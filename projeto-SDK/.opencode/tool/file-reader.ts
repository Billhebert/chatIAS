import { tool } from '@opencode-ai/plugin/tool'
import fs from 'fs'
import path from 'path'

export default tool({
  description: 'Lê arquivos do sistema com validações de segurança e extrai dependências',
  args: {
    path: tool.schema.string().describe('Caminho do arquivo a ler'),
    action: tool.schema
      .enum(['read', 'extract_dependencies'])
      .optional()
      .describe('Ação: read (padrão) ou extract_dependencies'),
    code: tool.schema
      .string()
      .optional()
      .describe('Código para extrair dependências (obrigatório se action=extract_dependencies)'),
    encoding: tool.schema
      .string()
      .optional()
      .describe('Codificação do arquivo (padrão: utf-8)')
  },
  async execute(args) {
    const { path: filePath, action = 'read', code, encoding = 'utf-8' } = args

    try {
      switch (action) {
        case 'read': {
          const result = await readFile(filePath, encoding)
          return JSON.stringify(result)
        }
        case 'extract_dependencies': {
          if (!code) {
            return JSON.stringify({
              success: false,
              error: 'Código é obrigatório para extract_dependencies',
              message: 'Parâmetro code não fornecido'
            })
          }
          const result = await extractDependencies(code)
          return JSON.stringify(result)
        }
        default:
          return JSON.stringify({
            success: false,
            error: `Ação desconhecida: ${action}`,
            message: 'Ação inválida'
          })
      }
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: {
          message: (error as any).message,
          code: (error as any).code,
          type: (error as any).name
        },
        message: 'Erro ao processar arquivo'
      })
    }
  }
})

function validateFilePath(filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check if path tries to escape
  if (filePath.includes('..')) {
    errors.push('Path traversal não é permitido')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

function checkFileSize(filePath: string): { valid: boolean; error?: string; size?: number } {
  try {
    const stats = fs.statSync(filePath)
    const maxSize = '10MB'

    // Parse max size
    const sizeMatch = maxSize.match(/^(\d+)(MB|KB|B)?$/i)
    if (!sizeMatch) {
      return { valid: true }
    }

    const [, num, unit = 'B'] = sizeMatch
    const multipliers: Record<string, number> = { B: 1, KB: 1024, MB: 1024 * 1024 }
    const maxBytes = parseInt(num) * multipliers[unit.toUpperCase()]

    if (stats.size > maxBytes) {
      return {
        valid: false,
        error: `Tamanho do arquivo ${stats.size} bytes excede o máximo ${maxSize}`
      }
    }

    return { valid: true, size: stats.size }
  } catch (error) {
    return {
      valid: false,
      error: `Falha ao verificar tamanho: ${(error as any).message}`
    }
  }
}

async function readFile(filePath: string, encoding: string) {
  try {
    // Valida path
    const pathValidation = validateFilePath(filePath)
    if (!pathValidation.valid) {
      return {
        success: false,
        errors: pathValidation.errors,
        message: 'Validação de caminho falhou'
      }
    }

    // Verifica se arquivo existe
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `Arquivo não encontrado: ${filePath}`,
        message: 'Arquivo não encontrado'
      }
    }

    // Verifica tamanho
    const sizeCheck = checkFileSize(filePath)
    if (!sizeCheck.valid) {
      return {
        success: false,
        error: sizeCheck.error,
        message: 'Verificação de tamanho falhou'
      }
    }

    // Lê arquivo
    const content = fs.readFileSync(filePath, encoding as BufferEncoding)

    // Obtém metadata
    const stats = fs.statSync(filePath)

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
      message: 'Arquivo lido com sucesso'
    }
  } catch (error) {
    return {
      success: false,
      error: {
        message: (error as any).message,
        code: (error as any).code,
        type: (error as any).name
      },
      message: 'Falha ao ler arquivo'
    }
  }
}

async function extractDependencies(code: string) {
  try {
    const dependencies: any = {
      imports: [],
      requires: [],
      dynamicImports: [],
      exports: []
    }

    // ES6 imports
    const importRegex = /import\s+(?:(?:(\*\s+as\s+\w+)|({[^}]+})|(\w+))\s+from\s+)?['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(code)) !== null) {
      const [fullMatch, namespaceImport, namedImports, defaultImport, module] = match
      dependencies.imports.push({
        module,
        type: namespaceImport ? 'namespace' : namedImports ? 'named' : defaultImport ? 'default' : 'side-effect',
        statement: fullMatch,
        position: match.index
      })
    }

    // CommonJS requires
    const requireRegex = /(?:const|let|var)\s+(?:({[^}]+})|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = requireRegex.exec(code)) !== null) {
      const [fullMatch, destructured, variable, module] = match
      dependencies.requires.push({
        module,
        type: destructured ? 'destructured' : 'default',
        variable: destructured || variable,
        statement: fullMatch,
        position: match.index
      })
    }

    // Dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((match = dynamicImportRegex.exec(code)) !== null) {
      dependencies.dynamicImports.push({
        module: match[1],
        statement: match[0],
        position: match.index
      })
    }

    // Exports
    const exportRegex = /export\s+(?:(default)\s+)?(?:(class|function|const|let|var)\s+)?(\w+)?/g
    while ((match = exportRegex.exec(code)) !== null) {
      const [fullMatch, isDefault, type, name] = match
      if (name || isDefault) {
        dependencies.exports.push({
          name: name || 'default',
          type: type || (isDefault ? 'default' : 'unknown'),
          isDefault: !!isDefault,
          statement: fullMatch,
          position: match.index
        })
      }
    }

    // Categoriza módulos
    const allModules = [
      ...dependencies.imports.map((i: any) => i.module),
      ...dependencies.requires.map((r: any) => r.module),
      ...dependencies.dynamicImports.map((d: any) => d.module)
    ]

    const categorized = {
      npm: [] as string[],
      local: [] as string[],
      builtin: [] as string[],
      unknown: [] as string[]
    }

    const builtinModules = [
      'fs', 'path', 'http', 'https', 'crypto', 'util', 'os', 'events',
      'stream', 'buffer', 'url', 'querystring', 'assert', 'child_process',
      'cluster', 'dgram', 'dns', 'domain', 'net', 'readline', 'tls', 'tty',
      'vm', 'zlib', 'process', 'v8', 'worker_threads', 'perf_hooks'
    ]

    for (const module of allModules) {
      if (builtinModules.includes(module) || module.startsWith('node:')) {
        categorized.builtin.push(module)
      } else if (module.startsWith('.') || module.startsWith('/')) {
        categorized.local.push(module)
      } else if (module.startsWith('@') || /^[a-z0-9-]+$/.test(module)) {
        categorized.npm.push(module)
      } else {
        categorized.unknown.push(module)
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
      message: 'Dependências extraídas com sucesso'
    }
  } catch (error) {
    return {
      success: false,
      error: {
        message: (error as any).message,
        type: (error as any).name
      },
      message: 'Falha ao extrair dependências'
    }
  }
}
