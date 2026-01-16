/**
 * OpenCode Multi-Tenant CLI
 * 
 * This is the entry point for the CLI with multi-tenant support.
 */

import { Command } from 'commander';
import { generateToken } from '../core/src/auth/multi-tenant-auth.js';
import { createTenantRegistry, createUserRepository } from '../../../packages/database/src/index.js';
import inquirer from 'inquirer';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

// ============================================================================
// CONFIG FILE
// ============================================================================

interface CLIConfig {
  defaultTenant?: string;
  verbose?: boolean;
  output?: 'json' | 'pretty';
}

function loadConfig(): CLIConfig {
  const configPaths = [
    './chatias.config.json',
    './.chatiasrc',
    '~/.chatiasrc',
    process.env.CHATIAS_CONFIG || ''
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    }
  }

  return {};
}

function saveConfig(config: CLIConfig): void {
  // Save to local config file
  // Implementation depends on needs
}

// ============================================================================
// MAIN CLI
// ============================================================================

export async function main() {
  const program = new Command();
  const config = loadConfig();

  program
    .name('chatias')
    .description('ChatIAS 3.0 - Multi-Tenant AI Agent Platform')
    .version(packageJson.version || '3.0.0')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .option('-o, --output <format>', 'Output format: json or pretty', 'pretty');

  // Global options
  program.configureHelp({
    subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage(),
    argumentTerm: (arg) => '<' + arg.name() + '>'
  });

  // ==========================================================================
  // AUTH COMMANDS
  // ==========================================================================

  const authCmd = program
    .command('auth')
    .description('Authentication and session management');

  authCmd
    .command('login [tenant]')
    .description('Login to a tenant')
    .action(async (tenantSlug) => {
      try {
        const tenantRegistry = createTenantRegistry();
        
        // Get tenant
        let tenant;
        if (tenantSlug) {
          tenant = tenantRegistry.getTenantBySlug(tenantSlug);
        } else {
          // List tenants for selection
          const tenants = tenantRegistry.listTenants({ status: 'active' });
          if (tenants.length === 0) {
            console.log('No tenants found. Please create a tenant first.');
            console.log('Run: chatias tenant create');
            return;
          }
          if (tenants.length === 1) {
            tenant = tenants[0];
          } else {
            const { selectedTenant } = await inquirer.prompt([
              {
                type: 'list',
                name: 'selectedTenant',
                message: 'Select tenant:',
                choices: tenants.map(t => ({ name: t.name, value: t.slug }))
              }
            ]);
            tenant = tenantRegistry.getTenantBySlug(selectedTenant);
          }
        }

        if (!tenant) {
          console.log(`Tenant '${tenantSlug}' not found.`);
          return;
        }

        // Get user credentials
        const { email, password } = await inquirer.prompt([
          {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (input) => input.includes('@') ? true : 'Invalid email'
          },
          {
            type: 'password',
            name: 'password',
            message: 'Password:'
          }
        ]);

        // Authenticate
        const userRepo = createUserRepository();
        const user = await userRepo.findByEmail(tenant.id, email);

        if (!user) {
          console.log('Invalid credentials.');
          return;
        }

        // Generate token
        const session = {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          tenantName: tenant.name,
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: ['read', 'write', 'execute']
        };

        const token = await generateToken(session);
        
        // Save to config
        saveConfig({ defaultTenant: tenant.slug });

        console.log('Login successful!');
        console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
        console.log(`User: ${user.name}`);
        console.log(`Role: ${user.role}`);
        console.log(`Token: ${token.substring(0, 20)}...`);

      } catch (error) {
        console.error('Login failed:', error.message);
      }
    });

  authCmd
    .command('logout')
    .description('Logout from current session')
    .action(() => {
      saveConfig({});
      console.log('Logged out successfully.');
    });

  authCmd
    .command('status')
    .description('Show current authentication status')
    .action(async () => {
      // In a real implementation, read from config file or keychain
      console.log('Authentication status check requires implementation.');
    });

  authCmd
    .command('whoami')
    .description('Show current user information')
    .action(async () => {
      // In a real implementation, decode token and show user info
      console.log('User info check requires implementation.');
    });

  // ==========================================================================
  // TENANT COMMANDS
  // ==========================================================================

  const tenantCmd = program
    .command('tenant')
    .description('Tenant management');

  tenantCmd
    .command('create')
    .description('Create a new tenant')
    .action(async () => {
      try {
        const tenantRegistry = createTenantRegistry();

        const { name, slug, plan } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Tenant name:',
            validate: (input) => input.length >= 3 ? true : 'Name must be at least 3 characters'
          },
          {
            type: 'input',
            name: 'slug',
            message: 'Tenant slug (auto-generated if empty):'
          },
          {
            type: 'list',
            name: 'plan',
            message: 'Plan:',
            choices: [
              { name: 'Free', value: 'free' },
              { name: 'Starter', value: 'starter' },
              { name: 'Professional', value: 'professional' },
              { name: 'Enterprise', value: 'enterprise' }
            ],
            default: 'starter'
          }
        ]);

        const tenant = await tenantRegistry.createTenant({
          name,
          slug: slug || undefined,
          plan: plan as any
        });

        console.log('Tenant created successfully!');
        console.log(`ID: ${tenant.id}`);
        console.log(`Slug: ${tenant.slug}`);
        console.log(`Plan: ${tenant.plan}`);
        console.log(`Status: ${tenant.status}`);

      } catch (error) {
        console.error('Failed to create tenant:', error.message);
      }
    });

  tenantCmd
    .command('list')
    .description('List all tenants')
    .action(async () => {
      try {
        const tenantRegistry = createTenantRegistry();
        const tenants = tenantRegistry.listTenants();

        if (tenants.length === 0) {
          console.log('No tenants found.');
          return;
        }

        console.log('Tenants:');
        console.log('--------');
        for (const tenant of tenants) {
          console.log(`  ${tenant.slug} - ${tenant.name} (${tenant.plan}) - ${tenant.status}`);
        }

      } catch (error) {
        console.error('Failed to list tenants:', error.message);
      }
    });

  tenantCmd
    .command('use <slug>')
    .description('Set default tenant for commands')
    .action((slug) => {
      const tenantRegistry = createTenantRegistry();
      const tenant = tenantRegistry.getTenantBySlug(slug);

      if (!tenant) {
        console.log(`Tenant '${slug}' not found.`);
        return;
      }

      saveConfig({ defaultTenant: slug });
      console.log(`Default tenant set to: ${tenant.name} (${tenant.slug})`);
    });

  tenantCmd
    .command('info [slug]')
    .description('Show tenant information')
    .action(async (slug) => {
      try {
        const tenantRegistry = createTenantRegistry();
        const tenantSlug = slug || config.defaultTenant;

        if (!tenantSlug) {
          console.log('No tenant specified. Use "chatias tenant use <slug>" to set default.');
          return;
        }

        const tenant = tenantRegistry.getTenantBySlug(tenantSlug);
        if (!tenant) {
          console.log(`Tenant '${tenantSlug}' not found.`);
          return;
        }

        console.log(`Tenant: ${tenant.name}`);
        console.log(`Slug: ${tenant.slug}`);
        console.log(`ID: ${tenant.id}`);
        console.log(`Plan: ${tenant.plan}`);
        console.log(`Status: ${tenant.status}`);
        console.log(`Created: ${tenant.createdAt.toISOString()}`);
        
        const usage = tenantRegistry.getUsageSummary(tenant.id);
        console.log('\nUsage:');
        console.log(`  API Calls: ${usage.apiCalls.used} / ${usage.apiCalls.limit}`);
        console.log(`  Storage: ${(usage.storage.used / 1024 / 1024).toFixed(2)} MB / ${(usage.storage.limit / 1024 / 1024 / 1024).toFixed(2)} GB`);
        console.log(`  Users: ${usage.users.used} / ${usage.users.limit}`);

      } catch (error) {
        console.error('Failed to get tenant info:', error.message);
      }
    });

  tenantCmd
    .command('suspend <slug>')
    .description('Suspend a tenant')
    .action(async (slug) => {
      try {
        const tenantRegistry = createTenantRegistry();
        const tenant = tenantRegistry.getTenantBySlug(slug);

        if (!tenant) {
          console.log(`Tenant '${slug}' not found.`);
          return;
        }

        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Suspend tenant '${tenant.name}'?`
          }
        ]);

        if (confirm) {
          await tenantRegistry.suspendTenant(tenant.id, 'Manual suspension');
          console.log('Tenant suspended.');
        }

      } catch (error) {
        console.error('Failed to suspend tenant:', error.message);
      }
    });

  tenantCmd
    .command('resume <slug>')
    .description('Resume a suspended tenant')
    .action(async (slug) => {
      try {
        const tenantRegistry = createTenantRegistry();
        const tenant = tenantRegistry.getTenantBySlug(slug);

        if (!tenant) {
          console.log(`Tenant '${slug}' not found.`);
          return;
        }

        await tenantRegistry.resumeTenant(tenant.id);
        console.log('Tenant resumed.');

      } catch (error) {
        console.error('Failed to resume tenant:', error.message);
      }
    });

  // ==========================================================================
  // USER COMMANDS
  // ==========================================================================

  const userCmd = program
    .command('user')
    .description('User management');

  userCmd
    .command('create')
    .description('Create a new user')
    .action(async () => {
      try {
        const tenantSlug = config.defaultTenant;
        if (!tenantSlug) {
          console.log('No tenant set. Use "chatias tenant use <slug>" first.');
          return;
        }

        const tenantRegistry = createTenantRegistry();
        const tenant = tenantRegistry.getTenantBySlug(tenantSlug);

        if (!tenant) {
          console.log('Tenant not found.');
          return;
        }

        const { email, name, role } = await inquirer.prompt([
          {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (input) => input.includes('@') ? true : 'Invalid email'
          },
          {
            type: 'input',
            name: 'name',
            message: 'Name:'
          },
          {
            type: 'list',
            name: 'role',
            message: 'Role:',
            choices: ['admin', 'developer', 'viewer'],
            default: 'developer'
          }
        ]);

        const user = await tenantRegistry.createUser(tenant.id, {
          email,
          name,
          role: role as any
        });

        console.log('User created successfully!');
        console.log(`ID: ${user.id}`);
        console.log(`Email: ${user.email}`);
        console.log(`Name: ${user.name}`);
        console.log(`Role: ${user.role}`);
        console.log('\nUser needs to set password and verify email.');

      } catch (error) {
        console.error('Failed to create user:', error.message);
      }
    });

  userCmd
    .command('list')
    .description('List users in current tenant')
    .action(async () => {
      try {
        const tenantSlug = config.defaultTenant;
        if (!tenantSlug) {
          console.log('No tenant set.');
          return;
        }

        const tenantRegistry = createTenantRegistry();
        const tenant = tenantRegistry.getTenantBySlug(tenantSlug);

        if (!tenant) {
          console.log('Tenant not found.');
          return;
        }

        const users = tenantRegistry.listTenantUsers(tenant.id);
        
        console.log(`Users in ${tenant.name}:`);
        console.log('-------------------');
        for (const user of users) {
          console.log(`  ${user.name} (${user.email}) - ${user.role} - ${user.status}`);
        }

      } catch (error) {
        console.error('Failed to list users:', error.message);
      }
    });

  userCmd
    .command('apikey create')
    .description('Create API key for current user')
    .action(async () => {
      try {
        const tenantSlug = config.defaultTenant;
        if (!tenantSlug) {
          console.log('No tenant set.');
          return;
        }

        const { name, expiresAt } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'API key name:',
            default: 'CLI Key'
          },
          {
            type: 'input',
            name: 'expiresAt',
            message: 'Expires at (YYYY-MM-DD, optional):'
          }
        ]);

        console.log('API key creation requires database integration.');

      } catch (error) {
        console.error('Failed to create API key:', error.message);
      }
    });

  // ==========================================================================
  // TOOL COMMANDS
  // ==========================================================================

  const toolCmd = program
    .command('tool')
    .description('Tool management');

  toolCmd
    .command('list')
    .description('List available tools')
    .action(() => {
      console.log('Available tools:');
      console.log('  evolution       - WhatsApp Business API');
      console.log('  rdstation       - RD Station CRM');
      console.log('  confirm8        - Confirm8 Business Management');
      console.log('  file            - File operations');
      console.log('  bash            - Shell commands');
    });

  toolCmd
    .command('run <tool> <action>')
    .description('Run a tool action')
    .action(async (tool, action, args) => {
      // This would integrate with the tool execution system
      console.log(`Running ${tool}:${action}...`);
    });

  // ==========================================================================
  // AGENT COMMANDS
  // ==========================================================================

  const agentCmd = program
    .command('agent')
    .description('Agent management');

  agentCmd
    .command('list')
    .description('List available agents')
    .action(() => {
      console.log('Available agents:');
      console.log('  code-analyzer   - Code analysis and refactoring');
      console.log('  data-processor  - Data processing and transformation');
    });

  agentCmd
    .command('run <agent>')
    .description('Run an agent')
    .action(async (agent, args) => {
      console.log(`Running agent ${agent}...`);
    });

  // ==========================================================================
  // CONFIG COMMANDS
  // ==========================================================================

  const configCmd = program
    .command('config')
    .description('Configuration management');

  configCmd
    .command('show')
    .description('Show current configuration')
    .action(() => {
      console.log('Current configuration:');
      console.log(JSON.stringify(config, null, 2));
    });

  configCmd
    .command('set <key> <value>')
    .description('Set configuration value')
    .action((key, value) => {
      (config as any)[key] = value;
      saveConfig(config);
      console.log(`Config ${key} set to ${value}`);
    });

  // ==========================================================================
  // DEBUG COMMANDS
  // ==========================================================================

  program
    .command('doctor')
    .description('Check system health')
    .action(async () => {
      console.log('System Health Check');
      console.log('====================');
      
      const checks = [
        { name: 'Node.js', check: () => process.version },
        { name: 'Database', check: () => 'Not implemented' },
        { name: 'Config', check: () => config.defaultTenant ? 'OK' : 'No default tenant' }
      ];

      for (const check of checks) {
        const result = check.check();
        console.log(`  ${check.name}: ${result}`);
      }
    });

  program
    .command('version')
    .description('Show version')
    .action(() => {
      console.log(`ChatIAS CLI v${packageJson.version || '3.0.0'}`);
    });

  // ==========================================================================
  // PARSE AND EXECUTE
  // ==========================================================================

  // Handle --version shortcut
  if (process.argv.includes('--version') || process.argv.includes('-v')) {
    console.log(`ChatIAS CLI v${packageJson.version || '3.0.0'}`);
    process.exit(0);
  }

  // Handle --help shortcut
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    program.help();
    process.exit(0);
  }

  await program.parseAsync(process.argv);
}

// ============================================================================
// ENTRY POINT
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});