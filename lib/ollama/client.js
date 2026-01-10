/**
 * Cliente Ollama para modelos locais como fallback
 * @module lib/ollama/client
 */

export class OllamaClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || "http://localhost:11434";
    this.models = config.models || ["llama3.2", "qwen2.5-coder", "deepseek-coder-v2"];
    this.timeout = config.timeout || 30000;
    this.currentModelIndex = 0;
  }

  /**
   * Verifica se o Ollama está disponível
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.warn("Ollama não está disponível:", error.message);
      return false;
    }
  }

  /**
   * Lista modelos disponíveis no Ollama
   * @returns {Promise<Array>}
   */
  async listModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error("Erro ao listar modelos Ollama:", error);
      return [];
    }
  }

  /**
   * Gera uma resposta usando um modelo Ollama
   * @param {string} model - Nome do modelo
   * @param {string} prompt - Prompt para o modelo
   * @param {Object} options - Opções adicionais
   * @returns {Promise<Object>}
   */
  async generate(model, prompt, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
            top_k: options.top_k || 40,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        model: model,
        response: data.response,
        done: data.done,
        context: data.context,
        metadata: {
          total_duration: data.total_duration,
          load_duration: data.load_duration,
          prompt_eval_count: data.prompt_eval_count,
          eval_count: data.eval_count,
        },
      };
    } catch (error) {
      return {
        success: false,
        model: model,
        error: error.message,
      };
    }
  }

  /**
   * Gera resposta com fallback automático entre modelos
   * @param {string} prompt - Prompt para o modelo
   * @param {Object} options - Opções adicionais
   * @returns {Promise<Object>}
   */
  async generateWithFallback(prompt, options = {}) {
    // Verifica se Ollama está disponível
    const available = await this.isAvailable();
    if (!available) {
      return {
        success: false,
        error: "Ollama não está disponível. Certifique-se de que está rodando.",
      };
    }

    // Tenta cada modelo configurado
    for (let i = 0; i < this.models.length; i++) {
      const model = this.models[i];
      console.log(`🦙 Tentando Ollama com modelo: ${model} (${i + 1}/${this.models.length})`);

      const result = await this.generate(model, prompt, options);

      if (result.success) {
        console.log(`✅ Ollama respondeu com sucesso usando ${model}`);
        return result;
      }

      console.log(`❌ Modelo ${model} falhou: ${result.error}`);
    }

    // Todos os modelos falharam
    return {
      success: false,
      error: "Todos os modelos Ollama falharam",
      attempts: this.models.length,
    };
  }

  /**
   * Gera resposta em formato de chat
   * @param {Array} messages - Array de mensagens no formato [{role: "user"|"assistant", content: "..."}]
   * @param {string} model - Nome do modelo (opcional)
   * @param {Object} options - Opções adicionais
   * @returns {Promise<Object>}
   */
  async chat(messages, model = null, options = {}) {
    const selectedModel = model || this.models[0];

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: messages,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.9,
          },
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        model: selectedModel,
        message: data.message,
        done: data.done,
      };
    } catch (error) {
      return {
        success: false,
        model: selectedModel,
        error: error.message,
      };
    }
  }
}

/**
 * Cria uma instância do cliente Ollama
 * @param {Object} config - Configuração do cliente
 * @returns {OllamaClient}
 */
export function createOllamaClient(config = {}) {
  return new OllamaClient(config);
}
