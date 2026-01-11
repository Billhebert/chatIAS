/**
 * JSONParser - Parse e validação de JSON
 *
 * Actions:
 * - parse: Parse JSON string para objeto
 * - validate: Valida objeto contra schema
 * - parse_response: Parse resposta estruturada do LLM
 */

import { BaseTool } from '../core/base-tool.js';

export class JSONParser extends BaseTool {
  /**
   * Execução padrão (parse)
   */
  async execute(params) {
    const { json, strict = false } = params;

    return await this.action_parse({ json, strict });
  }

  /**
   * Action: parse
   * Parse JSON string para objeto
   */
  async action_parse(params) {
    const { json, strict = false } = params;

    this.log('Parsing JSON string');

    try {
      // Se já é um objeto, retorna diretamente
      if (typeof json !== 'string') {
        return {
          success: true,
          data: json,
          message: 'Input is already an object'
        };
      }

      // Remove comentários se não for strict
      let cleanJson = json;
      if (!strict) {
        // Remove comentários de linha (//)
        cleanJson = cleanJson.replace(/\/\/.*$/gm, '');
        // Remove comentários de bloco (/* */)
        cleanJson = cleanJson.replace(/\/\*[\s\S]*?\*\//g, '');
        // Remove trailing commas
        cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1');
      }

      // Parse JSON
      const data = JSON.parse(cleanJson);

      return {
        success: true,
        data,
        type: Array.isArray(data) ? 'array' : typeof data,
        size: Array.isArray(data) ? data.length : Object.keys(data).length,
        message: 'JSON parsed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          position: error.message.match(/position (\d+)/)?.[1],
          type: 'ParseError'
        },
        message: 'JSON parsing failed'
      };
    }
  }

  /**
   * Action: validate
   * Valida objeto contra schema
   */
  async action_validate(params) {
    const { data, schema } = params;

    this.log('Validating data against schema');

    if (!schema) {
      return {
        valid: true,
        errors: [],
        message: 'No schema provided, validation skipped'
      };
    }

    const errors = [];
    const warnings = [];

    this.validateValue(data, schema, errors, warnings, 'root');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      errorCount: errors.length,
      warningCount: warnings.length,
      message: errors.length === 0 ? 'Validation passed' : `Validation failed with ${errors.length} error(s)`
    };
  }

  /**
   * Valida um valor contra schema
   */
  validateValue(value, schema, errors, warnings, path = 'root') {
    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
      const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];

      if (!expectedTypes.includes(actualType)) {
        errors.push({
          path,
          message: `Expected type ${expectedTypes.join('|')}, got ${actualType}`,
          value: actualType
        });
        return; // Stop further validation if type is wrong
      }
    }

    // Required validation
    if (schema.required && (value === null || value === undefined)) {
      errors.push({
        path,
        message: 'Value is required but is null or undefined'
      });
      return;
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        value
      });
    }

    // String validations
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
          path,
          message: `String length ${value.length} is less than minimum ${schema.minLength}`
        });
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({
          path,
          message: `String length ${value.length} exceeds maximum ${schema.maxLength}`
        });
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push({
            path,
            message: `String does not match pattern: ${schema.pattern}`
          });
        }
      }
      if (schema.format) {
        this.validateFormat(value, schema.format, errors, warnings, path);
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          path,
          message: `Value ${value} is less than minimum ${schema.minimum}`
        });
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          path,
          message: `Value ${value} exceeds maximum ${schema.maximum}`
        });
      }
      if (schema.multipleOf && value % schema.multipleOf !== 0) {
        errors.push({
          path,
          message: `Value ${value} is not a multiple of ${schema.multipleOf}`
        });
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push({
          path,
          message: `Array length ${value.length} is less than minimum ${schema.minItems}`
        });
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push({
          path,
          message: `Array length ${value.length} exceeds maximum ${schema.maxItems}`
        });
      }
      if (schema.uniqueItems && new Set(value).size !== value.length) {
        errors.push({
          path,
          message: 'Array items must be unique'
        });
      }

      // Validate array items
      if (schema.items) {
        value.forEach((item, index) => {
          this.validateValue(item, schema.items, errors, warnings, `${path}[${index}]`);
        });
      }
    }

    // Object validations
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Required properties
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredProp of schema.required) {
          if (!(requiredProp in value)) {
            errors.push({
              path: `${path}.${requiredProp}`,
              message: `Required property '${requiredProp}' is missing`
            });
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (propName in value) {
            this.validateValue(
              value[propName],
              propSchema,
              errors,
              warnings,
              `${path}.${propName}`
            );
          }
        }
      }

      // Additional properties
      if (schema.additionalProperties === false) {
        const allowedProps = new Set(Object.keys(schema.properties || {}));
        const actualProps = Object.keys(value);

        for (const prop of actualProps) {
          if (!allowedProps.has(prop)) {
            warnings.push({
              path: `${path}.${prop}`,
              message: `Additional property '${prop}' is not allowed`
            });
          }
        }
      }

      // Min/max properties
      const propCount = Object.keys(value).length;
      if (schema.minProperties !== undefined && propCount < schema.minProperties) {
        errors.push({
          path,
          message: `Object has ${propCount} properties, minimum is ${schema.minProperties}`
        });
      }
      if (schema.maxProperties !== undefined && propCount > schema.maxProperties) {
        errors.push({
          path,
          message: `Object has ${propCount} properties, maximum is ${schema.maxProperties}`
        });
      }
    }
  }

  /**
   * Valida formatos especiais
   */
  validateFormat(value, format, errors, warnings, path) {
    const formats = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uri: /^https?:\/\/.+/,
      url: /^https?:\/\/.+/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      date: /^\d{4}-\d{2}-\d{2}$/,
      'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
      ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
      ipv6: /^([0-9a-f]{0,4}:){7}[0-9a-f]{0,4}$/i
    };

    const regex = formats[format];
    if (regex && !regex.test(value)) {
      errors.push({
        path,
        message: `Value does not match format: ${format}`,
        value
      });
    }
  }

  /**
   * Action: parse_response
   * Parse resposta estruturada do LLM (pode conter markdown, etc)
   */
  async action_parse_response(params) {
    const { json } = params;

    this.log('Parsing LLM response');

    try {
      let cleanJson = json;

      // Remove markdown code blocks
      cleanJson = cleanJson.replace(/```json\s*/g, '');
      cleanJson = cleanJson.replace(/```\s*/g, '');

      // Remove texto antes/depois do JSON
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        cleanJson = jsonMatch[0];
      }

      // Parse
      return await this.action_parse({ json: cleanJson, strict: false });
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: 'ParseError'
        },
        message: 'Failed to parse LLM response'
      };
    }
  }

  /**
   * Lifecycle: Inicialização
   */
  async onInit() {
    this.log('JSONParser initialized');
  }

  /**
   * Lifecycle: Destruição
   */
  async onDestroy() {
    this.log('JSONParser destroyed');
  }
}

export default JSONParser;
