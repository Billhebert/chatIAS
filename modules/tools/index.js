import {
  fileReaderTool,
  jsonParserTool,
  codeExecutorTool,
  soma,
  subtracao,
  multiplicacao,
  divisao,
  converterTemperatura,
  formatarData,
  converterDistancia,
} from "../../lib/tools/agent-tools.js";

export const toolMap = {
  file_reader: fileReaderTool,
  json_parser: jsonParserTool,
  code_executor: codeExecutorTool,
  soma,
  subtracao,
  multiplicacao,
  divisao,
  converter_temperatura: converterTemperatura,
  formatar_data: formatarData,
  converter_distancia: converterDistancia,
};
