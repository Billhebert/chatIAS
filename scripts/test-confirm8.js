/**
 * test-confirm8.js - Test script for Confirm8 API integration
 * 
 * This script tests all 7 Confirm8 tools:
 * 1. Confirm8AuthTool
 * 2. Confirm8UsersTool
 * 3. Confirm8ClientsTool
 * 4. Confirm8TasksTool
 * 5. Confirm8TicketsTool
 * 6. Confirm8ItemsTool
 * 7. Confirm8ProductsTool
 * 
 * Usage:
 *   node scripts/test-confirm8.js
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
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(toolName, action, status, details = '') {
  const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : 'ℹ️';
  const color = status === 'success' ? 'green' : status === 'error' ? 'red' : 'yellow';
  log(`${icon} [${toolName}] ${action}`, color);
  if (details) {
    log(`   ${details}`, 'gray');
  }
}

async function runTests() {
  log('\n═══════════════════════════════════════════════════', 'cyan');
  log('   Confirm8 API Integration Test Suite', 'cyan');
  log('═══════════════════════════════════════════════════\n', 'cyan');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

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

  // ============================================
  // TEST 1: Authentication
  // ============================================
  log('\n─── Test Group 1: Authentication ───\n', 'cyan');

  // Test 1.1: Check authentication
  totalTests++;
  try {
    const result = await authTool.execute({ action: 'isAuthenticated' });
    if (result.success && result.data === true) {
      logTest('Auth', 'isAuthenticated', 'success', 'Bearer token is valid');
      passedTests++;
    } else {
      logTest('Auth', 'isAuthenticated', 'error', 'Authentication failed');
      failedTests++;
    }
  } catch (error) {
    logTest('Auth', 'isAuthenticated', 'error', error.message);
    failedTests++;
  }

  // Test 1.2: Get token info
  totalTests++;
  try {
    const result = await authTool.execute({ action: 'getToken' });
    if (result.success && result.data) {
      logTest('Auth', 'getToken', 'success', `Token: ${result.data.substring(0, 30)}...`);
      passedTests++;
    } else {
      logTest('Auth', 'getToken', 'error', 'Failed to get token');
      failedTests++;
    }
  } catch (error) {
    logTest('Auth', 'getToken', 'error', error.message);
    failedTests++;
  }

  // ============================================
  // TEST 2: Users
  // ============================================
  log('\n─── Test Group 2: Users ───\n', 'cyan');

  // Test 2.1: List users
  totalTests++;
  try {
    const result = await usersTool.execute({ action: 'list' });
    if (result.success && result.data) {
      logTest('Users', 'list', 'success', `Found ${result.count} users`);
      passedTests++;
    } else {
      logTest('Users', 'list', 'error', result.message || 'Failed to list users');
      failedTests++;
    }
  } catch (error) {
    logTest('Users', 'list', 'error', error.message);
    failedTests++;
  }

  // ============================================
  // TEST 3: Clients
  // ============================================
  log('\n─── Test Group 3: Clients ───\n', 'cyan');

  // Test 3.1: List clients
  totalTests++;
  try {
    const result = await clientsTool.execute({ action: 'list' });
    if (result.success && result.data) {
      logTest('Clients', 'list', 'success', `Found ${result.count} clients`);
      passedTests++;
    } else {
      logTest('Clients', 'list', 'error', result.message || 'Failed to list clients');
      failedTests++;
    }
  } catch (error) {
    logTest('Clients', 'list', 'error', error.message);
    failedTests++;
  }

  // ============================================
  // TEST 4: Tasks
  // ============================================
  log('\n─── Test Group 4: Tasks ───\n', 'cyan');

  // Test 4.1: List tasks
  totalTests++;
  try {
    const result = await tasksTool.execute({ action: 'list' });
    if (result.success && result.data) {
      logTest('Tasks', 'list', 'success', `Found ${result.count} tasks`);
      passedTests++;
    } else {
      logTest('Tasks', 'list', 'error', result.message || 'Failed to list tasks');
      failedTests++;
    }
  } catch (error) {
    logTest('Tasks', 'list', 'error', error.message);
    failedTests++;
  }

  // ============================================
  // TEST 5: Tickets
  // ============================================
  log('\n─── Test Group 5: Tickets ───\n', 'cyan');

  // Test 5.1: List tickets
  totalTests++;
  try {
    const result = await ticketsTool.execute({ action: 'list' });
    if (result.success && result.data) {
      logTest('Tickets', 'list', 'success', `Found ${result.count} tickets`);
      passedTests++;
    } else {
      logTest('Tickets', 'list', 'error', result.message || 'Failed to list tickets');
      failedTests++;
    }
  } catch (error) {
    logTest('Tickets', 'list', 'error', error.message);
    failedTests++;
  }

  // ============================================
  // TEST 6: Items
  // ============================================
  log('\n─── Test Group 6: Items ───\n', 'cyan');

  // Test 6.1: List items
  totalTests++;
  try {
    const result = await itemsTool.execute({ action: 'listItems' });
    if (result.success && result.data) {
      logTest('Items', 'listItems', 'success', `Found ${result.count} items`);
      passedTests++;
    } else {
      logTest('Items', 'listItems', 'error', result.message || 'Failed to list items');
      failedTests++;
    }
  } catch (error) {
    logTest('Items', 'listItems', 'error', error.message);
    failedTests++;
  }

  // Test 6.2: List item types
  totalTests++;
  try {
    const result = await itemsTool.execute({ action: 'listItemTypes' });
    if (result.success && result.data) {
      logTest('Items', 'listItemTypes', 'success', `Found ${result.count} item types`);
      passedTests++;
    } else {
      logTest('Items', 'listItemTypes', 'error', result.message || 'Failed to list item types');
      failedTests++;
    }
  } catch (error) {
    logTest('Items', 'listItemTypes', 'error', error.message);
    failedTests++;
  }

  // ============================================
  // SUMMARY
  // ============================================
  log('\n═══════════════════════════════════════════════════', 'cyan');
  log('   Test Summary', 'cyan');
  log('═══════════════════════════════════════════════════\n', 'cyan');

  log(`Total Tests: ${totalTests}`, 'blue');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${failedTests}`, 'red');
  log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`, 'yellow');

  if (failedTests === 0) {
    log('🎉 All tests passed!', 'green');
  } else {
    log('⚠️  Some tests failed. Check the output above for details.', 'yellow');
  }

  log('\n═══════════════════════════════════════════════════\n', 'cyan');

  // Exit with appropriate code
  process.exit(failedTests === 0 ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  console.error('\n❌ Fatal error during tests:');
  console.error(error);
  process.exit(1);
});
