/**
 * DataProcessorAgent - Processa e valida dados estruturados
 *
 * Capabilities:
 * - Validação de dados
 * - Transformação de estruturas
 * - Agregação de dados
 * - Validação contra schemas
 */

import { BaseAgent } from '../core/base-agent.js';

/**
 * DataProcessorAgent - Agente principal
 */
export class DataProcessorAgent extends BaseAgent {
  async execute(input) {
    const { data, operation = 'validate', schema = null } = input;

    this.log(`Processing data (operation: ${operation})`);

    const results = {
      operation,
      success: false,
      timestamp: new Date().toISOString()
    };

    try {
      switch (operation) {
        case 'validate':
          results.validation = await this.validateData(data, schema);
          results.success = results.validation.valid;
          break;

        case 'transform':
          results.transformed = await this.transformData(data, input.transformRule);
          results.success = true;
          break;

        case 'aggregate':
          results.aggregated = await this.aggregateData(data, input.aggregateBy);
          results.success = true;
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      return results;
    } catch (error) {
      this.log(`Processing failed: ${error.message}`, 'error');
      results.success = false;
      results.error = error.message;
      return results;
    }
  }

  /**
   * Valida dados
   */
  async validateData(data, schema) {
    this.log('Validating data...', 'debug');

    // Usa subagente se disponível
    if (this.subagents.has('data_validator')) {
      return await this.callSubagent('data_validator', { data, schema });
    }

    // Usa tool se disponível
    if (this.availableTools.find(t => t.id === 'json_parser')) {
      return await this.useTool('json_parser', { data, schema }, 'validate');
    }

    // Validação básica
    return {
      valid: true,
      errors: [],
      message: 'No validator available, data assumed valid'
    };
  }

  /**
   * Transforma dados
   */
  async transformData(data, transformRule) {
    this.log('Transforming data...', 'debug');

    // Usa subagente se disponível
    if (this.subagents.has('data_transformer')) {
      return await this.callSubagent('data_transformer', { data, transformRule });
    }

    // Transformação básica
    return data;
  }

  /**
   * Agrega dados
   */
  async aggregateData(data, aggregateBy) {
    this.log('Aggregating data...', 'debug');

    if (!Array.isArray(data)) {
      throw new Error('Data must be an array for aggregation');
    }

    // Usa tool de agregação se disponível
    if (this.availableTools.find(t => t.id === 'data_aggregator')) {
      return await this.useTool('data_aggregator', { data, aggregateBy });
    }

    // Agregação básica
    const result = {};

    for (const item of data) {
      const key = item[aggregateBy];
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
    }

    return result;
  }
}

/**
 * DataValidatorAgent - Subagente para validação de dados
 */
export class DataValidatorAgent extends BaseAgent {
  async execute(input) {
    const { data, schema = null } = input;

    this.log('Validating data structure');

    const errors = [];
    const warnings = [];

    // Validação básica de tipo
    if (schema) {
      this.validateAgainstSchema(data, schema, errors, warnings);
    } else {
      // Validação genérica
      if (data === null || data === undefined) {
        errors.push({
          path: 'root',
          message: 'Data is null or undefined'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      errorCount: errors.length,
      warningCount: warnings.length
    };
  }

  /**
   * Valida dados contra schema
   */
  validateAgainstSchema(data, schema, errors, warnings, path = 'root') {
    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];

      if (!expectedTypes.includes(actualType)) {
        errors.push({
          path,
          message: `Expected type ${expectedTypes.join('|')}, got ${actualType}`
        });
        return;
      }
    }

    // Required validation
    if (schema.required && (data === null || data === undefined)) {
      errors.push({
        path,
        message: 'Required field is missing'
      });
      return;
    }

    // Object properties validation
    if (typeof data === 'object' && !Array.isArray(data) && schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        this.validateAgainstSchema(
          data[key],
          propSchema,
          errors,
          warnings,
          `${path}.${key}`
        );
      }
    }

    // Array items validation
    if (Array.isArray(data) && schema.items) {
      data.forEach((item, index) => {
        this.validateAgainstSchema(
          item,
          schema.items,
          errors,
          warnings,
          `${path}[${index}]`
        );
      });
    }

    // String validations
    if (typeof data === 'string') {
      if (schema.minLength && data.length < schema.minLength) {
        errors.push({
          path,
          message: `String length ${data.length} is less than minimum ${schema.minLength}`
        });
      }
      if (schema.maxLength && data.length > schema.maxLength) {
        errors.push({
          path,
          message: `String length ${data.length} exceeds maximum ${schema.maxLength}`
        });
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(data)) {
          errors.push({
            path,
            message: `String does not match pattern ${schema.pattern}`
          });
        }
      }
    }

