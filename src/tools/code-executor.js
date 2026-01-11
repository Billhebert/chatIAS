/**
 * CodeExecutor - Executa código JavaScript em sandbox
 *
 * Actions:
 * - validate_syntax: Valida sintaxe do código
 * - check_style: Verifica estilo do código
 * - execute: Executa código e retorna resultado
 */

import { BaseTool } from '../core/base-tool.js';
import vm from 'vm';

export class CodeExecutor extends BaseTool {
  /**
   * Execução padrão (validate_syntax)
   */
  async execute(params) {
    const { code, timeout = 5000, sandbox = true } = params;

    // Por padrão, valida sintaxe
    return await this.action_validate_syntax({ code, timeout });
  }

  /**
   * Action: validate_syntax
   * Valida sintaxe JavaScript
   */
  async action_validate_syntax(params) {
    const { code, timeout = 5000 } = params;

    this.log('Validating JavaScript syntax');

    try {
      // Tenta compilar o código
      new vm.Script(code, {
        filename: 'validation.js',
        displayErrors: true
      });

      return {
        valid: true,
        errors: [],
        message: 'Syntax is valid'
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          message: error.message,
          stack: error.stack,
          type: 'SyntaxError'
        }],
        message: 'Syntax validation failed'
      };
    }
  }

  /**
   * Action: check_style
   * Verifica estilo do código (análise estática básica)
   */
  async action_check_style(params) {
    const { code } = params;

    this.log('Checking code style');

    const issues = [];
    const lines = code.split('\n');

    // Verificações básicas de estilo
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Linha vazia no início/fim
      if ((i === 0 || i === lines.length - 1) && line.trim() === '') {
        issues.push({
          line: lineNum,
          type: 'empty-line',
          message: 'Unnecessary empty line at start/end',
          severity: 'info'
        });
      }

      // Linha muito longa
      if (line.length > 120) {
        issues.push({
          line: lineNum,
          type: 'line-length',
          message: `Line exceeds 120 characters (${line.length})`,
          severity: 'warning'
        });
      }

      // Trailing whitespace
      if (line.match(/\s+$/)) {
        issues.push({
          line: lineNum,
          type: 'trailing-whitespace',
          message: 'Line has trailing whitespace',
          severity: 'info'
        });
      }

      // Múltiplos espaços consecutivos
      if (line.match(/[^\s]\s{2,}[^\s]/)) {
        issues.push({
          line: lineNum,
          type: 'multiple-spaces',
          message: 'Multiple consecutive spaces',
          severity: 'info'
        });
      }

      // Uso de var
      if (line.match(/\bvar\s+\w+/)) {
        issues.push({
          line: lineNum,
          type: 'var-usage',
          message: "Use 'let' or 'const' instead of 'var'",
          severity: 'suggestion'
        });
      }

      // Falta de ponto e vírgula (heurística básica)
      if (line.match(/^\s*(const|let|var|return)\s+.+[^;{}\s]$/)) {
        issues.push({
          line: lineNum,
          type: 'missing-semicolon',
          message: 'Statement might be missing semicolon',
          severity: 'suggestion'
        });
      }

      // == ao invés de ===
      if (line.match(/[^=!]={2}[^=]|[^!]!={1}[^=]/)) {
        issues.push({
          line: lineNum,
          type: 'equality-operator',
          message: "Use '===' instead of '==' for comparison",
          severity: 'warning'
        });
      }
    }

    // Análise global
    // Console.log statements
    const consoleMatches = code.match(/console\.(log|debug|info|warn|error)/g);
    if (consoleMatches && consoleMatches.length > 5) {
      issues.push({
        type: 'console-statements',
        message: `Found ${consoleMatches.length} console statements. Consider removing debug logs`,
        severity: 'suggestion'
      });
    }

    // Funções muito longas (heurística básica)
    const functionMatches = code.match(/function\s+\w+\s*\([^)]*\)\s*{/g);
    if (functionMatches) {
      // Análise simplificada - em produção usaria AST parser
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
      message: issues.length === 0 ? 'No style issues found' : `Found ${issues.length} style issue(s)`
    };
  }

  /**
   * Action: execute
   * Executa código JavaScript em sandbox
   */
  async action_execute(params) {
    const { code, timeout = 5000, sandbox: useSandbox = true } = params;

    this.log('Executing JavaScript code');

    if (!useSandbox) {
      this.log('WARNING: Executing code without sandbox', 'warn');
    }

    try {
      // Cria contexto sandbox
      const sandbox = {
        console: {
          log: (...args) => {
            this.log(`[Code Output] ${args.join(' ')}`, 'info');
          },
          error: (...args) => {
            this.log(`[Code Error] ${args.join(' ')}`, 'error');
          }
        },
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        // Adiciona Math, Date, JSON, etc
        Math,
        Date,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean
      };

      // Compila código
      const script = new vm.Script(code, {
        filename: 'execution.js',
        displayErrors: true
      });

      // Executa com timeout
      const context = vm.createContext(sandbox);

      const result = script.runInContext(context, {
        timeout,
        displayErrors: true,
        breakOnSigint: true
      });

      return {
        success: true,
        result,
        output: result !== undefined ? String(result) : 'undefined',
        message: 'Code executed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          stack: error.stack,
          type: error.name
        },
        message: 'Code execution failed'
      };
    }
  }

  /**
   * Lifecycle: Inicialização
   */
  async onInit() {
    this.log('CodeExecutor initialized');

    // Verifica se vm está disponível
    if (!vm) {
      this.log('WARNING: vm module not available, execution will be limited', 'warn');
    }
  }

  /**
   * Lifecycle: Destruição
   */
  async onDestroy() {
    this.log('CodeExecutor destroyed');
  }
}

export default CodeExecutor;
