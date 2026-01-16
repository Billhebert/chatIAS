import { Router } from 'express';

export const FollowUpRoutes = Router();

const followUps = new Map<string, any>();

FollowUpRoutes.get('/', (req, res) => {
  res.json(Array.from(followUps.values()));
});

FollowUpRoutes.get('/:id', (req, res) => {
  const followUp = followUps.get(req.params.id);
  if (!followUp) {
    return res.status(404).json({ error: 'FollowUp not found' });
  }
  res.json(followUp);
});

FollowUpRoutes.post('/', (req, res) => {
  const id = req.body.id || `followup_${Date.now()}`;
  const followUp = {
    id,
    title: req.body.title,
    description: req.body.description,
    type: req.body.type || 'TASK',
    priority: req.body.priority || 'MEDIUM',
    status: req.body.status || 'PENDING',
    dueDate: req.body.dueDate,
    assigneeId: req.body.assigneeId,
    companyId: req.body.companyId,
    departmentId: req.body.departmentId,
    metadata: req.body.metadata,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  followUps.set(id, followUp);
  res.status(201).json(followUp);
});

FollowUpRoutes.put('/:id', (req, res) => {
  const existing = followUps.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'FollowUp not found' });
  }
  const followUp = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: new Date()
  };
  followUps.set(req.params.id, followUp);
  res.json(followUp);
});

FollowUpRoutes.delete('/:id', (req, res) => {
  if (!followUps.has(req.params.id)) {
    return res.status(404).json({ error: 'FollowUp not found' });
  }
  followUps.delete(req.params.id);
  res.status(204).send();
});
