/**
 * OllamaMCPProvider - Provider local para Ollama
 *
 * Executa modelos LLM localmente via Ollama
 * - Privacidade total (local)
 * - Sem custos
 * - Rápido
 * - Fallback automático para OpenAI se configurado
 */

import { BaseMCP } from '../core/base-mcp.js';

export class OllamaMCPProvider extends BaseMCP {
  /**
   * Conecta ao Ollama
   */
  async connect() {
    this.log('Connecting to Ollama...');

    try {
      // Testa conexão fazendo uma requisição à API
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const data = await response.json();

      this.log(`Connected to Ollama. Available models: ${data.models?.length || 0}`);

      // Atualiza modelos disponíveis
      if (data.models && Array.isArray(data.models)) {
        for (const model of data.models) {
          if (!this.models.has(model.name)) {
            this.models.set(model.name, {
              id: model.name,
              name: model.name,
              contextWindow: 4096, // Default
              speed: 'fast',
              quality: 'medium'
            });
          }
        }
      }

      return true;
    } catch (error) {
      this.log(`Failed to connect to Ollama: ${error.message}`, 'warn');
      this.log('Ollama is not available. Will use fallback if configured.', 'info');
      return false; // Don't throw, just return false
    }
  }

  /**
   * Desconecta do Ollama
   */
  async disconnect() {
    this.log('Disconnecting from Ollama');
    this.connected = false;
  }

  /**
   * Verifica saúde do Ollama
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}${this.healthCheck.endpoint}`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.healthCheck.timeout)
      });

      return response.ok;
    } catch (error) {
      this.log(`Health check failed: ${error.message}`, 'warn');
      return false;
    }
  }

  /**
   * Executa ação no Ollama
   */
  async execute(action, params) {
    switch (action) {
      case 'generate':
        return await this.generate(params);

      case 'chat':
        return await this.chat(params);

      case 'analyze':
        return await this.analyze(params);

      case 'list':
        return await this.listModels();

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Gera texto com Ollama
   */
  async generate(params) {
    const {
      prompt,
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 4000,
      stream = false
    } = params;

    this.log(`Generating with model: ${model}`);

    try {
      const requestBody = {
        model,
        prompt,
        stream: false, // Sempre false para simplificar
        options: {
          temperature,
          num_predict: maxTokens
        }
      };

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        success: true,
        response: data.response,
        model: data.model,
        context: data.context,
        stats: {
          totalDuration: data.total_duration,
          loadDuration: data.load_duration,
          promptEvalCount: data.prompt_eval_count,
          evalCount: data.eval_count,
          evalDuration: data.eval_duration
        },
        message: 'Generation completed successfully'
      };
    } catch (error) {
      this.log(`Generate failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Chat com Ollama
   */
  async chat(params) {
    const {
      messages,
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 4000
    } = params;

    this.log(`Chat with model: ${model}`);

    try {
      const requestBody = {
        model,
        messages,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens
        }
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return {
        success: true,
        message: data.message,
        model: data.model,
        stats: {
          totalDuration: data.total_duration,
          loadDuration: data.load_duration,
          promptEvalCount: data.prompt_eval_count,
          evalCount: data.eval_count
        },
        messageText: 'Chat completed successfully'
      };
    } catch (error) {
      this.log(`Chat failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Analisa código usando LLM
   */
  async analyze(params) {
    const {
      prompt,
      model = this.defaultModel,
      temperature = 0.3,
      maxTokens = 2000
    } = params;

    this.log('Performing analysis with LLM');

    // Use generate for analysis
    return await this.generate({
      prompt,
      model,
      temperature,
      maxTokens
    });
  }

  /**
   * Lista modelos disponíveis
   */
  async listModels() {
    if (!this.connected) {
      return {
        success: false,
        models: [],
        count: 0,
        message: 'Ollama is not connected'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        models: data.models || [],
        count: data.models?.length || 0,
        message: 'Models listed successfully'
      };
    } catch (error) {
      this.log(`List models failed: ${error.message}`, 'warn');
      return {
        success: false,
        models: [],
        count: 0,
        message: error.message
      };
    }
  }

  /**
   * Lifecycle: Inicialização
   */
  async onInit() {
    this.log('OllamaMCPProvider initialized');
  }

  /**
   * Lifecycle: Destruição
   */
  async onDestroy() {
    this.log('OllamaMCPProvider destroyed');
  }
}

export default OllamaMCPProvider;
