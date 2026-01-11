/**
 * CodeAnalyzerAgent - Analisa código-fonte
 *
 * Capabilities:
 * - Análise de sintaxe
 * - Verificação de estilo
 * - Detecção de dependências
 * - Análise semântica com LLM
 */

import { BaseAgent } from '../core/base-agent.js';

/**
 * CodeAnalyzerAgent - Agente principal
 */
export class CodeAnalyzerAgent extends BaseAgent {
  async execute(input) {
    const { code, language = 'javascript', depth = 'standard' } = input;

    this.log(`Analyzing ${language} code (depth: ${depth})`);

    const results = {
      language,
      depth,
      syntaxValid: false,
      styleIssues: [],
      dependencies: [],
      semanticAnalysis: null,
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Validação de sintaxe usando subagente ou tool
      this.log('Validating syntax...', 'debug');

      if (this.subagents.has('syntax_checker')) {
        const syntaxResult = await this.callSubagent('syntax_checker', { code, language });
        results.syntaxValid = syntaxResult.valid;
        results.syntaxErrors = syntaxResult.errors || [];
      } else if (this.availableTools.find(t => t.id === 'code_executor')) {
        const syntaxResult = await this.useTool('code_executor', { code, action: 'validate_syntax' });
        results.syntaxValid = syntaxResult.valid;
        results.syntaxErrors = syntaxResult.errors || [];
      } else {
        // Fallback: validação simples
        results.syntaxValid = true;
        results.syntaxErrors = [];
        this.log('No syntax checker available, assuming valid', 'warn');
      }

      // 2. Verificação de estilo
      if (depth !== 'basic') {
        this.log('Checking code style...', 'debug');

        if (this.subagents.has('code_formatter')) {
          const styleResult = await this.callSubagent('code_formatter', { code, language });
          results.styleIssues = styleResult.issues || [];
        }
      }

      // 3. Análise de dependências
      if (depth !== 'basic') {
        this.log('Analyzing dependencies...', 'debug');

        if (this.subagents.has('dependency_analyzer')) {
          const depsResult = await this.callSubagent('dependency_analyzer', { code, language });
          results.dependencies = depsResult.dependencies || [];
        } else if (this.availableTools.find(t => t.id === 'file_reader')) {
          // Usa tool para extrair dependências
          const depsResult = await this.useTool('file_reader', { code, action: 'extract_dependencies' });
          results.dependencies = depsResult.dependencies || [];
        }
      }

      // 4. Análise semântica com LLM (apenas em modo deep)
      if (depth === 'deep' && this.mcpProviders.size > 0) {
        this.log('Performing semantic analysis with LLM...', 'debug');

        try {
          // Tenta usar Ollama primeiro (local)
          const mcpId = this.mcpConfig.optional?.[0] || 'mcp_ollama';
          const mcp = this.mcpProviders.get(mcpId);

          if (mcp && mcp.enabled && mcp.connected) {
            const prompt = `Analyze this ${language} code for patterns, potential issues, and improvements:\n\n${code}`;

            const llmResult = await this.useMCP(mcpId, 'analyze', {
              prompt,
              model: mcp.defaultModel,
              temperature: 0.3,
              maxTokens: 2000
            });

            results.semanticAnalysis = llmResult;
          }
        } catch (error) {
          this.log(`Semantic analysis failed: ${error.message}`, 'warn');
          results.semanticAnalysis = { error: error.message };
        }
      }

      // 5. Consulta knowledge base para padrões conhecidos
      if (this.knowledgeBase.size > 0) {
        this.log('Querying knowledge base...', 'debug');

        try {
          const kbId = language === 'javascript' ? 'js_syntax' : 'patterns';
          if (this.knowledgeBase.has(kbId)) {
            const kbResults = await this.queryKnowledgeBase(kbId, {
              type: 'patterns',
              code
            });
            results.knownPatterns = kbResults;
          }
        } catch (error) {
          this.log(`KB query failed: ${error.message}`, 'warn');
        }
      }

      results.success = true;
      results.summary = this.generateSummary(results);

      return results;
    } catch (error) {
      this.log(`Analysis failed: ${error.message}`, 'error');
      results.success = false;
      results.error = error.message;
      return results;
    }
  }

