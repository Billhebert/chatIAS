/**
 * ChatIAS 3.0 Multi-Tenant Usage Example
 * 
 * This file demonstrates how to use the ChatIAS platform in a multi-tenant context.
 */

import { createSystem, SystemLoader } from '../packages/core/src/index.js';
import { createTenantRegistry, TenantRegistry } from '../packages/core/src/multi-tenant.js';

// ============================================================================
// EXAMPLE 1: Basic Multi-Tenant Setup
// ============================================================================

async function exampleBasicSetup() {
  console.log('=== Example 1: Basic Multi-Tenant Setup ===\n');

  // Create system with multi-tenant support
  const system = await createSystem({
    enableMultiTenant: true,
    verbose: true
  });

  // Create a new tenant
  const tenant = await system.createTenant({
    name: 'Acme Corporation',
    slug: 'acme',
    plan: 'professional'
  });

  console.log('Tenant created:', tenant);

  // Create a user for this tenant
  const user = await system.createUser({
    email: 'admin@acme.com',
    name: 'John Doe',
    role: 'admin'
  });

  console.log('User created:', user);

  // Get current tenant context
  const currentTenant = system.getCurrentTenant();
  const currentUser = system.getCurrentUser();

  console.log('Current tenant:', currentTenant?.name);
  console.log('Current user:', currentUser?.name);

  await system.destroy();
}

// ============================================================================
// EXAMPLE 2: Tenant Registry Operations
// ============================================================================

async function exampleTenantRegistry() {
  console.log('\n=== Example 2: Tenant Registry Operations ===\n');

  // Create tenant registry
  const registry = createTenantRegistry();

  // Create multiple tenants
  const tenant1 = await registry.createTenant({
    name: 'Tech Startup',
    slug: 'tech-startup',
    plan: 'starter'
  });

  const tenant2 = await registry.createTenant({
    name: 'Enterprise Corp',
    plan: 'enterprise'
  });

  console.log('Tenants created:', tenant1.slug, tenant2.slug);

  // List all tenants
  const allTenants = registry.listTenants();
  console.log('All tenants:', allTenants.length);

  // Get tenant by ID
  const found = registry.getTenant(tenant1.id);
  console.log('Found tenant:', found?.name);

  // Get tenant by slug
  const bySlug = registry.getTenantBySlug('tech-startup');
  console.log('By slug:', bySlug?.name);

  // Update tenant
  await registry.updateTenant(tenant1.id, {
    metadata: {
      displayName: 'Tech Startup Inc.',
      website: 'https://techstartup.com'
    }
  });

  // Create users for tenant
  const user1 = await registry.createUser(tenant1.id, {
    email: 'admin@techstartup.com',
    name: 'Alice',
    role: 'admin'
  });

  const user2 = await registry.createUser(tenant1.id, {
    email: 'dev@techstartup.com',
    name: 'Bob',
    role: 'developer'
  });

  console.log('Users created for tenant:', user1.name, user2.name);

  // List users in tenant
  const users = registry.listTenantUsers(tenant1.id);
  console.log('Users in tenant:', users.length);

  // Check usage limits
  const usage = registry.getUsageSummary(tenant1.id);
  console.log('Usage summary:', usage);

  // Track API calls
  await registry.trackApiCall(tenant1.id);
  await registry.trackApiCall(tenant1.id);
  await registry.trackApiCall(tenant1.id);

  const updatedUsage = registry.getUsageSummary(tenant1.id);
  console.log('After 3 API calls:', updatedUsage.apiCalls);

  // Clean up
  registry.clear();
}

// ============================================================================
// EXAMPLE 3: Using Tools with Tenant Isolation
// ============================================================================

async function exampleTenantIsolation() {
  console.log('\n=== Example 3: Tenant Isolation ===\n');

  // Create separate registries for each tenant
  const registry1 = createTenantRegistry();
  const registry2 = createTenantRegistry();

  // Create tenants
  const tenant1 = await registry1.createTenant({
    name: 'Tenant A',
    slug: 'tenant-a',
    plan: 'starter'
  });

  const tenant2 = await registry2.createTenant({
    name: 'Tenant B',
    slug: 'tenant-b',
    plan: 'professional'
  });

  // Create users
  await registry1.createUser(tenant1.id, {
    email: 'user@tenant-a.com',
    name: 'User A',
    role: 'developer'
  });

  await registry2.createUser(tenant2.id, {
    email: 'user@tenant-b.com',
    name: 'User B',
    role: 'admin'
  });

  // Each tenant has completely isolated data
  console.log('Tenant A users:', registry1.listTenantUsers(tenant1.id).length);
  console.log('Tenant B users:', registry2.listTenantUsers(tenant2.id).length);

  // Usage is also isolated
  await registry1.trackApiCall(tenant1.id);
  await registry2.trackApiCall(tenant2.id);
  await registry2.trackApiCall(tenant2.id);

  const usage1 = registry1.getUsageSummary(tenant1.id);
  const usage2 = registry2.getUsageSummary(tenant2.id);

  console.log('Tenant A API calls:', usage1.apiCalls.used);
  console.log('Tenant B API calls:', usage2.apiCalls.used);

  // Clean up
  registry1.clear();
  registry2.clear();
}

