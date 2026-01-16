import { Router } from 'express';

export const DepartmentRoutes = Router();

const departments = new Map<string, any>();

DepartmentRoutes.get('/', (req, res) => {
  res.json(Array.from(departments.values()));
});

DepartmentRoutes.get('/roots', (req, res) => {
  const roots = Array.from(departments.values()).filter((d: any) => !d.parentId);
  res.json(roots);
});

DepartmentRoutes.get('/:id', (req, res) => {
  const department = departments.get(req.params.id);
  if (!department) {
    return res.status(404).json({ error: 'Department not found' });
  }
  res.json(department);
});

DepartmentRoutes.get('/:id/children', (req, res) => {
  const children = Array.from(departments.values()).filter((d: any) => d.parentId === req.params.id);
  res.json(children);
});

DepartmentRoutes.post('/', (req, res) => {
  const id = req.body.id || `dept_${Date.now()}`;
  const department = {
    id,
    name: req.body.name,
    code: req.body.code,
    parentId: req.body.parentId,
    companyId: req.body.companyId,
    settings: req.body.settings,
    status: req.body.status || 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  departments.set(id, department);
  res.status(201).json(department);
});

DepartmentRoutes.put('/:id', (req, res) => {
  const existing = departments.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Department not found' });
  }
  const department = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: new Date()
  };
  departments.set(req.params.id, department);
  res.json(department);
});

DepartmentRoutes.delete('/:id', (req, res) => {
  if (!departments.has(req.params.id)) {
    return res.status(404).json({ error: 'Department not found' });
  }
  departments.delete(req.params.id);
  res.status(204).send();
});
