import express from 'express';
import { prisma } from './prisma.js';
import { codesearch, websearch, webfetch, task, skill, grep, glob, read, write, edit, bash, todowrite, question } from './opencode-tools.js';

const app = express();
app.use(express.json());

app.get('/api/opencode/tools', (req, res) => {
  res.json({
    tools: [
      { name: 'codesearch', description: 'Search code using Exa AI', category: 'search' },
      { name: 'websearch', description: 'Search the web using Exa AI', category: 'search' },
      { name: 'webfetch', description: 'Fetch content from a URL', category: 'search' },
      { name: 'task', description: 'Execute complex multi-step tasks', category: 'ai' },
      { name: 'skill', description: 'Load and execute a skill', category: 'ai' },
      { name: 'grep', description: 'Search file contents', category: 'file' },
      { name: 'glob', description: 'Find files by pattern', category: 'file' },
      { name: 'read', description: 'Read a file', category: 'file' },
      { name: 'write', description: 'Write to a file', category: 'file' },
      { name: 'edit', description: 'Edit a file', category: 'file' },
      { name: 'bash', description: 'Execute bash commands', category: 'system' },
      { name: 'todowrite', description: 'Create and manage todo lists', category: 'custom' },
      { name: 'question', description: 'Ask user questions', category: 'custom' }
    ]
  });
});

app.post('/api/opencode/codesearch', async (req, res) => {
  const result = await codesearch(req.body);
  res.json(result);
});

app.post('/api/opencode/websearch', async (req, res) => {
  const result = await websearch(req.body);
  res.json(result);
});

app.post('/api/opencode/webfetch', async (req, res) => {
  const result = await webfetch(req.body);
  res.json(result);
});

app.post('/api/opencode/task', async (req, res) => {
  const result = await task(req.body);
  res.json(result);
});

app.post('/api/opencode/skill', async (req, res) => {
  const result = await skill(req.body);
  res.json(result);
});

app.post('/api/opencode/grep', async (req, res) => {
  const result = await grep(req.body);
  res.json(result);
});

app.post('/api/opencode/glob', async (req, res) => {
  const result = await glob(req.body);
  res.json(result);
});

app.post('/api/opencode/read', async (req, res) => {
  const result = await read(req.body);
  res.json(result);
});

app.post('/api/opencode/write', async (req, res) => {
  const result = await write(req.body);
  res.json(result);
});

app.post('/api/opencode/edit', async (req, res) => {
  const result = await edit(req.body);
  res.json(result);
});

app.post('/api/opencode/bash', async (req, res) => {
  const result = await bash(req.body);
  res.json(result);
});

app.post('/api/opencode/todowrite', async (req, res) => {
  const result = await todowrite(req.body);
  res.json(result);
});

app.post('/api/opencode/question', async (req, res) => {
  const result = await question(req.body);
  res.json(result);
});

app.post('/api/opencode/execute', async (req, res) => {
  const { tool, args } = req.body;
  res.json({ tool, args, status: 'simulated', message: 'Tool execution simulated' });
});

export default app;
