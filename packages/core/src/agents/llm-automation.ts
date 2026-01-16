/**
 * LLM Automation Agent for ChatIAS 3.0
 * 
 * This agent understands natural language requests and automatically
 * uses available tools to accomplish tasks.
 */

import { BaseAgent, AgentConfig, ExecutionContext, ChatIASError } from './base/index.js';
import { Registry } from './types/index.js';
import { BaseTool } from './base/index.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// LLM AUTOMATION TYPES
// ============================================================================

export interface LLMAutomationConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  availableTools: string[];
  knowledgeBaseIds?: string[];
  contextLimit: number;
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<any>;
}

export interface LLMAction {
  tool: string;
  action: string;
  parameters: Record<string, any>;
}

export interface LLMExecutionResult {
  success: boolean;
  response: string;
  actions: LLMAction[];
  toolsUsed: string[];
  tokensUsed: number;
  duration: number;
  error?: string;
}

// ============================================================================
// LLM AUTOMATION AGENT
// ============================================================================

export class LLMAutomationAgent extends BaseAgent {
  private toolRegistry: Registry<BaseTool>;
  private llmTools: Map<string, LLMTool> = new Map();
  private config: LLMAutomationConfig;

  constructor(config: AgentConfig) {
    super(config);
    
    this.toolRegistry = new MapRegistry();
    this.config = {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 4000,
      systemPrompt: this.getDefaultSystemPrompt(),
      availableTools: [],
      contextLimit: 10,
      ...config.config
    };
  }

  /**
   * Register a tool for LLM automation
   */
  registerLLMTool(tool: LLMTool): void {
    this.llmTools.set(tool.name, tool);
    this.config.availableTools.push(tool.name);
  }

