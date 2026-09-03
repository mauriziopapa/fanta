import { spawn } from 'node:child_process';
import fs from 'node:fs';

fs.rmSync(new URL('./.data', import.meta.url), { recursive: true, force: true });

// DATA_DIR esplicito: il test deve restare deterministico a prescindere da
// cosa esista gia' sull'host (es. una /data non correlata al volume Railway).
const PORT = 3444, K = 'segreto', B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, ['server.js'], {
  cwd: new URL('.', import.meta.url).pathname,
  env: { ...process.env, PORT: String(PORT), AUTH_TOKEN: K, DATA_DIR: new URL('./.data', import.meta.url).pathname },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
srv.stdout.on('data', d => (log += d));
srv.stderr.on('data', d => (log += d));

const wait = ms => new Promise(r => setTimeout(r, ms));
const out = [];
const t = (name, v) => out.push(`${name.padEnd(22)} ${v}`);

try {
  await wait(1200);

  t('health senza chiave', (await fetch(`${B}/health`)).status);
  t('root senza chiave', (await fetch(`${B}/`)).status);

  const r1 = await fetch(`${B}/?k=${K}`);
  t('root con chiave', r1.status);
  const cookie = (r1.headers.get('set-cookie') || '').split(';')[0];
  t('cookie emesso', cookie || 'NESSUNO');
  t('index bytes', (await r1.text()).length);

  t('root con cookie', (await fetch(`${B}/`, { headers: { cookie } })).status);
  t('ping', await (await fetch(`${B}/api/ping`, { headers: { cookie } })).text());

  const body = JSON.stringify({ budget: 1000, players: [{ id: 'b0', status: 'got', paid: 85 }] });
  const put = await fetch(`${B}/api/state`, { method: 'PUT', headers: { cookie, 'Content-Type': 'application/json' }, body });
  t('put stato', `${put.status} ${await put.text()}`);

  const get = await fetch(`${B}/api/state`, { headers: { cookie } });
  t('get stato', await get.text());
  t('round-trip identico', (await (await fetch(`${B}/api/state`, { headers: { cookie } })).text()) === body ? 'si' : 'NO');

  const bad = await fetch(`${B}/api/state`, { method: 'PUT', headers: { cookie }, body: 'non-json' });
  t('put non valido', bad.status);

  t('metodo non ammesso', (await fetch(`${B}/api/state`, { method: 'DELETE', headers: { cookie } })).status);
  t('file inesistente', (await fetch(`${B}/nope.html`, { headers: { cookie } })).status);
  t('path traversal', (await fetch(`${B}/%2e%2e%2fserver.js`, { headers: { cookie } })).status);

  t('file su disco', fs.existsSync(new URL('./.data/state.json', import.meta.url)) ? 'si' : 'NO');
} finally {
  srv.kill();
  console.log(out.join('\n'));
  console.log('--- log server ---\n' + log.trim());
}
