/**
 * ConfigValidator - Valida configuração do sistema contra o schema JSON
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega schema
const schemaPath = path.join(__dirname, 'config-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

// Cria validador
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false
});
addFormats(ajv);

// Compila schema
const validate = ajv.compile(schema);

/**
 * Valida configuração do sistema
 * @param {object} config - Configuração a ser validada
 * @returns {object} - { valid: boolean, errors: array }
 */
export function validateConfig(config) {
  const valid = validate(config);

  if (!valid) {
    return {
      valid: false,
      errors: validate.errors.map(err => ({
        path: err.instancePath || err.dataPath || 'root',
        message: err.message,
        keyword: err.keyword,
        params: err.params,
        data: err.data
      }))
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Valida e lança erro se inválido
 * @param {object} config - Configuração a ser validada
 * @throws {Error} Se configuração for inválida
 */
export function validateConfigStrict(config) {
  const result = validateConfig(config);

  if (!result.valid) {
    const errorMessages = result.errors
      .map(err => `  - ${err.path}: ${err.message}`)
      .join('\n');

    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }

  return true;
}

/**
 * Valida referências cruzadas (ex: agent usa tool que não existe)
 * @param {object} config - Configuração a ser validada
 * @returns {object} - { valid: boolean, errors: array }
 */
export function validateCrossReferences(config) {
  const errors = [];

  // Cria sets de IDs
  const agentIds = new Set(Object.keys(config.agents || {}));
  const toolIds = new Set(Object.keys(config.tools || {}));
  const kbIds = new Set(Object.keys(config.knowledgeBase || {}));
  const mcpIds = new Set(Object.keys(config.mcp || {}));
  const sequenceIds = new Set(Object.keys(config.toolSequences || {}));

  // Valida agentes
  for (const [agentId, agent] of Object.entries(config.agents || {})) {
    // Valida tools
    if (agent.tools) {
      for (const tool of agent.tools) {
        const toolId = typeof tool === 'string' ? tool : tool.id;
        if (!toolIds.has(toolId)) {
          errors.push({
            type: 'missing_tool',
            agent: agentId,
            tool: toolId,
            message: `Agent '${agentId}' references non-existent tool '${toolId}'`
          });
        }
      }
    }

    // Valida knowledge base
    if (agent.knowledgeBase) {
      for (const kb of agent.knowledgeBase) {
        const kbId = typeof kb === 'string' ? kb : kb.id;
        if (!kbIds.has(kbId)) {
          errors.push({
            type: 'missing_kb',
            agent: agentId,
            kb: kbId,
            message: `Agent '${agentId}' references non-existent knowledge base '${kbId}'`
          });
        }
      }
    }

    // Valida MCP
    if (agent.mcp?.optional) {
      for (const mcpId of agent.mcp.optional) {
        if (!mcpIds.has(mcpId)) {
          errors.push({
            type: 'missing_mcp',
            agent: agentId,
            mcp: mcpId,
            message: `Agent '${agentId}' references non-existent MCP provider '${mcpId}'`
          });
        }
      }
    }

    // Valida tool sequences
    if (agent.toolSequences) {
      for (const seq of agent.toolSequences) {
        const sequenceId = typeof seq === 'string' ? seq : seq.sequence;
        if (!sequenceIds.has(sequenceId)) {
          errors.push({
            type: 'missing_sequence',
            agent: agentId,
            sequence: sequenceId,
            message: `Agent '${agentId}' references non-existent tool sequence '${sequenceId}'`
          });
        }
      }
    }

    // Valida subagents (verifica se as classes existem na config)
    if (agent.subagents) {
      for (const subagent of agent.subagents) {
        const subagentClass = typeof subagent === 'string' ? subagent : subagent.class;
        // Nota: validação de classe requer verificar se o arquivo existe, feito em runtime
      }
    }
  }

  // Valida tool sequences
  for (const [seqId, sequence] of Object.entries(config.toolSequences || {})) {
    for (const step of sequence.steps || []) {
      // Valida tool
      if (step.tool && !toolIds.has(step.tool)) {
        errors.push({
          type: 'missing_tool',
          sequence: seqId,
          tool: step.tool,
          message: `Tool sequence '${seqId}' references non-existent tool '${step.tool}'`
        });
      }

      // Valida MCP
      if (step.mcp && !mcpIds.has(step.mcp)) {
        errors.push({
          type: 'missing_mcp',
          sequence: seqId,
          mcp: step.mcp,
          message: `Tool sequence '${seqId}' references non-existent MCP provider '${step.mcp}'`
        });
      }

      // Valida fallback MCP
      if (step.fallbackMCP && !mcpIds.has(step.fallbackMCP)) {
        errors.push({
          type: 'missing_mcp',
          sequence: seqId,
          mcp: step.fallbackMCP,
          message: `Tool sequence '${seqId}' references non-existent fallback MCP provider '${step.fallbackMCP}'`
        });
      }
    }
  }

  // Valida MCP fallbacks
  for (const [mcpId, mcp] of Object.entries(config.mcp || {})) {
    if (mcp.fallback && !mcpIds.has(mcp.fallback)) {
      errors.push({
        type: 'missing_mcp',
        mcp: mcpId,
        fallback: mcp.fallback,
        message: `MCP provider '${mcpId}' references non-existent fallback '${mcp.fallback}'`
      });
    }
  }

  // Valida knowledge base usedBy
  for (const [kbId, kb] of Object.entries(config.knowledgeBase || {})) {
    if (kb.usedBy) {
      for (const agentId of kb.usedBy) {
        if (!agentIds.has(agentId)) {
          errors.push({
            type: 'missing_agent',
            kb: kbId,
            agent: agentId,
            message: `Knowledge base '${kbId}' references non-existent agent '${agentId}'`
          });
        }
      }
    }
  }

  // Valida tools requiredBy
  for (const [toolId, tool] of Object.entries(config.tools || {})) {
    if (tool.requiredBy) {
      for (const agentId of tool.requiredBy) {
        if (!agentIds.has(agentId)) {
          errors.push({
            type: 'missing_agent',
            tool: toolId,
            agent: agentId,
            message: `Tool '${toolId}' references non-existent agent '${agentId}'`
          });
        }
      }
    }

    // Valida conflictsWith
    if (tool.conflictsWith) {
      for (const conflictToolId of tool.conflictsWith) {
        if (!toolIds.has(conflictToolId)) {
          errors.push({
            type: 'missing_tool',
            tool: toolId,
            conflictTool: conflictToolId,
            message: `Tool '${toolId}' references non-existent conflicting tool '${conflictToolId}'`
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida configuração completa (schema + referências cruzadas)
 * @param {object} config - Configuração a ser validada
 * @returns {object} - { valid: boolean, schemaErrors: array, crossRefErrors: array }
 */
export function validateConfigComplete(config) {
  const schemaResult = validateConfig(config);
  const crossRefResult = validateCrossReferences(config);

  return {
    valid: schemaResult.valid && crossRefResult.valid,
    schemaErrors: schemaResult.errors,
    crossRefErrors: crossRefResult.errors,
    allErrors: [...schemaResult.errors, ...crossRefResult.errors]
  };
}

/**
 * Valida configuração completa e lança erro se inválido
 * @param {object} config - Configuração a ser validada
 * @throws {Error} Se configuração for inválida
 */
export function validateConfigCompleteStrict(config) {
  const result = validateConfigComplete(config);

  if (!result.valid) {
    const messages = [];

    if (result.schemaErrors.length > 0) {
      messages.push('Schema Validation Errors:');
      result.schemaErrors.forEach(err => {
        messages.push(`  - ${err.path}: ${err.message}`);
      });
    }

    if (result.crossRefErrors.length > 0) {
      messages.push('\nCross-Reference Validation Errors:');
      result.crossRefErrors.forEach(err => {
        messages.push(`  - ${err.message}`);
      });
    }

    throw new Error(`Configuration validation failed:\n${messages.join('\n')}`);
  }

  return true;
}

/**
 * Carrega e valida configuração de arquivo
 * @param {string} configPath - Caminho para o arquivo de configuração
 * @param {boolean} strict - Se deve lançar erro em caso de falha
 * @returns {object} - { config: object, valid: boolean, errors: array }
 */
export function loadAndValidateConfig(configPath, strict = true) {
  try {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    if (strict) {
      validateConfigCompleteStrict(config);
      return { config, valid: true, errors: [] };
    } else {
      const result = validateConfigComplete(config);
      return {
        config,
        valid: result.valid,
        errors: result.allErrors
      };
    }
  } catch (error) {
    if (strict) {
      throw error;
    }
    return {
      config: null,
      valid: false,
      errors: [{ message: error.message, type: 'load_error' }]
    };
  }
}
