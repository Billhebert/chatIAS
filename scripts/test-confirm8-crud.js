/**
 * test-confirm8-crud.js - Teste CRUD completo das ferramentas Confirm8
 * 
 * Testa operações de criação, listagem, atualização e remoção
 */

import 'dotenv/config';
import { Confirm8AuthTool } from '../src/tools/confirm8-auth.js';
import { Confirm8UsersTool } from '../src/tools/confirm8-users.js';
import { Confirm8ClientsTool } from '../src/tools/confirm8-clients.js';
import { Confirm8TasksTool } from '../src/tools/confirm8-tasks.js';
import { Confirm8TicketsTool } from '../src/tools/confirm8-tickets.js';
import { Confirm8ItemsTool } from '../src/tools/confirm8-items.js';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(resource, action, status, details = '') {
  const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'skip' ? '⏭️' : 'ℹ️';
  const color = status === 'success' ? 'green' : status === 'error' ? 'red' : status === 'skip' ? 'yellow' : 'cyan';
  log(`${icon} [${resource}] ${action}`, color);
  if (details) {
    log(`   ${details}`, 'gray');
  }
}

async function runCrudTests() {
  log('\n╔══════════════════════════════════════════════════════╗', 'cyan');
  log('║   Confirm8 API - CRUD Operations Test Suite         ║', 'cyan');
  log('╚══════════════════════════════════════════════════════╝\n', 'cyan');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

  // Initialize tools
  log('🔧 Initializing tools...', 'blue');
  
  const authTool = new Confirm8AuthTool({
    id: 'confirm8_auth',
    class: 'Confirm8AuthTool'
  });

  const usersTool = new Confirm8UsersTool({
    id: 'confirm8_users',
    class: 'Confirm8UsersTool',
    authTool
  });

  const clientsTool = new Confirm8ClientsTool({
    id: 'confirm8_clients',
    class: 'Confirm8ClientsTool',
    authTool
  });

  const tasksTool = new Confirm8TasksTool({
    id: 'confirm8_tasks',
    class: 'Confirm8TasksTool',
    authTool
  });

  const ticketsTool = new Confirm8TicketsTool({
    id: 'confirm8_tickets',
    class: 'Confirm8TicketsTool',
    authTool
  });

  const itemsTool = new Confirm8ItemsTool({
    id: 'confirm8_items',
    class: 'Confirm8ItemsTool',
    authTool
  });

  log('✅ Tools initialized\n', 'green');

  // Store created IDs for cleanup
  const createdIds = {
    users: [],
    clients: [],
    tasks: [],
    tickets: [],
    items: [],
    itemTypes: []
  };

  // ============================================
  // TEST 1: Clients CRUD
  // ============================================
  log('\n─── Test Group 1: Clients CRUD ───\n', 'cyan');

  // 1.1: Create Client
  totalTests++;
  let testClientId = null;
  try {
    const result = await clientsTool.execute({
      action: 'create',
      name: 'Test Client ' + Date.now(),
      email: 'test@example.com',
      phone: '1234567890'
    });
    
    if (result.success && result.data) {
      testClientId = result.data.client_id || result.data.id;
      createdIds.clients.push(testClientId);
      logTest('Clients', 'create', 'success', `Client ID: ${testClientId}`);
      passedTests++;
    } else {
      logTest('Clients', 'create', 'error', result.message || 'Failed to create client');
      failedTests++;
    }
  } catch (error) {
    logTest('Clients', 'create', 'error', error.message);
    failedTests++;
  }

  // 1.2: Get Client
  if (testClientId) {
    totalTests++;
    try {
      const result = await clientsTool.execute({
        action: 'get',
        clientId: testClientId
      });
      
      if (result.success && result.data) {
        logTest('Clients', 'get', 'success', `Retrieved client: ${result.data.name || 'N/A'}`);
        passedTests++;
      } else {
        logTest('Clients', 'get', 'error', result.message || 'Failed to get client');
        failedTests++;
      }
    } catch (error) {
      logTest('Clients', 'get', 'error', error.message);
      failedTests++;
    }
  } else {
    totalTests++;
    logTest('Clients', 'get', 'skip', 'No client ID to test');
    skippedTests++;
  }

  // 1.3: Update Client
  if (testClientId) {
    totalTests++;
    try {
      const result = await clientsTool.execute({
        action: 'update',
        clientId: testClientId,
        data: {
          name: 'Updated Test Client',
          email: 'updated@example.com'
        }
      });
      
      if (result.success) {
        logTest('Clients', 'update', 'success', 'Client updated successfully');
        passedTests++;
      } else {
        logTest('Clients', 'update', 'error', result.message || 'Failed to update client');
        failedTests++;
      }
    } catch (error) {
      logTest('Clients', 'update', 'error', error.message);
      failedTests++;
    }
  } else {
    totalTests++;
    logTest('Clients', 'update', 'skip', 'No client ID to test');
    skippedTests++;
  }

  // 1.4: Deactivate Client
  if (testClientId) {
    totalTests++;
    try {
      const result = await clientsTool.execute({
        action: 'deactivate',
        clientId: testClientId
      });
      
      if (result.success) {
        logTest('Clients', 'deactivate', 'success', 'Client deactivated');
        passedTests++;
      } else {
        logTest('Clients', 'deactivate', 'error', result.message || 'Failed to deactivate');
        failedTests++;
      }
    } catch (error) {
      logTest('Clients', 'deactivate', 'error', error.message);
      failedTests++;
    }
  } else {
    totalTests++;
    logTest('Clients', 'deactivate', 'skip', 'No client ID to test');
    skippedTests++;
  }

  // ============================================
  // TEST 2: Tasks CRUD
  // ============================================
  log('\n─── Test Group 2: Tasks CRUD ───\n', 'cyan');

  // 2.1: Create Task
  totalTests++;
  let testTaskId = null;
  try {
    const result = await tasksTool.execute({
      action: 'create',
      title: 'Test Task ' + Date.now(),
      type: 'checklist',
      description: 'This is a test task',
      priority: 'medium'
    });
    
    if (result.success && result.data) {
      testTaskId = result.data.task_id || result.data.id;
      createdIds.tasks.push(testTaskId);
      logTest('Tasks', 'create', 'success', `Task ID: ${testTaskId}`);
      passedTests++;
    } else {
      logTest('Tasks', 'create', 'error', result.message || 'Failed to create task');
      failedTests++;
    }
  } catch (error) {
    logTest('Tasks', 'create', 'error', error.message);
    failedTests++;
  }

  // 2.2: Get Task
  if (testTaskId) {
    totalTests++;
    try {
      const result = await tasksTool.execute({
        action: 'get',
        taskId: testTaskId
      });
      
      if (result.success && result.data) {
        logTest('Tasks', 'get', 'success', `Retrieved task: ${result.data.title || 'N/A'}`);
        passedTests++;
      } else {
        logTest('Tasks', 'get', 'error', result.message || 'Failed to get task');
        failedTests++;
      }
    } catch (error) {
      logTest('Tasks', 'get', 'error', error.message);
      failedTests++;
    }
  } else {
    totalTests++;
    logTest('Tasks', 'get', 'skip', 'No task ID to test');
    skippedTests++;
  }

  // 2.3: Update Task
  if (testTaskId) {
    totalTests++;
    try {
      const result = await tasksTool.execute({
        action: 'update',
        taskId: testTaskId,
        data: {
          title: 'Updated Test Task',
          priority: 'high'
        }
      });
      
      if (result.success) {
        logTest('Tasks', 'update', 'success', 'Task updated successfully');
        passedTests++;
      } else {
        logTest('Tasks', 'update', 'error', result.message || 'Failed to update task');
        failedTests++;
      }
    } catch (error) {
      logTest('Tasks', 'update', 'error', error.message);
      failedTests++;
    }
  } else {
    totalTests++;
    logTest('Tasks', 'update', 'skip', 'No task ID to test');
    skippedTests++;
  }

  // ============================================
  // TEST 3: Tickets CRUD
  // ============================================
  log('\n─── Test Group 3: Tickets CRUD ───\n', 'cyan');

  // 3.1: Create Ticket
  totalTests++;
  let testTicketId = null;
  try {
    const result = await ticketsTool.execute({
      action: 'create',
      title: 'Test Ticket ' + Date.now(),
      description: 'This is a test ticket',
      status: 'open'
    });
    
    if (result.success && result.data) {
      testTicketId = result.data.ticket_id || result.data.id;
      createdIds.tickets.push(testTicketId);
      logTest('Tickets', 'create', 'success', `Ticket ID: ${testTicketId}`);
      passedTests++;
    } else {
      logTest('Tickets', 'create', 'error', result.message || 'Failed to create ticket');
      failedTests++;
    }
  } catch (error) {
    logTest('Tickets', 'create', 'error', error.message);
    failedTests++;
  }

  // 3.2: Get Ticket
  if (testTicketId) {
    totalTests++;
    try {
      const result = await ticketsTool.execute({
        action: 'get',
        ticketId: testTicketId
      });
      
      if (result.success && result.data) {
        logTest('Tickets', 'get', 'success', `Retrieved ticket: ${result.data.title || 'N/A'}`);
        passedTests++;
      } else {
        logTest('Tickets', 'get', 'error', result.message || 'Failed to get ticket');
        failedTests++;
      }
    } catch (error) {
      logTest('Tickets', 'get', 'error', error.message);
      failedTests++;
    }
  } else {
    totalTests++;
    logTest('Tickets', 'get', 'skip', 'No ticket ID to test');
    skippedTests++;
  }

  // ============================================
  // SUMMARY
  // ============================================
  log('\n╔══════════════════════════════════════════════════════╗', 'cyan');
  log('║   Test Summary                                       ║', 'cyan');
  log('╚══════════════════════════════════════════════════════╝\n', 'cyan');

  log(`Total Tests:    ${totalTests}`, 'blue');
  log(`Passed:         ${passedTests}`, 'green');
  log(`Failed:         ${failedTests}`, 'red');
  log(`Skipped:        ${skippedTests}`, 'yellow');
  log(`Success Rate:   ${((passedTests / totalTests) * 100).toFixed(1)}%\n`, 'magenta');

  if (failedTests === 0) {
    log('🎉 All tests passed!', 'green');
  } else {
    log(`⚠️  ${failedTests} test(s) failed. Check the output above.`, 'yellow');
  }

  log('\n╔══════════════════════════════════════════════════════╗', 'cyan');
  log('║   Created Resources Summary                          ║', 'cyan');
  log('╚══════════════════════════════════════════════════════╝\n', 'cyan');

  if (createdIds.clients.length > 0) log(`Clients: ${createdIds.clients.join(', ')}`, 'gray');
  if (createdIds.tasks.length > 0) log(`Tasks: ${createdIds.tasks.join(', ')}`, 'gray');
  if (createdIds.tickets.length > 0) log(`Tickets: ${createdIds.tickets.join(', ')}`, 'gray');
  if (createdIds.items.length > 0) log(`Items: ${createdIds.items.join(', ')}`, 'gray');

  log('\n', 'reset');

  // Exit with appropriate code
  process.exit(failedTests === 0 ? 0 : 1);
}

// Run tests
runCrudTests().catch((error) => {
  console.error('\n❌ Fatal error during tests:');
  console.error(error);
  process.exit(1);
});
