import { tool } from '@opencode-ai/plugin/tool'
import vm from 'vm'

export default tool({
  description: 'Executa, valida e analisa código JavaScript em sandbox',
  args: {
    code: tool.schema.string().describe('Código JavaScript para executar/validar'),
    action: tool.schema
      .enum(['validate_syntax', 'check_style', 'execute'])
      .optional()
      .describe('Ação a executar: validate_syntax, check_style ou execute'),
    timeout: tool.schema
      .number()
      .optional()
      .describe('Timeout em ms para execução (padrão: 5000)'),
    sandbox: tool.schema
      .boolean()
      .optional()
      .describe('Executar em modo sandbox seguro (padrão: true)')
  },
  async execute(args) {
    const { code, action = 'validate_syntax', timeout = 5000, sandbox = true } = args

    try {
      switch (action) {
        case 'validate_syntax': {
          const result = await validateSyntax(code)
          return JSON.stringify(result)
        }
        case 'check_style': {
          const result = await checkStyle(code)
          return JSON.stringify(result)
        }
        case 'execute': {
          const result = await executeCode(code, timeout, sandbox)
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
          type: (error as any).name
        },
        message: 'Erro ao executar código'
      })
    }
  }
})

async function validateSyntax(code: string) {
  try {
    new vm.Script(code, {
      filename: 'validation.js'
    })

    return {
      valid: true,
      errors: [],
      message: 'Sintaxe válida'
    }
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          message: (error as any).message,
          stack: (error as any).stack,
          type: 'SyntaxError'
        }
      ],
      message: 'Validação de sintaxe falhou'
    }
  }
}

async function checkStyle(code: string) {
  const issues: any[] = []
  const lines = code.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Linha vazia no início/fim
    if ((i === 0 || i === lines.length - 1) && line.trim() === '') {
      issues.push({
        line: lineNum,
        type: 'empty-line',
        message: 'Linha vazia desnecessária no início/fim',
        severity: 'info'
      })
    }

    // Linha muito longa
    if (line.length > 120) {
      issues.push({
        line: lineNum,
        type: 'line-length',
        message: `Linha excede 120 caracteres (${line.length})`,
        severity: 'warning'
      })
    }

    // Trailing whitespace
    if (line.match(/\s+$/)) {
      issues.push({
        line: lineNum,
        type: 'trailing-whitespace',
        message: 'Linha tem espaço em branco ao final',
        severity: 'info'
      })
    }

    // Múltiplos espaços consecutivos
    if (line.match(/[^\s]\s{2,}[^\s]/)) {
      issues.push({
        line: lineNum,
        type: 'multiple-spaces',
        message: 'Múltiplos espaços consecutivos',
        severity: 'info'
      })
    }

    // Uso de var
    if (line.match(/\bvar\s+\w+/)) {
      issues.push({
        line: lineNum,
        type: 'var-usage',
        message: "Use 'let' ou 'const' em vez de 'var'",
        severity: 'suggestion'
      })
    }

    // == vs ===
    if (line.match(/[^=!]={2}[^=]|[^!]!={1}[^=]/)) {
      issues.push({
        line: lineNum,
        type: 'equality-operator',
        message: "Use '===' em vez de '==' para comparação",
        severity: 'warning'
      })
    }
  }

  // Análise global
  const consoleMatches = code.match(/console\.(log|debug|info|warn|error)/g)
  if (consoleMatches && consoleMatches.length > 5) {
    issues.push({
      type: 'console-statements',
      message: `Encontrados ${consoleMatches.length} statements console. Considere remover logs debug`,
      severity: 'suggestion'
    })
  }

  return {
    issues,
    issueCount: issues.length,
    summary: {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      suggestions: issues.filter(i => i.severity === 'suggestion').length,
      infos: issues.filter(i => i.severity === 'info').length
    },
    message: issues.length === 0 ? 'Nenhum problema de estilo encontrado' : `Encontrados ${issues.length} problema(s) de estilo`
  }
}

async function executeCode(code: string, timeout: number, useSandbox: boolean) {
  try {
    if (!useSandbox) {
      console.warn('AVISO: Executando código sem sandbox')
    }

    // Cria contexto sandbox
    const sandbox = {
      console: {
        log: (...args: any[]) => {
          console.log('[Code Output]', ...args)
        },
        error: (...args: any[]) => {
          console.error('[Code Error]', ...args)
        }
      },
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean
    }

    // Compila código
    const script = new vm.Script(code, {
      filename: 'execution.js'
    })

    // Executa com timeout
    const context = vm.createContext(sandbox)
    const result = script.runInContext(context, {
      timeout,
      breakOnSigint: true
    })

    return {
      success: true,
      result,
      output: result !== undefined ? String(result) : 'undefined',
      message: 'Código executado com sucesso'
    }
  } catch (error) {
    return {
      success: false,
      error: {
        message: (error as any).message,
        stack: (error as any).stack,
        type: (error as any).name
      },
      message: 'Falha na execução do código'
    }
  }
}
