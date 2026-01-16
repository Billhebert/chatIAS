/**
 * Exemplo de Agente Usando o Sistema Modular
 * 
 * Este exemplo mostra como um agente usa as dependências
 * injetadas dinamicamente pelo SystemLoader.
 */

import { BaseAgent, AgentResult, ExecutionContext, Registry } from '@chatias/core';

/**
 * Code Analyzer Agent - Exemplo completo
 */
export class CodeAnalyzerAgent extends BaseAgent {
  // Dependências injetadas pelo SystemLoader
  private toolRegistry: Registry<any>;
  private mcpRegistry: Registry<any>;
  private kbRegistry: Registry<any>;

  constructor(config: any) {
    super(config);
  }

  // Métodos de injeção (chamados pelo SystemLoader)
  setToolRegistry(registry: Registry<any>): void {
    this.toolRegistry = registry;
  }

  setMcpRegistry(registry: Registry<any>): void {
    this.mcpRegistry = registry;
  }

  setKnowledgeBaseRegistry(registry: Registry<any>): void {
    this.kbRegistry = registry;
  }

  /**
   * Validação de input (obrigatório da BaseAgent)
   */
  protected async validateInput(input: any): Promise<any> {
    if (!input || !input.code) {
      throw new Error('Código é obrigatório para análise');
    }
    return {
      code: input.code,
      language: input.language || 'javascript',
      depth: input.depth || 'standard'
    };
  }

  /**
   * Execução principal do agente (obrigatório da BaseAgent)
   */
  protected async onExecute(input: any, context?: ExecutionContext): Promise<any> {
    this.log('Iniciando análise de código', 'info', { 
      language: input.language,
      codeLength: input.code.length 
    });

    try {
      // 🛠️ Usar ferramenta injetada (NOVA FUNCIONALIDADE!)
      const codeExecutor = this.toolRegistry.get('code_executor');
      if (!codeExecutor) {
        throw new Error('Tool code_executor não encontrada');
      }

      // Validar sintaxe
      const syntaxResult = await codeExecutor.execute('validate_syntax', {
        code: input.code,
        timeout: 5000
      }, context);

      if (!syntaxResult.success) {
        return {
          valid: false,
          error: syntaxResult.error,
          analysis: null
        };
      }

      // 📚 Usar knowledge base injetada (NOVA FUNCIONALIDADE!)
      const jsSyntaxKB = this.kbRegistry.get('js_syntax');
      if (jsSyntaxKB) {
        const kbResults = await jsSyntaxKB.search(input.language, {
          topK: 3,
          scoreThreshold: 0.7
        });

        this.log(`Encontrados ${kbResults.results?.length || 0} patterns na KB`, 'info');
      }

      // 🤖 Usar MCP injetado (NOVA FUNCIONALIDADE!)
      const ollamaMCP = this.mcpRegistry.get('mcp_ollama');
      if (ollamaMCP) {
        const semanticAnalysis = await ollamaMCP.execute('analyze', {
          prompt: `Analise este código: ${input.code}`,
          model: 'mistral:latest',
          temperature: 0.3
        }, context);

        if (semanticAnalysis.success) {
          this.log('Análise semântica concluída', 'info');
        }
      }

      return {
        valid: true,
        syntax: syntaxResult.data,
        analysis: semanticAnalysis.content,
        language: input.language,
        metadata: {
          lines: input.code.split('\n').length,
          characters: input.code.length,
          complexity: this.calculateComplexity(input.code)
        }
      };

    } catch (error) {
      this.log(`Erro na análise: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Hook de inicialização (opcional)
   */
  protected async onInit(): Promise<void> {
    this.log('CodeAnalyzerAgent inicializado', 'info', {
      version: this.config.version,
      capabilities: this.config.capabilities
    });
  }

  /**
   * Hook de destruição (opcional)
   */
  protected async onDestroy(): Promise<void> {
    this.log('CodeAnalyzerAgent destruído', 'info');
  }

  /**
   * Calcula complexidade do código (método auxiliar)
   */
  private calculateComplexity(code: string): number {
    // Lógica simples de complexidade
    const lines = code.split('\n').length;
    const functions = (code.match(/function\s+\w+/g) || []).length;
    const loops = (code.match(/for\s*\(|while\s*\(/g) || []).length;
    const conditionals = (code.match(/if\s*\(/g) || []).length;
    
    return Math.floor((lines * 0.1) + (functions * 2) + (loops * 3) + (conditionals * 1));
  }
}

/**
 * Factory para criar agentes (padrão modular)
 */
export function createCodeAnalyzer(config: any) {
  return new CodeAnalyzerAgent(config);
}