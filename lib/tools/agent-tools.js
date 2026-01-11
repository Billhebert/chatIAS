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