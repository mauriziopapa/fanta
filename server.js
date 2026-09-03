// Gestore Asta Fantacalcio — server minimo per Railway.
// Nessuna dipendenza: solo i moduli inclusi in Node.

import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(DIR, 'public');
const PORT = process.env.PORT || 3000;

// Su Railway monta un Volume sul path /data: se e' presente lo usiamo in automatico,
// cosi' lo stato sopravvive ai redeploy anche senza impostare DATA_DIR a mano.
// DATA_DIR resta disponibile per forzare un percorso diverso.
const DATA_DIR = process.env.DATA_DIR || (fsSync.existsSync('/data') ? '/data' : path.join(DIR, '.data'));
const STATE = path.join(DATA_DIR, 'state.json');
fsSync.mkdirSync(DATA_DIR, { recursive: true });

// L'URL di Railway e' pubblico: imposta AUTH_TOKEN per tenere fuori gli altri.
const TOKEN = process.env.AUTH_TOKEN || '';
const COOKIE = 'asta_k';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const send = (res, code, body, type = 'text/plain; charset=utf-8', extra = {}) => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
  res.end(body);
};

function authorised(req, url) {
  if (!TOKEN) return true;
  if (url.searchParams.get('k') === TOKEN) return 'set-cookie';
  const raw = req.headers.cookie || '';
  return raw.split(';').some(c => c.trim() === `${COOKIE}=${TOKEN}`);
}

function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (p === '/health') return send(res, 200, 'ok');

  const auth = authorised(req, url);
  if (!auth) {
    return send(res, 401,
      '<!doctype html><meta charset=utf-8><title>Asta</title>' +
      '<body style="font-family:system-ui;background:#0e1013;color:#e6e9ee;padding:40px">' +
      '<h1 style="font-size:18px">Accesso riservato</h1>' +
      '<p style="color:#8b95a3">Apri il link con la chiave: <code>?k=LA_TUA_CHIAVE</code></p>',
      'text/html; charset=utf-8');
  }
  const cookieHeader = auth === 'set-cookie'
    ? { 'Set-Cookie': `${COOKIE}=${TOKEN}; Path=/; Max-Age=31536000; SameSite=Lax` }
    : {};

  // ---- API ----
  if (p === '/api/ping') return send(res, 200, 'ok', 'text/plain; charset=utf-8', cookieHeader);

  if (p === '/api/state') {
    if (req.method === 'GET') {
      try {
        const raw = await fs.readFile(STATE, 'utf8');
        return send(res, 200, raw, TYPES['.json'], cookieHeader);
      } catch {
        return send(res, 200, '{}', TYPES['.json'], cookieHeader);
      }
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      try {
        const body = await readBody(req);
        JSON.parse(body); // rifiuta payload non validi
        const tmp = STATE + '.tmp';
        await fs.writeFile(tmp, body, 'utf8');
        await fs.rename(tmp, STATE); // scrittura atomica: niente file mezzo scritto
        return send(res, 200, '{"ok":true}', TYPES['.json'], cookieHeader);
      } catch (e) {
        return send(res, 400, JSON.stringify({ error: String(e.message || e) }), TYPES['.json']);
      }
    }
    return send(res, 405, 'method not allowed');
  }

  // ---- file statici ----
  const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden');

  try {
    const buf = await fs.readFile(file);
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    return send(res, 200, buf, type, cookieHeader);
  } catch {
    return send(res, 404, 'not found');
  }
});

server.listen(PORT, () => {
  console.log(`Asta in ascolto sulla porta ${PORT}`);
  console.log(`Stato in ${STATE}`);
  console.log(TOKEN ? 'Accesso protetto da AUTH_TOKEN.' : 'ATTENZIONE: nessun AUTH_TOKEN, il sito e\' pubblico.');
});