    // Number validations
    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push({
          path,
          message: `Value ${data} is less than minimum ${schema.minimum}`
        });
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push({
          path,
          message: `Value ${data} exceeds maximum ${schema.maximum}`
        });
      }
    }
  }
}

/**
 * DataTransformerAgent - Subagente para transformação de dados
 */
export class DataTransformerAgent extends BaseAgent {
  async execute(input) {
    const { data, transformRule } = input;

    this.log('Transforming data');

    if (!transformRule) {
      return data;
    }

    try {
      switch (transformRule.type) {
        case 'map':
          return this.mapTransform(data, transformRule);

        case 'filter':
          return this.filterTransform(data, transformRule);

        case 'reduce':
          return this.reduceTransform(data, transformRule);

        case 'flatten':
          return this.flattenTransform(data, transformRule);

        case 'group':
          return this.groupTransform(data, transformRule);

        default:
          throw new Error(`Unknown transform type: ${transformRule.type}`);
      }
    } catch (error) {
      this.log(`Transform failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Map transformation
   */
  mapTransform(data, rule) {
    if (!Array.isArray(data)) {
      throw new Error('Map transform requires array input');
    }

    if (rule.mapping) {
      return data.map(item => {
        const mapped = {};
        for (const [targetKey, sourceKey] of Object.entries(rule.mapping)) {
          mapped[targetKey] = item[sourceKey];
        }
        return mapped;
      });
    }

    return data;
  }

  /**
   * Filter transformation
   */
  filterTransform(data, rule) {
    if (!Array.isArray(data)) {
      throw new Error('Filter transform requires array input');
    }

    if (rule.condition) {
      return data.filter(item => {
        const { field, operator, value } = rule.condition;

        switch (operator) {
          case 'equals':
            return item[field] === value;
          case 'notEquals':
            return item[field] !== value;
          case 'greaterThan':
            return item[field] > value;
          case 'lessThan':
            return item[field] < value;
          case 'contains':
            return String(item[field]).includes(value);
          default:
            return true;
        }
      });
    }

    return data;
  }

  /**
   * Reduce transformation
   */
  reduceTransform(data, rule) {
    if (!Array.isArray(data)) {
      throw new Error('Reduce transform requires array input');
    }

    if (rule.operation) {
      const field = rule.field;

      switch (rule.operation) {
        case 'sum':
          return data.reduce((acc, item) => acc + (item[field] || 0), 0);
        case 'avg':
          const sum = data.reduce((acc, item) => acc + (item[field] || 0), 0);
          return sum / data.length;
        case 'min':
          return Math.min(...data.map(item => item[field] || Infinity));
        case 'max':
          return Math.max(...data.map(item => item[field] || -Infinity));
        case 'count':
          return data.length;
        default:
          return data;
      }
    }

    return data;
  }

  /**
   * Flatten transformation
   */
  flattenTransform(data, rule) {
    if (!Array.isArray(data)) {
      throw new Error('Flatten transform requires array input');
    }

    const depth = rule.depth || 1;
    return data.flat(depth);
  }

  /**
   * Group transformation
   */
  groupTransform(data, rule) {
    if (!Array.isArray(data)) {
      throw new Error('Group transform requires array input');
    }

    const groupBy = rule.groupBy;
    if (!groupBy) {
      throw new Error('groupBy field is required');
    }

    const grouped = {};
    for (const item of data) {
      const key = item[groupBy];
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    return grouped;
  }
}
