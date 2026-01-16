import { Router } from 'express';

export const AutomationRoutes = Router();

const automations = new Map<string, any>();

AutomationRoutes.get('/', (req, res) => {
  res.json(Array.from(automations.values()));
});

AutomationRoutes.get('/:id', (req, res) => {
  const automation = automations.get(req.params.id);
  if (!automation) {
    return res.status(404).json({ error: 'Automation not found' });
  }
  res.json(automation);
});

AutomationRoutes.post('/', (req, res) => {
  const id = req.body.id || `automation_${Date.now()}`;
  const automation = {
    id,
    name: req.body.name,
    description: req.body.description,
    enabled: req.body.enabled !== false,
    trigger: req.body.trigger,
    conditions: req.body.conditions,
    actions: req.body.actions || [],
    settings: req.body.settings,
    executionCount: 0,
    lastExecutedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  automations.set(id, automation);
  res.status(201).json(automation);
});

AutomationRoutes.put('/:id', (req, res) => {
  const existing = automations.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Automation not found' });
  }
  const automation = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: new Date()
  };
  automations.set(req.params.id, automation);
  res.json(automation);
});

AutomationRoutes.delete('/:id', (req, res) => {
  if (!automations.has(req.params.id)) {
    return res.status(404).json({ error: 'Automation not found' });
  }
  automations.delete(req.params.id);
  res.status(204).send();
});

AutomationRoutes.post('/:id/execute', (req, res) => {
  const automation = automations.get(req.params.id);
  if (!automation) {
    return res.status(404).json({ error: 'Automation not found' });
  }
  if (!automation.enabled) {
    return res.status(400).json({ error: 'Automation is disabled' });
  }
  automation.executionCount += 1;
  automation.lastExecutedAt = new Date();
  automations.set(req.params.id, automation);
  res.json({ success: true, message: 'Automation executed', executionCount: automation.executionCount });
});
