import { tool } from '@opencode-ai/plugin/tool'

export default tool({
  description: 'Parse, valida e processa JSON com suporte a comentários e trailing commas',
  args: {
    json: tool.schema.string().describe('JSON string ou objeto a processar'),
    action: tool.schema
      .enum(['parse', 'validate', 'parse_response'])
      .optional()
      .describe('Ação: parse (padrão), validate ou parse_response'),
    strict: tool.schema
      .boolean()
      .optional()
      .describe('Modo strict (padrão: false - permite comentários e trailing commas)'),
    data: tool.schema.string().optional().describe('Dados para validação em JSON (obrigatório se action=validate)'),
    schema: tool.schema.string().optional().describe('Schema JSON para validação em formato string')
  },
  async execute(args) {
    const { json, action = 'parse', strict = false, data: dataStr, schema: schemaStr } = args

    try {
      switch (action) {
        case 'parse': {
          // Se json é string, processa normalmente, senão tenta fazer parse
          const jsonToProcess = typeof json === 'string' ? json : JSON.stringify(json)
          const result = await parseJson(jsonToProcess, strict)
          return JSON.stringify(result)
        }
        case 'validate': {
          if (!dataStr) {
            return JSON.stringify({
              success: false,
              error: 'Data é obrigatória para validate',
              message: 'Parâmetro data não fornecido'
            })
          }
          // Tenta fazer parse dos strings
          let data: any
          let schema: any = undefined
          try {
            data = JSON.parse(dataStr)
            if (schemaStr) {
              schema = JSON.parse(schemaStr)
            }
          } catch (parseErr) {
            return JSON.stringify({
              success: false,
              error: `Falha ao fazer parse dos parâmetros: ${(parseErr as any).message}`,
              message: 'Erro de validação'
            })
          }
          const result = await validateData(data, schema)
          return JSON.stringify(result)
        }
        case 'parse_response': {
          const jsonStr = typeof json === 'string' ? json : JSON.stringify(json)
          const result = await parseResponse(jsonStr)
          return JSON.stringify(result)
        }
        default:
          return JSON.stringify({
            success: false,
            error: `Ação desconhecida: ${action}`,
            message: 'Ação inválida'
          })
      }
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: {
          message: (error as any).message,
          type: (error as any).name
        },
        message: 'Erro ao processar JSON'
      })
    }
  }
})

async function parseJson(json: any, strict: boolean) {
  try {
    // Se já é um objeto, retorna diretamente
    if (typeof json !== 'string') {
      return {
        success: true,
        data: json,
        message: 'Input já é um objeto'
      }
    }

    // Remove comentários se não for strict
    let cleanJson = json
    if (!strict) {
      // Remove comentários de linha (//)
      cleanJson = cleanJson.replace(/\/\/.*$/gm, '')
      // Remove comentários de bloco (/* */)
      cleanJson = cleanJson.replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove trailing commas
      cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1')
    }

    // Parse JSON
    const data = JSON.parse(cleanJson)

    return {
      success: true,
      data,
      type: Array.isArray(data) ? 'array' : typeof data,
      size: Array.isArray(data) ? data.length : Object.keys(data).length,
      message: 'JSON parseado com sucesso'
    }
  } catch (error) {
    return {
      success: false,
      error: {
        message: (error as any).message,
        position: (error as any).message.match(/position (\d+)/)?.[1],
        type: 'ParseError'
      },
      message: 'Falha ao fazer parse de JSON'
    }
  }
}

async function validateData(data: any, schema: any) {
  if (!schema) {
    return {
      valid: true,
      errors: [],
      message: 'Nenhum schema fornecido, validação ignorada'
    }
  }

  const errors: any[] = []
  const warnings: any[] = []

  validateValue(data, schema, errors, warnings, 'root')

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    errorCount: errors.length,
    warningCount: warnings.length,
    message: errors.length === 0 ? 'Validação passou' : `Validação falhou com ${errors.length} erro(s)`
  }
}

function validateValue(value: any, schema: any, errors: any[], warnings: any[], path: string = 'root') {
  // Type validation
  if (schema.type) {
    const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type]

    if (!expectedTypes.includes(actualType)) {
      errors.push({
        path,
        message: `Tipo esperado ${expectedTypes.join('|')}, obteve ${actualType}`,
        value: actualType
      })
      return
    }
  }

  // Required validation
  if (schema.required && (value === null || value === undefined)) {
    errors.push({
      path,
      message: 'Valor é obrigatório mas é null ou undefined'
    })
    return
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({
      path,
      message: `Valor deve ser um de: ${schema.enum.join(', ')}`,
      value
    })
  }

  // String validations
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path,
        message: `Comprimento da string ${value.length} é menor que o mínimo ${schema.minLength}`
      })
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path,
        message: `Comprimento da string ${value.length} excede o máximo ${schema.maxLength}`
      })
    }
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern)
      if (!regex.test(value)) {
        errors.push({
          path,
          message: `String não corresponde ao padrão: ${schema.pattern}`
        })
      }
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path,
        message: `Valor ${value} é menor que o mínimo ${schema.minimum}`
      })
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path,
        message: `Valor ${value} excede o máximo ${schema.maximum}`
      })
    }
  }

  // Array validations
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({
        path,
        message: `Comprimento do array ${value.length} é menor que o mínimo ${schema.minItems}`
      })
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({
        path,
        message: `Comprimento do array ${value.length} excede o máximo ${schema.maxItems}`
      })
    }

    // Valida items do array
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        validateValue(value[i], schema.items, errors, warnings, `${path}[${i}]`)
      }
    }
  }

  // Object validations
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (value.hasOwnProperty(key)) {
          validateValue(value[key], propSchema, errors, warnings, `${path}.${key}`)
        }
      }
    }

    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredKey of schema.required) {
        if (!value.hasOwnProperty(requiredKey)) {
          errors.push({
            path: `${path}.${requiredKey}`,
            message: `Propriedade obrigatória ausente: ${requiredKey}`
          })
        }
      }
    }
  }
}

async function parseResponse(response: string) {
  try {
    // Tenta extrair JSON de markdown code blocks
    let jsonString = response

    // Procura por ```json ... ``` ou ``` ... ```
    const jsonBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (jsonBlockMatch) {
      jsonString = jsonBlockMatch[1]
    } else {
      // Tenta encontrar JSON entre chaves ou colchetes
      const jsonMatch = response.match(/[\{\[][\s\S]*[\}\]]/)
      if (jsonMatch) {
        jsonString = jsonMatch[0]
      }
    }

    // Remove comentários
    let cleanJson = jsonString
    cleanJson = cleanJson.replace(/\/\/.*$/gm, '')
    cleanJson = cleanJson.replace(/\/\*[\s\S]*?\*\//g, '')
    // Remove trailing commas
    cleanJson = cleanJson.replace(/,(\s*[}\]])/g, '$1')

    const data = JSON.parse(cleanJson)

    return {
      success: true,
      data,
      type: Array.isArray(data) ? 'array' : typeof data,
      message: 'Resposta parseada com sucesso'
    }
  } catch (error) {
    return {
      success: false,
      error: {
        message: (error as any).message,
        type: 'ParseError'
      },
      message: 'Falha ao fazer parse da resposta do LLM'
    }
  }
}
