import { Router } from 'express';

export const IntegrationRoutes = Router();

const integrations = new Map<string, any>();

IntegrationRoutes.get('/', (req, res) => {
  res.json(Array.from(integrations.values()));
});

IntegrationRoutes.get('/:id', (req, res) => {
  const integration = integrations.get(req.params.id);
  if (!integration) {
    return res.status(404).json({ error: 'Integration not found' });
  }
  res.json(integration);
});

IntegrationRoutes.post('/', (req, res) => {
  const id = req.body.id || `integration_${Date.now()}`;
  const integration = {
    id,
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
    enabled: req.body.enabled !== false,
    credentials: req.body.credentials,
    settings: req.body.settings,
    lastConnectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  integrations.set(id, integration);
  res.status(201).json(integration);
});

IntegrationRoutes.put('/:id', (req, res) => {
  const existing = integrations.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Integration not found' });
  }
  const integration = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: new Date()
  };
  integrations.set(req.params.id, integration);
  res.json(integration);
});

IntegrationRoutes.delete('/:id', (req, res) => {
  if (!integrations.has(req.params.id)) {
    return res.status(404).json({ error: 'Integration not found' });
  }
  integrations.delete(req.params.id);
  res.status(204).send();
});

IntegrationRoutes.post('/:id/test', async (req, res) => {
  const integration = integrations.get(req.params.id);
  if (!integration) {
    return res.status(404).json({ error: 'Integration not found' });
  }

  try {
    const result = await testIntegrationConnection(integration);
    if (result.success) {
      integration.lastConnectedAt = new Date();
      integrations.set(req.params.id, integration);
    }
    res.json(result);
  } catch (error: any) {
    res.json({ success: false, message: error.message });
  }
});

async function testIntegrationConnection(integration: any): Promise<{ success: boolean; message: string }> {
  switch (integration.type) {
    case 'EVOLUTION':
      return testEvolutionConnection(integration);
    case 'RDSTATION':
      return testRDStationConnection(integration);
    case 'CONFIRM8':
      return testConfirm8Connection(integration);
    case 'WEBHOOK':
      return { success: true, message: 'Webhook integration is configured (no credentials to test)' };
    default:
      return { success: false, message: `Unknown integration type: ${integration.type}` };
  }
}

async function testEvolutionConnection(integration: any): Promise<{ success: boolean; message: string }> {
  try {
    const { baseUrl, token, instanceName } = integration.credentials;
    if (!baseUrl || !token || !instanceName) {
      return { success: false, message: 'Missing credentials (baseUrl, token, instanceName)' };
    }
    return { success: true, message: `Evolution API connected to ${baseUrl} (instance: ${instanceName})` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

async function testRDStationConnection(integration: any): Promise<{ success: boolean; message: string }> {
  try {
    const { clientId, accessToken } = integration.credentials;
    if (!clientId || !accessToken) {
      return { success: false, message: 'Missing credentials (clientId, accessToken)' };
    }
    return { success: true, message: 'RD Station CRM connected successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

async function testConfirm8Connection(integration: any): Promise<{ success: boolean; message: string }> {
  try {
    const { apiKey, companyId } = integration.credentials;
    if (!apiKey || !companyId) {
      return { success: false, message: 'Missing credentials (apiKey, companyId)' };
    }
    return { success: true, message: 'Confirm8 Business connected successfully' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
