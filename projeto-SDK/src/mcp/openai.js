/**
 * OpenAIMCPProvider - Provider cloud para OpenAI
 *
 * Acesso a GPT-4 e outros modelos via OpenAI API
 * - Usado como fallback quando Ollama falha
 * - Requer API key
 * - Tem custos associados
 */

import { BaseMCP } from '../core/base-mcp.js';

export class OpenAIMCPProvider extends BaseMCP {
  /**
   * Conecta ao OpenAI
   */
  async connect() {
    this.log('Connecting to OpenAI...');

    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Testa conexão listando modelos
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      this.log(`Connected to OpenAI. Available models: ${data.data?.length || 0}`);

      return true;
    } catch (error) {
      this.log(`Failed to connect to OpenAI: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Desconecta do OpenAI
   */
  async disconnect() {
    this.log('Disconnecting from OpenAI');
    this.connected = false;
  }

  /**
   * Verifica saúde do OpenAI
   */
  async checkHealth() {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: AbortSignal.timeout(this.healthCheck.timeout || 5000)
      });

      return response.ok;
    } catch (error) {
      this.log(`Health check failed: ${error.message}`, 'warn');
      return false;
    }
  }

  /**
   * Executa ação no OpenAI
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
   * Gera texto com OpenAI (usando chat completion)
   */
  async generate(params) {
    const {
      prompt,
      model = this.defaultModel || 'gpt-3.5-turbo',
      temperature = 0.7,
      maxTokens = 4000
    } = params;

    this.log(`Generating with model: ${model}`);

    try {
      const requestBody = {
        model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature,
        max_tokens: maxTokens
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      return {
        success: true,
        response: data.choices[0]?.message?.content || '',
        model: data.model,
        usage: data.usage,
        finishReason: data.choices[0]?.finish_reason,
        message: 'Generation completed successfully'
      };
    } catch (error) {
      this.log(`Generate failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Chat com OpenAI
   */
  async chat(params) {
    const {
      messages,
      model = this.defaultModel || 'gpt-3.5-turbo',
      temperature = 0.7,
      maxTokens = 4000
    } = params;

    this.log(`Chat with model: ${model}`);

    try {
      const requestBody = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      return {
        success: true,
        message: data.choices[0]?.message,
        model: data.model,
        usage: data.usage,
        finishReason: data.choices[0]?.finish_reason,
        messageText: 'Chat completed successfully'
      };
    } catch (error) {
      this.log(`Chat failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Analisa código usando GPT
   */
  async analyze(params) {
    const {
      prompt,
      model = this.defaultModel || 'gpt-3.5-turbo',
      temperature = 0.3,
      maxTokens = 2000
    } = params;

    this.log('Performing analysis with GPT');

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
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      const data = await response.json();

      // Filtra apenas modelos relevantes (gpt-*)
      const gptModels = data.data.filter(m => m.id.startsWith('gpt-'));

      return {
        success: true,
        models: gptModels,
        count: gptModels.length,
        message: 'Models listed successfully'
      };
    } catch (error) {
      this.log(`List models failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Lifecycle: Inicialização
   */
  async onInit() {
    this.log('OpenAIMCPProvider initialized');

    if (!this.apiKey) {
      this.log('WARNING: OpenAI API key not configured. This provider will not work.', 'warn');
    }
  }

  /**
   * Lifecycle: Destruição
   */
  async onDestroy() {
    this.log('OpenAIMCPProvider destroyed');
  }
}

export default OpenAIMCPProvider;