  /**
   * Execute natural language request
   */
  async execute(input: {
    prompt: string;
    context?: Record<string, any>;
    stream?: boolean;
  }, executionContext: ExecutionContext): Promise<LLMExecutionResult> {
    const startTime = Date.now();
    const actions: LLMAction[] = [];
    const toolsUsed: string[] = [];

    try {
      // Step 1: Parse the natural language request
      const parsedRequest = await this.parseRequest(input.prompt, input.context);
      
      // Step 2: Plan actions based on parsed request
      const plannedActions = await this.planActions(parsedRequest, input.context);
      
      // Step 3: Execute actions using available tools
      for (const action of plannedActions) {
        try {
          const result = await this.executeAction(action);
          actions.push(action);
          toolsUsed.push(action.tool);
        } catch (error: any) {
          console.error(`Failed to execute action ${action.tool}:${action.action}`, error);
        }
      }

      // Step 4: Generate final response
      const response = await this.generateResponse(actions, input.context);

      return {
        success: true,
        response,
        actions,
        toolsUsed: [...new Set(toolsUsed)],
        tokensUsed: this.estimateTokens(input.prompt + response),
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        success: false,
        response: '',
        actions,
        toolsUsed,
        tokensUsed: 0,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Parse natural language request to understand intent
   */
  private async parseRequest(
    prompt: string,
    context?: Record<string, any>
  ): Promise<{
    intent: string;
    entities: Record<string, any>;
    constraints: string[];
  }> {
    // In a real implementation, this would use the LLM to parse
    // For now, we'll use pattern matching
    
    const intent = this.detectIntent(prompt);
    const entities = this.extractEntities(prompt, intent);
    const constraints = this.extractConstraints(prompt);

    return { intent, entities, constraints };
  }

  /**
   * Detect user intent from natural language
   */
  private detectIntent(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('criar') || lowerPrompt.includes('create') || lowerPrompt.includes('novo')) {
      if (lowerPrompt.includes('tarefa') || lowerPrompt.includes('task') || lowerPrompt.includes('follow-up')) {
        return 'CREATE_TASK';
      }
      if (lowerPrompt.includes('contato') || lowerPrompt.includes('contact') || lowerPrompt.includes('lead')) {
        return 'CREATE_CONTACT';
      }
      if (lowerPrompt.includes('empresa') || lowerPrompt.includes('company') || lowerPrompt.includes('cliente')) {
        return 'CREATE_COMPANY';
      }
      if (lowerPrompt.includes('automação') || lowerPrompt.includes('automation') || lowerPrompt.includes('workflow')) {
        return 'CREATE_AUTOMATION';
      }
      return 'CREATE';
    }
    
    if (lowerPrompt.includes('listar') || lowerPrompt.includes('list') || lowerPrompt.includes('ver')) {
      return 'LIST';
    }
    
    if (lowerPrompt.includes('atualizar') || lowerPrompt.includes('update') || lowerPrompt.includes('modificar')) {
      return 'UPDATE';
    }
    
    if (lowerPrompt.includes('deletar') || lowerPrompt.includes('delete') || lowerPrompt.includes('remover')) {
      return 'DELETE';
    }
    
    if (lowerPrompt.includes('enviar') || lowerPrompt.includes('send') || lowerPrompt.includes('message')) {
      return 'SEND_MESSAGE';
    }
    
    if (lowerPrompt.includes('agendar') || lowerPrompt.includes('schedule') || lowerPrompt.includes('marcar')) {
      return 'SCHEDULE';
    }
    
    if (lowerPrompt.includes('resumir') || lowerPrompt.includes('summary') || lowerPrompt.includes('resumo')) {
      return 'SUMMARIZE';
    }
    
    return 'QUERY';
  }

  /**
   * Extract entities from prompt
   */
  private extractEntities(prompt: string, intent: string): Record<string, any> {
    const entities: Record<string, any> = {};
    
    // Extract dates
    const datePatterns = [
      /hoje/i,
      /amanhã/i,
      /semana que vem/i,
      /próxima (?:segunta|terça|quarta|quinta|sexta|sábado|domingo)/i,
      /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/
    ];
    
    for (const pattern of datePatterns) {
      if (pattern.test(prompt)) {
        entities.date = prompt.match(pattern)?.[0];
        break;
      }
    }
    
    // Extract names (simple heuristic)
    const namePattern = /para\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
    const nameMatch = prompt.match(namePattern);
    if (nameMatch) {
      entities.targetName = nameMatch[1];
    }
    
    // Extract priorities
    if (/urgente|urgency|emergency/i.test(prompt)) {
      entities.priority = 'URGENT';
    } else if (/alta|high|importante/i.test(prompt)) {
      entities.priority = 'HIGH';
    } else if (/baixa|low|menos importante/i.test(prompt)) {
      entities.priority = 'LOW';
    }
    
    return entities;
  }

  /**
   * Extract constraints from prompt
   */
  private extractConstraints(prompt: string): string[] {
    const constraints: string[] = [];
    
    if (/somente|m apenas|only/i.test(prompt)) {
      constraints.push('limit_results');
    }
    
    if (/hoje|today/i.test(prompt)) {
      constraints.push('filter_today');
    }
    
    if (/essa semana|this week/i.test(prompt)) {
      constraints.push('filter_this_week');
    }
    
    return constraints;
  }

  /**
   * Plan actions to accomplish the request
   */
  private async planActions(
    parsedRequest: { intent: string; entities: Record<string, any>; constraints: string[] },
    context?: Record<string, any>
  ): Promise<LLMAction[]> {
    const actions: LLMAction[] = [];
    const { intent, entities } = parsedRequest;

    switch (intent) {
      case 'CREATE_TASK':
        actions.push({
          tool: 'followups',
          action: 'create',
          parameters: {
            title: entities.targetName || 'Nova tarefa',
            type: 'TASK',
            priority: entities.priority || 'MEDIUM',
            dueDate: entities.date
          }
        });
        break;

      case 'CREATE_CONTACT':
        actions.push({
          tool: 'rdstation',
          action: 'createContact',
          parameters: {
            name: entities.targetName,
            // Other parameters would be extracted from prompt
          }
        });
        break;

      case 'CREATE_COMPANY':
        actions.push({
          tool: 'rdstation',
          action: 'createOrganization',
          parameters: {
            name: entities.targetName
          }
        });
        break;

      case 'SEND_MESSAGE':
        if (entities.targetName) {
          actions.push({
            tool: 'evolution',
            action: 'sendText',
            parameters: {
              phone: entities.targetPhone || entities.targetName,
              text: entities.message || 'Mensagem automática'
            }
          });
        }
        break;

      case 'SCHEDULE':
        actions.push({
          tool: 'followups',
          action: 'create',
          parameters: {
            title: entities.targetName || 'Compromisso',
            type: 'MEETING',
            dueDate: entities.date,
            description: entities.description
          }
        });
        break;

      case 'LIST':
        if (entities.type === 'tasks' || entities.type === 'tarefas') {
          actions.push({
            tool: 'followups',
            action: 'list',
            parameters: { status: 'PENDING' }
          });
        }
        break;

      default:
        // For unknown intents, try to use the best matching tool
        actions.push({
          tool: 'default',
          action: 'query',
          parameters: { prompt: context?.originalPrompt }
        });
    }

    return actions;
  }

  /**
   * Execute a single action using registered tools
   */
  private async executeAction(action: LLMAction): Promise<any> {
    const tool = this.llmTools.get(action.tool);
    
    if (!tool) {
      // Try to find tool in registry
      const registryTool = this.toolRegistry.get(action.tool);
      if (registryTool && typeof registryTool.execute === 'function') {
        return await registryTool.execute(action.action, action.parameters, {});
      }
      
      // Return mock response if no tool found
      console.warn(`Tool ${action.tool} not found, returning mock response`);
      return { success: true, tool: action.tool, action: action.action };
    }

    return await tool.handler(action.parameters);
  }

  /**
   * Generate natural language response
   */
  private async generateResponse(
    actions: LLMAction[],
    context?: Record<string, any>
  ): Promise<string> {
    if (actions.length === 0) {
      return 'Não foi possível identificar uma ação para executar. Por favor, reformule sua solicitação.';
    }

    const toolNames = [...new Set(actions.map(a => a.tool))];
    const actionDescriptions = actions.map(a => `${a.action} em ${a.tool}`);

    let response = `Executei ${actions.length} ação${actions.length > 1 ? 'ões' : ''}:\n`;
    
    for (const action of actions) {
      response += `- ${action.action} usando ${action.tool}\n`;
    }

    response += `\nAs ferramentas utilizadas foram: ${toolNames.join(', ')}.`;

    return response;
  }

  /**
   * Estimate token count (simplified)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get default system prompt for LLM automation
   */
  private getDefaultSystemPrompt(): string {
    return `Você é um assistente de automação inteligente do ChatIAS 3.0.
Sua função é entender solicitações em linguagem natural e executar ações automaticamente usando as ferramentas disponíveis.

Ferramentas disponíveis:
${Array.from(this.llmTools.values()).map(t => `- ${t.name}: ${t.description}`).join('\n')}

Quando receber uma solicitação:
1. Identifique a intenção do usuário
2. Extraia entidades relevantes (nomes, datas, prioridades)
3. Planeje as ações necessárias
4. Execute as ações usando as ferramentas
5. Retorne uma resposta clara em português

Sempre seja claro sobre o que foi feito e peça confirmação para ações destrutivas.`;
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    await super.initialize();
    
    // Register built-in tools
    this.registerLLMTool({
      name: 'followups',
      description: 'Gerenciar follow-ups e tarefas',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'list', 'update', 'complete'] },
          title: { type: 'string' },
          type: { type: 'string' },
          priority: { type: 'string' },
          dueDate: { type: 'string' },
          status: { type: 'string' }
        }
      },
      handler: async (params) => {
        // This would integrate with FollowUpRepository
        return { success: true, action: params.action, result: 'Follow-up created' };
      }
    });

    this.registerLLMTool({
      name: 'rdstation',
      description: 'Integração com RD Station CRM',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          company: { type: 'string' }
        }
      },
      handler: async (params) => {
        // This would integrate with RD Station API
        return { success: true, action: params.action, result: 'RD Station action executed' };
      }
    });

    this.registerLLMTool({
      name: 'evolution',
      description: 'Integração com WhatsApp Business',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['sendText', 'sendMedia', 'getMessages'] },
          phone: { type: 'string' },
          text: { type: 'string' }
        }
      },
      handler: async (params) => {
        // This would integrate with Evolution API
        return { success: true, action: params.action, result: 'WhatsApp message sent' };
      }
    });
  }

  /**
   * Get agent info
   */
  getAgentInfo(): Record<string, any> {
    return {
      name: this.name,
      type: 'llm_automation',
      description: 'Agente de automação inteligente que entende linguagem natural',
      capabilities: [
        ' 自然语言理解',
        ' 自动任务执行',
        ' 工具编排',
        ' 多步骤工作流'
      ],
      availableTools: this.config.availableTools,
      model: this.config.model
    };
  }
}

// ============================================================================
// MAP REGISTRY (Simple implementation)
// ============================================================================

class MapRegistry<T> implements Registry<T> {
  private map: Map<string, T> = new Map();

  register(id: string, component: T): void {
    this.map.set(id, component);
  }

  unregister(id: string): void {
    this.map.delete(id);
  }

  get(id: string): T | undefined {
    return this.map.get(id);
  }

  list(): Array<{ id: string; item: T }> {
    return Array.from(this.map.entries()).map(([id, item]) => ({ id, item }));
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { LLMAutomationAgent, LLMAutomationConfig, LLMAction, LLMAction as LLMTool };
