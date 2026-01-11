/**
 * Example - Demonstração completa do sistema ChatIAS Pro 2.0
 *
 * Este exemplo mostra como usar o novo sistema:
 * - Carregamento automático via JSON
 * - Agentes com subagentes
 * - Tools com actions
 * - Knowledge bases
 * - MCP providers com fallback
 * - Tool sequences
 */

import { createSystem } from './src/core/system-loader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Exemplo 1: Inicialização básica
 */
async function example1_BasicInitialization() {
  console.log('\n=== Example 1: Basic Initialization ===\n');

  try {
    // Cria e inicializa o sistema
    const system = await createSystem({
      configPath: path.join(__dirname, 'config', 'system-config.json'),
      verbose: true // Mostra logs detalhados
    });

    // Obtém informações do sistema
    const info = system.getSystemInfo();
    console.log('\n📊 System Info:');
    console.log(`  Name: ${info.name}`);
    console.log(`  Version: ${info.version}`);
    console.log(`  Environment: ${info.environment}`);
    console.log(`  Agents: ${info.agents.total} (${info.agents.enabled} enabled)`);
    console.log(`  Tools: ${info.tools.total} (${info.tools.enabled} enabled)`);
    console.log(`  Knowledge Bases: ${info.knowledgeBases.total}`);
    console.log(`  MCP Providers: ${info.mcpProviders.total} (${info.mcpProviders.connected} connected)`);

    // Cleanup
    await system.destroy();
    console.log('\n✅ Example 1 completed successfully\n');
  } catch (error) {
    console.error('❌ Example 1 failed:', error.message);
  }
}

/**
 * Exemplo 2: Usando o CodeAnalyzerAgent
 */
async function example2_CodeAnalyzer() {
  console.log('\n=== Example 2: Code Analyzer Agent ===\n');

  try {
    const system = await createSystem({
      configPath: path.join(__dirname, 'config', 'system-config.json'),
      verbose: false
    });

    // Código de exemplo para analisar
    const sampleCode = `
const fetchData = async (url) => {
  const response = await fetch(url);
  return response.json();
};

var counter = 0;
function increment() {
  counter++;
}
    `;

    // Executa agente
    console.log('🔍 Analyzing code...\n');
    const result = await system.runAgent('code_analyzer', {
      code: sampleCode,
      language: 'javascript',
      depth: 'standard'
    });

    // Mostra resultados
    console.log('📋 Analysis Results:');
    console.log(`  Syntax Valid: ${result.syntaxValid ? '✅' : '❌'}`);
    console.log(`  Style Issues: ${result.styleIssues?.length || 0}`);

    if (result.styleIssues && result.styleIssues.length > 0) {
      console.log('\n  Style Issues Found:');
      result.styleIssues.forEach(issue => {
        console.log(`    - Line ${issue.line}: ${issue.message} [${issue.severity}]`);
      });
    }

    console.log(`\n  Dependencies: ${result.dependencies?.length || 0}`);
    if (result.dependencies && result.dependencies.length > 0) {
      result.dependencies.forEach(dep => {
        console.log(`    - ${dep.module} (${dep.type})`);
      });
    }

    await system.destroy();
    console.log('\n✅ Example 2 completed successfully\n');
  } catch (error) {
    console.error('❌ Example 2 failed:', error.message);
    console.error(error);
  }
}

/**
 * Exemplo 3: Usando o DataProcessorAgent
 */
async function example3_DataProcessor() {
  console.log('\n=== Example 3: Data Processor Agent ===\n');

  try {
    const system = await createSystem({
      configPath: path.join(__dirname, 'config', 'system-config.json'),
      verbose: false
    });

    // Dados de exemplo
    const sampleData = {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
      hobbies: ['reading', 'coding', 'gaming']
    };

    const schema = {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string', minLength: 1 },
        age: { type: 'number', minimum: 0 },
        email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
        hobbies: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    };

    // Valida dados
    console.log('✅ Validating data...\n');
    const result = await system.runAgent('data_processor', {
      data: sampleData,
      operation: 'validate',
      schema
    });

    console.log('📋 Validation Results:');
    console.log(`  Valid: ${result.validation.valid ? '✅' : '❌'}`);
    console.log(`  Errors: ${result.validation.errorCount || 0}`);
    console.log(`  Warnings: ${result.validation.warningCount || 0}`);

    if (result.validation.errors && result.validation.errors.length > 0) {
      console.log('\n  Errors Found:');
      result.validation.errors.forEach(error => {
        console.log(`    - ${error.path}: ${error.message}`);
      });
    }

    await system.destroy();
    console.log('\n✅ Example 3 completed successfully\n');
  } catch (error) {
    console.error('❌ Example 3 failed:', error.message);
    console.error(error);
  }
}

