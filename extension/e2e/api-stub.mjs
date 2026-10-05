import { createServer } from 'node:http';
const prompts = [
  { id: 'p1', title: 'Code review', description: null, tags: [], updated_at: '2026-10-05', content: 'Review this code:\nfocus on bugs ✅', is_favorite: true },
  { id: 'p2', title: 'Email reply', description: null, tags: ['writing'], updated_at: '2026-10-04', content: 'Write a polite reply.', is_favorite: false },
];
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.headers.authorization !== 'Bearer ps_e2e') return res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { code: 'unauthorized', message: 'x' } }));
  if (req.url?.startsWith('/api/v1/prompts')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ prompts }));
  res.writeHead(404).end();
}).listen(4599);
