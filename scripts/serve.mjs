// Servidor local para testar a extensão no Owlbear antes de publicar.
// Uso: node scripts/serve.mjs  ->  adicione http://localhost:5174/manifest.json no Owlbear.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 5174);
const ROOT = resolve(fileURLToPath(new URL('../owlbear/', import.meta.url)));
const PUBLIC_BASE = 'https://kevinaraujo22.github.io/owlbear-rpgpedia/owlbear/';
const LOCAL_BASE = `http://localhost:${PORT}/`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  const path = decodeURIComponent(new URL(req.url, LOCAL_BASE).pathname);
  const file = normalize(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
  try {
    let body = await readFile(file);
    if (path === '/manifest.json') body = body.toString().replaceAll(PUBLIC_BASE, LOCAL_BASE);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => {
  console.log(`Extensão servida em ${LOCAL_BASE}`);
  console.log(`No Owlbear: Perfil > Extensões > Adicionar > ${LOCAL_BASE}manifest.json`);
});