/**
 * Exemplo 4: Usando Tools diretamente
 */
async function example4_DirectToolUsage() {
  console.log('\n=== Example 4: Direct Tool Usage ===\n');

  try {
    const system = await createSystem({
      configPath: path.join(__dirname, 'config', 'system-config.json'),
      verbose: false
    });

    // Usa json_parser tool
    console.log('🔧 Using JSON Parser tool...\n');
    const jsonString = '{"name": "Alice", "age": 25, "city": "NYC"}';

    const parseResult = await system.runTool('json_parser', {
      json: jsonString
    });

    console.log('📋 Parse Result:');
    console.log(`  Success: ${parseResult.success ? '✅' : '❌'}`);
    console.log(`  Type: ${parseResult.type}`);
    console.log(`  Data:`, parseResult.data);

    // Usa code_executor tool
    console.log('\n🔧 Using Code Executor tool...\n');
    const code = 'const x = 10; const y = 20; x + y;';

    const execResult = await system.runTool('code_executor', {
      code,
      timeout: 5000
    }, 'execute');

    console.log('📋 Execution Result:');
    console.log(`  Success: ${execResult.success ? '✅' : '❌'}`);
    console.log(`  Result: ${execResult.result}`);

    await system.destroy();
    console.log('\n✅ Example 4 completed successfully\n');
  } catch (error) {
    console.error('❌ Example 4 failed:', error.message);
    console.error(error);
  }
}

/**
 * Exemplo 5: Usando Knowledge Base
 */
async function example5_KnowledgeBase() {
  console.log('\n=== Example 5: Knowledge Base Query ===\n');

  try {
    const system = await createSystem({
      configPath: path.join(__dirname, 'config', 'system-config.json'),
      verbose: false
    });

    // Consulta KB de JavaScript
    console.log('📚 Querying JavaScript Syntax KB...\n');
    const results = await system.queryKnowledgeBase('js_syntax', 'async await');

    console.log(`📋 Found ${results.length} documents:\n`);
    results.slice(0, 3).forEach(result => {
      console.log(`  📄 ${result.document.title}`);
      console.log(`     Score: ${result.score}`);
      console.log(`     Tags: ${result.document.tags.join(', ')}`);
      console.log('');
    });

    // Consulta KB de Design Patterns
    console.log('📚 Querying Design Patterns KB...\n');
    const patternResults = await system.queryKnowledgeBase('patterns', {
      type: 'category',
      value: 'creational'
    });

    console.log(`📋 Found ${patternResults.length} creational patterns:\n`);
    patternResults.forEach(result => {
      console.log(`  📄 ${result.document.title}`);
    });

    await system.destroy();
    console.log('\n✅ Example 5 completed successfully\n');
  } catch (error) {
    console.error('❌ Example 5 failed:', error.message);
    console.error(error);
  }
}

/**
 * Exemplo 6: Métricas e Observabilidade
 */
async function example6_Metrics() {
  console.log('\n=== Example 6: Metrics and Observability ===\n');

  try {
    const system = await createSystem({
      configPath: path.join(__dirname, 'config', 'system-config.json'),
      verbose: false
    });

    // Executa algumas operações
    await system.runTool('json_parser', { json: '{"test": true}' });
    await system.runTool('json_parser', { json: '{"test": false}' });

    // Obtém métricas do tool
    const jsonParser = system.toolRegistry.get('json_parser');
    const metrics = jsonParser.getMetrics();

    console.log('📊 JSON Parser Metrics:');
    console.log(`  Total Executions: ${metrics.totalExecutions}`);
    console.log(`  Successful: ${metrics.successfulExecutions}`);
    console.log(`  Failed: ${metrics.failedExecutions}`);
    console.log(`  Success Rate: ${metrics.successRate.toFixed(2)}%`);
    console.log(`  Average Time: ${metrics.averageExecutionTime.toFixed(2)}ms`);

    await system.destroy();
    console.log('\n✅ Example 6 completed successfully\n');
  } catch (error) {
    console.error('❌ Example 6 failed:', error.message);
  }
}

/**
 * Executa todos os exemplos
 */
async function runAllExamples() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                  ChatIAS Pro 2.0 Examples                 ║');
  console.log('║            Sistema Modular Baseado em Configuração        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  await example1_BasicInitialization();
  await example2_CodeAnalyzer();
  await example3_DataProcessor();
  await example4_DirectToolUsage();
  await example5_KnowledgeBase();
  await example6_Metrics();

  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║               🎉 All Examples Completed! 🎉                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');
}

// Executa exemplos
runAllExamples().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
