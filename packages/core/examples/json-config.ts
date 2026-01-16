/**
 * JSON Config Example - Demonstrates loading enterprise data from JSON configuration
 *
 * This example shows how to configure:
 * - Companies with full details
 * - Departments with hierarchy
 * - Follow-ups with all types
 * - Automations with triggers and actions
 * - Integrations with credentials
 */

import { createSystem } from '../src/system-loader.js';

async function main() {
  console.log('🚀 Starting ChatIAS with JSON configuration...\n');

  const system = await createSystem({
    configPath: './config/system-config.json',
    enableMultiTenant: true,
    tenantSlug: 'default'
  });

  console.log('✅ System initialized successfully!\n');

  // Access enterprise services
  const companyService = system.getCompanyService();
  const departmentService = system.getDepartmentService();
  const followUpService = system.getFollowUpService();
  const automationService = system.getAutomationService();
  const integrationService = system.getIntegrationService();

  // List all companies
  if (companyService) {
    console.log('🏢 Companies:');
    const companies = await companyService.listAll();
    for (const company of companies) {
      console.log(`  - ${company.name} (${company.document})`);
    }
  }

  // List department tree
  if (departmentService) {
    console.log('\n🏛️ Departments:');
    const roots = await departmentService.listRoots();
    for (const root of roots) {
      console.log(`  - ${root.name}`);
      const children = await departmentService.listChildren(root.id);
      for (const child of children) {
        console.log(`    - ${child.name}`);
      }
    }
  }

  // List follow-ups by type
  if (followUpService) {
    console.log('\n📌 Follow-ups:');
    const all = await followUpService.list();
    const byType = all.reduce((acc, fu) => {
      acc[fu.type] = (acc[fu.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    for (const [type, count] of Object.entries(byType)) {
      console.log(`  - ${type}: ${count}`);
    }
  }

  // List automations
  if (automationService) {
    console.log('\n⚡ Automations:');
    const automations = await automationService.list();
    for (const auto of automations) {
      const status = auto.enabled ? '🟢' : '🔴';
      console.log(`  ${status} ${auto.name} (${auto.trigger.type})`);
    }
  }

  // List integrations
  if (integrationService) {
    console.log('\n🔗 Integrations:');
    const integrations = await integrationService.list();
    for (const integ of integrations) {
      const status = integ.enabled ? '🟢' : '🔴';
      console.log(`  ${status} ${integ.name} (${integ.type})`);
    }
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);
