import {
  fileReaderTool,
  jsonParserTool,
  codeExecutorTool,
  soma,
} from "../../lib/tools/agent-tools.js";

export const toolMap = {
  file_reader: fileReaderTool,
  json_parser: jsonParserTool,
  code_executor: codeExecutorTool,
  soma,
};
