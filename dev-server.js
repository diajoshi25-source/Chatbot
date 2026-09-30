// Local preview server: run `npm run dev`, then open http://localhost:3000
// On Vercel this file isn't used: Vercel serves /public and /api by itself.
// (Don't rename it to server.js / index.js / app.js: Vercel would try to run it as the whole site.)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

try { process.loadEnvFile('.env.local'); } catch {}
const { POST } = await import('./api/chat.js');

const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  if (req.url === '/api/chat' && req.method === 'POST') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const response = await POST(new Request(`http://localhost${req.url}`, { method: 'POST', headers: req.headers, body: Buffer.concat(chunks) }));
    res.writeHead(response.status, { 'content-type': 'application/json' });
    return res.end(await response.text());
  }

  const path = normalize(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = await readFile(join('public', path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Mini Dia running at http://localhost:${PORT}`));
