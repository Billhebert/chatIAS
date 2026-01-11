/**
 * FERRAMENTAS PARA AGENTES
 * 3 ferramentas que serão usadas pelos agentes
 */

import { exec } from "child_process";
import { readFileSync, existsSync } from "fs";

/**
 * Tool 1: File Reader
 * Lê arquivos do sistema
 */
export const fileReaderTool = {
  name: "file_reader",
  description: "Lê conteúdo de arquivos",
  enabled: true,
  parameters: {
    path: { type: "string", required: true },
    encoding: { type: "string", required: false, default: "utf-8" },
  },
  execute: async ({ path, encoding = "utf-8" }) => {
    console.log(`      📂 [file_reader] Lendo arquivo: ${path}`);

    try {
      if (!existsSync(path)) {
        return {
          success: false,
          error: `Arquivo não encontrado: ${path}`,
        };
      }

      const content = readFileSync(path, encoding);

      return {
        success: true,
        path: path,
        content: content,
        size: content.length,
        lines: content.split("\n").length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

/**
 * Tool 2: JSON Parser
 * Parseia e valida JSON
 */
export const jsonParserTool = {
  name: "json_parser",
  description: "Parseia e valida strings JSON",
  enabled: true,
  parameters: {
    json: { type: "string", required: true },
    strict: { type: "boolean", required: false, default: false },
  },
  execute: async ({ json, strict = false }) => {
    console.log(`      🔧 [json_parser] Parseando JSON (${json.length} chars)`);

    try {
      const parsed = JSON.parse(json);

      return {
        success: true,
        parsed: parsed,
        type: Array.isArray(parsed) ? "array" : typeof parsed,
        keys: typeof parsed === "object" ? Object.keys(parsed).length : 0,
      };
    } catch (error) {
      if (strict) {
        throw error;
      }

      return {
        success: false,
        error: error.message,
        position: error.message.match(/position (\d+)/)?.[1] || "unknown",
      };
    }
  },
};

/**
 * Tool 3: Code Executor
 * Executa código JavaScript de forma segura (simulado)
 */
export const codeExecutorTool = {
  name: "code_executor",
  description: "Executa código JavaScript (simulado)",
  enabled: true,
  parameters: {
    code: { type: "string", required: true },
    timeout: { type: "number", required: false, default: 5000 },
  },
  execute: async ({ code, timeout = 5000 }) => {
    console.log(`      ⚡ [code_executor] Executando código (${code.length} chars)`);

    try {
      // SIMULAÇÃO - não executa código real por segurança
      // Em produção, usaria vm.runInNewContext ou similar com sandbox

      // Simula verificação de segurança
      const dangerousPatterns = [
        /require\s*\(/,
        /import\s+.*\s+from/,
        /eval\s*\(/,
        /Function\s*\(/,
        /process\./,
        /child_process/,
        /fs\./,
      ];

      const dangerous = dangerousPatterns.some((pattern) => pattern.test(code));

      if (dangerous) {
        return {
          success: false,
          error: "Código contém padrões potencialmente perigosos",
          executed: false,
        };
      }

      // Simula execução bem-sucedida
      return {
        success: true,
        executed: true,
        result: "Código executado com sucesso (simulado)",
        duration: Math.floor(Math.random() * 100) + 10,
        safe: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        executed: false,
      };
    }
  },
};


/**
 * Tool 4: Soma
 * Realiza soma de dois números
 */
export const soma = {
  name: "soma",
  description: "Soma dois números e retorna o resultado",
  enabled: true,
  parameters: {
    a: { type: "number", required: true, description: "Primeiro número" },
    b: { type: "number", required: true, description: "Segundo número" },
  },
  execute: async ({ a, b }) => {
    console.log(`      ➕ [soma] Somando ${a} + ${b}`);

    const num1 = Number(a);
    const num2 = Number(b);

    if (isNaN(num1) || isNaN(num2)) {
      return {
        success: false,
        error: "Parâmetros inválidos - devem ser números",
      };
    }

    return {
      success: true,
      a: num1,
      b: num2,
      result: num1 + num2,
      operation: `${num1} + ${num2} = ${num1 + num2}`,
    };
  }
}

/**
 * Tool 5: Subtração
 */
export const subtracao = {
  name: "subtracao",
  description: "Subtrai dois números",
  enabled: true,
  parameters: {
    a: { type: "number", required: true, description: "Número inicial" },
    b: { type: "number", required: true, description: "Número a subtrair" },
  },
  execute: async ({ a, b }) => {
    console.log(`      ➖ [subtracao] Subtraindo ${a} - ${b}`);
    const num1 = Number(a);
    const num2 = Number(b);

    if (isNaN(num1) || isNaN(num2)) {
      return { success: false, error: "Parâmetros inválidos" };
    }

    return {
      success: true,
      a: num1,
      b: num2,
      result: num1 - num2,
      operation: `${num1} - ${num2} = ${num1 - num2}`,
    };
  }
}

/**
 * Tool 6: Multiplicação
 */
export const multiplicacao = {
  name: "multiplicacao",
  description: "Multiplica dois números",
  enabled: true,
  parameters: {
    a: { type: "number", required: true, description: "Primeiro fator" },
    b: { type: "number", required: true, description: "Segundo fator" },
  },
  execute: async ({ a, b }) => {
    console.log(`      ✖️ [multiplicacao] Multiplicando ${a} × ${b}`);
    const num1 = Number(a);
    const num2 = Number(b);

    if (isNaN(num1) || isNaN(num2)) {
      return { success: false, error: "Parâmetros inválidos" };
    }

    return {
      success: true,
      a: num1,
      b: num2,
      result: num1 * num2,
      operation: `${num1} × ${num2} = ${num1 * num2}`,
    };
  }
}

/**
 * Tool 7: Divisão
 */
export const divisao = {
  name: "divisao",
  description: "Divide dois números",
  enabled: true,
  parameters: {
    a: { type: "number", required: true, description: "Dividendo" },
    b: { type: "number", required: true, description: "Divisor" },
  },
  execute: async ({ a, b }) => {
    console.log(`      ➗ [divisao] Dividindo ${a} ÷ ${b}`);
    const num1 = Number(a);
    const num2 = Number(b);

    if (isNaN(num1) || isNaN(num2)) {
      return { success: false, error: "Parâmetros inválidos" };
    }

    if (num2 === 0) {
      return { success: false, error: "Não é possível dividir por zero" };
    }

    return {
      success: true,
      a: num1,
      b: num2,
      result: num1 / num2,
      operation: `${num1} ÷ ${num2} = ${num1 / num2}`,
    };
  }
}

/**
 * Tool 8: Conversão de Temperatura
 */
export const converterTemperatura = {
  name: "converter_temperatura",
  description: "Converte temperatura entre Celsius, Fahrenheit e Kelvin",
  enabled: true,
  parameters: {
    valor: { type: "number", required: true, description: "Valor da temperatura" },
    de: { type: "string", required: true, description: "Unidade de origem (C, F, K)" },
    para: { type: "string", required: true, description: "Unidade de destino (C, F, K)" },
  },
  execute: async ({ valor, de, para }) => {
    console.log(`      🌡️ [converter_temperatura] ${valor}°${de} → °${para}`);

    const num = Number(valor);
    if (isNaN(num)) {
      return { success: false, error: "Valor inválido" };
    }

    de = de.toUpperCase();
    para = para.toUpperCase();

    // Converter tudo para Celsius primeiro
    let celsius;
    if (de === 'C') celsius = num;
    else if (de === 'F') celsius = (num - 32) * 5/9;
    else if (de === 'K') celsius = num - 273.15;
    else return { success: false, error: "Unidade de origem inválida (use C, F ou K)" };

    // Converter de Celsius para a unidade de destino
    let resultado;
    if (para === 'C') resultado = celsius;
    else if (para === 'F') resultado = (celsius * 9/5) + 32;
    else if (para === 'K') resultado = celsius + 273.15;
    else return { success: false, error: "Unidade de destino inválida (use C, F ou K)" };

    return {
      success: true,
      valorOriginal: num,
      unidadeOrigem: de,
      unidadeDestino: para,
      resultado: Math.round(resultado * 100) / 100,
      conversao: `${num}°${de} = ${Math.round(resultado * 100) / 100}°${para}`,
    };
  }
}

/**
 * Tool 9: Formatação de Data
 */
export const formatarData = {
  name: "formatar_data",
  description: "Formata datas em diferentes formatos",
  enabled: true,
  parameters: {
    data: { type: "string", required: false, description: "Data (ISO ou timestamp)" },
    formato: { type: "string", required: false, default: "completo", description: "Formato: completo, curto, iso, timestamp" },
  },
  execute: async ({ data, formato = "completo" }) => {
    console.log(`      📅 [formatar_data] Formatando: ${data || 'agora'}`);

    const d = data ? new Date(data) : new Date();

    if (isNaN(d.getTime())) {
      return { success: false, error: "Data inválida" };
    }

    const formatters = {
      completo: d.toLocaleDateString('pt-BR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
      curto: d.toLocaleDateString('pt-BR'),
      iso: d.toISOString(),
      timestamp: d.getTime(),
      relativo: getRelativeTime(d),
    };

    return {
      success: true,
      dataOriginal: data || 'agora',
      formato: formato,
      resultado: formatters[formato] || formatters.completo,
      timestamp: d.getTime(),
      iso: d.toISOString(),
    };
  }
}

// Função auxiliar para tempo relativo
function getRelativeTime(date) {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `há ${days} dia${days > 1 ? 's' : ''}`;
  if (hours > 0) return `há ${hours} hora${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `há ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  return `há ${seconds} segundo${seconds !== 1 ? 's' : ''}`;
}

/**
 * Tool 10: Conversão de Unidades de Distância
 */
export const converterDistancia = {
  name: "converter_distancia",
  description: "Converte distâncias entre km, m, cm, milhas, pés, polegadas",
  enabled: true,
  parameters: {
    valor: { type: "number", required: true, description: "Valor da distância" },
    de: { type: "string", required: true, description: "Unidade de origem" },
    para: { type: "string", required: true, description: "Unidade de destino" },
  },
  execute: async ({ valor, de, para }) => {
    console.log(`      📏 [converter_distancia] ${valor} ${de} → ${para}`);

    const num = Number(valor);
    if (isNaN(num)) {
      return { success: false, error: "Valor inválido" };
    }

    // Tabela de conversão para metros
    const paraMetros = {
      'km': 1000,
      'm': 1,
      'cm': 0.01,
      'mm': 0.001,
      'mi': 1609.34,      // milhas
      'milhas': 1609.34,
      'ft': 0.3048,       // pés
      'pes': 0.3048,
      'in': 0.0254,       // polegadas
      'polegadas': 0.0254,
    };

    const deLower = de.toLowerCase();
    const paraLower = para.toLowerCase();

    if (!paraMetros[deLower]) {
      return { success: false, error: `Unidade de origem inválida: ${de}` };
    }

    if (!paraMetros[paraLower]) {
      return { success: false, error: `Unidade de destino inválida: ${para}` };
    }

    const metros = num * paraMetros[deLower];
    const resultado = metros / paraMetros[paraLower];

    return {
      success: true,
      valorOriginal: num,
      unidadeOrigem: de,
      unidadeDestino: para,
      resultado: Math.round(resultado * 10000) / 10000,
      conversao: `${num} ${de} = ${Math.round(resultado * 10000) / 10000} ${para}`,
    };
  }
}