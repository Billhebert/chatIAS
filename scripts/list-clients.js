/**
 * Lista todos os clientes da API Confirm8
 */

import 'dotenv/config';
import { Confirm8AuthTool } from '../src/tools/confirm8-auth.js';
import { Confirm8ClientsTool } from '../src/tools/confirm8-clients.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function listClients() {
  log('\n╔══════════════════════════════════════════════════════╗', 'cyan');
  log('║   Lista de Clientes - Confirm8 API                   ║', 'cyan');
  log('╚══════════════════════════════════════════════════════╝\n', 'cyan');

  const authTool = new Confirm8AuthTool({
    id: 'confirm8_auth',
    class: 'Confirm8AuthTool'
  });

  const clientsTool = new Confirm8ClientsTool({
    id: 'confirm8_clients',
    class: 'Confirm8ClientsTool',
    authTool
  });

  try {
    const result = await clientsTool.execute({
      action: 'list'
    });

    if (result.success) {
      log(`\n✅ Total de clientes: ${result.count}\n`, 'green');

      if (result.data && result.data.length > 0) {
        log('╔════════════════════════════════════════════════════════════╗', 'gray');
        log('║  ID           │ Nome                 │ Email              ║', 'gray');
        log('╠════════════════════════════════════════════════════════════╣', 'gray');

        result.data.forEach(client => {
          const id = String(client.client_id || client.id || '').padEnd(12, ' ').substring(0, 12);
          const name = String(client.name || '').padEnd(20, ' ').substring(0, 20);
          const email = String(client.email || '').padEnd(19, ' ').substring(0, 19);
          log(`║  ${id} │ ${name} │ ${email} ║`, 'cyan');
        });

        log('╚════════════════════════════════════════════════════════════╝\n', 'gray');
      } else {
        log('Nenhum cliente encontrado.\n', 'yellow');
      }
    } else {
      log('\n❌ Erro ao buscar clientes:', 'red');
      log(result.message || 'Erro desconhecido', 'red');
    }
  } catch (error) {
    log('\n❌ Erro ao executar:', 'red');
    log(error.message, 'red');
  }

  process.exit(0);
}

listClients();
