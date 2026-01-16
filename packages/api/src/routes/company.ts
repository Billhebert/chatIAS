import { Router } from 'express';

export const CompanyRoutes = Router();

const companies = new Map<string, any>();

CompanyRoutes.get('/', (req, res) => {
  res.json(Array.from(companies.values()));
});

CompanyRoutes.get('/:id', (req, res) => {
  const company = companies.get(req.params.id);
  if (!company) {
    return res.status(404).json({ error: 'Company not found' });
  }
  res.json(company);
});

CompanyRoutes.post('/', (req, res) => {
  const id = req.body.id || `company_${Date.now()}`;
  const company = {
    id,
    name: req.body.name,
    document: req.body.document,
    documentType: req.body.documentType || 'CNPJ',
    email: req.body.email,
    phone: req.body.phone,
    address: req.body.address,
    settings: req.body.settings,
    metadata: req.body.metadata,
    status: req.body.status || 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  companies.set(id, company);
  res.status(201).json(company);
});

CompanyRoutes.put('/:id', (req, res) => {
  const existing = companies.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Company not found' });
  }
  const company = {
    ...existing,
    ...req.body,
    id: existing.id,
    updatedAt: new Date()
  };
  companies.set(req.params.id, company);
  res.json(company);
});

CompanyRoutes.delete('/:id', (req, res) => {
  if (!companies.has(req.params.id)) {
    return res.status(404).json({ error: 'Company not found' });
  }
  companies.delete(req.params.id);
  res.status(204).send();
});