// ============================================================================
// EXAMPLE 4: Plan-Based Limits
// ============================================================================

async function examplePlanLimits() {
  console.log('\n=== Example 4: Plan-Based Limits ===\n');

  const registry = createTenantRegistry();

  // Create tenants with different plans
  const freeTenant = await registry.createTenant({
    name: 'Free Tenant',
    plan: 'free'
  });

  const enterpriseTenant = await registry.createTenant({
    name: 'Enterprise Tenant',
    plan: 'enterprise'
  });

  console.log('Free tenant limits:');
  console.log('  Users:', freeTenant.limits.users);
  console.log('  API Calls:', freeTenant.limits.apiCalls);
  console.log('  Storage:', (freeTenant.limits.storage / 1024 / 1024 / 1024).toFixed(2), 'GB');

  console.log('\nEnterprise tenant limits:');
  console.log('  Users:', enterpriseTenant.limits.users === -1 ? 'Unlimited' : enterpriseTenant.limits.users);
  console.log('  API Calls:', enterpriseTenant.limits.apiCalls === -1 ? 'Unlimited' : enterpriseTenant.limits.apiCalls);
  console.log('  Storage:', enterpriseTenant.limits.storage === -1 ? 'Unlimited' : (enterpriseTenant.limits.storage / 1024 / 1024 / 1024).toFixed(2), 'GB');

  // Features comparison
  console.log('\nFeatures:');
  console.log('  Free - Advanced Analytics:', freeTenant.features.advancedAnalytics);
  console.log('  Enterprise - Advanced Analytics:', enterpriseTenant.features.advancedAnalytics);
  console.log('  Free - SSO:', freeTenant.features.ssoEnabled);
  console.log('  Enterprise - SSO:', enterpriseTenant.features.ssoEnabled);

  registry.clear();
}

// ============================================================================
// EXAMPLE 5: API Key Management
// ============================================================================

async function exampleApiKeys() {
  console.log('\n=== Example 5: API Key Management ===\n');

  const registry = createTenantRegistry();

  const tenant = await registry.createTenant({
    name: 'API Tenant',
    plan: 'professional'
  });

  const user = await registry.createUser(tenant.id, {
    email: 'api-user@example.com',
    name: 'API User',
    role: 'developer'
  });

  // Create API key
  const { apiKey, prefix } = await registry.createApiKey(user.id, {
    name: 'Production Key',
    permissions: ['read', 'write', 'execute'],
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  });

  console.log('API Key created:');
  console.log('  Prefix:', prefix);
  console.log('  Full key:', apiKey);
  console.log('  Permissions: read, write, execute');

  // Validate API key
  const validated = await registry.validateApiKey(apiKey);
  console.log('API Key validated:', validated ? 'Yes' : 'No');

  if (validated) {
    console.log('  User:', validated.user.name);
    console.log('  Permissions:', validated.permissions);
  }

  registry.clear();
}

// ============================================================================
// EXAMPLE 6: Complete Workflow
// ============================================================================

async function exampleCompleteWorkflow() {
  console.log('\n=== Example 6: Complete Workflow ===\n');

  // 1. Initialize system
  const system = await createSystem({
    enableMultiTenant: true,
    verbose: true
  });

  // 2. Create organization (tenant)
  const org = await system.createTenant({
    name: 'My SaaS Company',
    slug: 'my-saas',
    plan: 'professional'
  });

  console.log('Organization created:', org.name);

  // 3. Create team members (users)
  const owner = await system.createUser({
    email: 'owner@mysaas.com',
    name: 'CEO',
    role: 'owner'
  });

  const developer = await system.createUser({
    email: 'dev@mysaas.com',
    name: 'Lead Developer',
    role: 'developer'
  });

  console.log('Users created:', owner.name, developer.name);

  // 4. Check current context
  const tenant = system.getCurrentTenant();
  const user = system.getCurrentUser();

  console.log('\nCurrent context:');
  console.log('  Tenant:', tenant?.name);
  console.log('  User:', user?.name);

  // 5. Get system info
  const info = system.getSystemInfo();
  console.log('\nSystem info:');
  console.log('  Version:', info.version);
  console.log('  Components loaded:', info.components.tools.loaded.length, 'tools');

  // 6. Clean up
  await system.destroy();

  console.log('\nWorkflow completed successfully!');
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

async function runAllExamples() {
  console.log('ChatIAS 3.0 Multi-Tenant Examples\n');
  console.log('='.repeat(50));

  try {
    await exampleBasicSetup();
    await exampleTenantRegistry();
    await exampleTenantIsolation();
    await examplePlanLimits();
    await exampleApiKeys();
    await exampleCompleteWorkflow();

    console.log('\n' + '='.repeat(50));
    console.log('All examples completed!');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run examples
runAllExamples();