  /**
   * Gera resumo da análise
   */
  generateSummary(results) {
    const summary = {
      status: results.syntaxValid ? 'valid' : 'invalid',
      issuesCount: (results.syntaxErrors?.length || 0) + (results.styleIssues?.length || 0),
      dependenciesCount: results.dependencies?.length || 0,
      hasSemanticAnalysis: !!results.semanticAnalysis
    };

    return summary;
  }
}

/**
 * SyntaxCheckerAgent - Subagente para validação de sintaxe
 */
export class SyntaxCheckerAgent extends BaseAgent {
  async execute(input) {
    const { code, language = 'javascript' } = input;

    this.log(`Checking syntax for ${language}`);

    try {
      // Validação básica: tenta parsear o código
      if (language === 'javascript') {
        // Em produção, usaria um parser real como @babel/parser
        new Function(code); // Valida sintaxe JS básica

        return {
          valid: true,
          errors: [],
          language
        };
      }

      // Para outras linguagens, retorna válido por padrão
      return {
        valid: true,
        errors: [],
        language,
        warning: 'Validation not implemented for this language'
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          message: error.message,
          type: 'SyntaxError'
        }],
        language
      };
    }
  }
}

/**
 * CodeFormatterAgent - Subagente para verificação de estilo
 */
export class CodeFormatterAgent extends BaseAgent {
  async execute(input) {
    const { code, language = 'javascript' } = input;

    this.log(`Checking code style for ${language}`);

    const issues = [];

    // Verificações básicas de estilo
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Linha muito longa
      if (line.length > 120) {
        issues.push({
          line: i + 1,
          type: 'line-length',
          message: `Line exceeds 120 characters (${line.length} chars)`,
          severity: 'warning'
        });
      }

      // Trailing whitespace
      if (line.endsWith(' ') || line.endsWith('\t')) {
        issues.push({
          line: i + 1,
          type: 'trailing-whitespace',
          message: 'Line has trailing whitespace',
          severity: 'info'
        });
      }

      // Tab usage (preferir spaces)
      if (line.includes('\t')) {
        issues.push({
          line: i + 1,
          type: 'tab-character',
          message: 'Use spaces instead of tabs',
          severity: 'info'
        });
      }
    }

    // Verificar uso de var (preferir let/const)
    if (language === 'javascript') {
      const varMatches = code.match(/\bvar\s+\w+/g);
      if (varMatches) {
        issues.push({
          type: 'var-usage',
          message: `Found ${varMatches.length} usage(s) of 'var'. Consider using 'let' or 'const'`,
          severity: 'suggestion'
        });
      }
    }

    return {
      language,
      issues,
      issuesCount: issues.length,
      summary: {
        warnings: issues.filter(i => i.severity === 'warning').length,
        infos: issues.filter(i => i.severity === 'info').length,
        suggestions: issues.filter(i => i.severity === 'suggestion').length
      }
    };
  }
}

/**
 * DependencyAnalyzerAgent - Subagente para análise de dependências
 */
export class DependencyAnalyzerAgent extends BaseAgent {
  async execute(input) {
    const { code, language = 'javascript' } = input;

    this.log(`Analyzing dependencies for ${language}`);

    const dependencies = [];

    if (language === 'javascript') {
      // Extrai imports ES6
      const importMatches = code.matchAll(/import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        dependencies.push({
          type: 'import',
          module: match[1],
          statement: match[0]
        });
      }

      // Extrai requires CommonJS
      const requireMatches = code.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const match of requireMatches) {
        dependencies.push({
          type: 'require',
          module: match[1],
          statement: match[0]
        });
      }

      // Extrai dynamic imports
      const dynamicMatches = code.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const match of dynamicMatches) {
        dependencies.push({
          type: 'dynamic-import',
          module: match[1],
          statement: match[0]
        });
      }
    }

    // Agrupa por tipo
    const grouped = {
      npm: dependencies.filter(d => !d.module.startsWith('.') && !d.module.startsWith('/')),
      local: dependencies.filter(d => d.module.startsWith('.') || d.module.startsWith('/')),
      builtin: dependencies.filter(d => ['fs', 'path', 'http', 'https', 'crypto', 'util'].includes(d.module))
    };

    return {
      language,
      dependencies,
      totalCount: dependencies.length,
      grouped,
      summary: {
        npm: grouped.npm.length,
        local: grouped.local.length,
        builtin: grouped.builtin.length
      }
    };
  }
}
