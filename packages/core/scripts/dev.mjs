import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');
const buildScript = path.join(__dirname, 'build.mjs');
const PORT = Number(process.env.PORT) || 4173;

let lastBuild = { sizeBytes: 0, builtAt: null, version: '-' };

function rebuild(reason) {
    try {
        execFileSync(process.execPath, [buildScript], { stdio: 'pipe' });
        const outPath = path.join(distDir, 'gengar.user.js');
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
        lastBuild = {
            sizeBytes: fs.statSync(outPath).size,
            builtAt: new Date(),
            version: pkg.version
        };
        const kb = (lastBuild.sizeBytes / 1024).toFixed(1);
        console.log(`[${lastBuild.builtAt.toLocaleTimeString()}] gengar v${lastBuild.version} (${kb} KB) - ${reason}`);
    } catch (err) {
        console.error('[gengar build error]', err.stderr?.toString() || err.message);
    }
}

rebuild('initial');

let debounceTimer = null;
const scheduleRebuild = reason => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => rebuild(reason), 80);
};

fs.watch(srcDir, { recursive: false }, (_ev, filename) => {
    if (filename && filename.endsWith('.js')) scheduleRebuild(`src/${filename}`);
});
fs.watch(buildScript, () => scheduleRebuild('scripts/build.mjs'));
fs.watch(path.join(rootDir, 'package.json'), () => scheduleRebuild('package.json'));

function renderLandingPage() {
    const kb = (lastBuild.sizeBytes / 1024).toFixed(1);
    const time = lastBuild.builtAt ? lastBuild.builtAt.toLocaleTimeString() : '-';
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>gengar · geng.ar</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e10;color:#efeff1;font:400 14px/1.5 "Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:24px}
  .card{width:100%;max-width:440px;background:#18181b;border:1px solid rgba(83,83,95,.48);border-radius:12px;padding:24px;box-shadow:0 16px 40px rgba(0,0,0,.55)}
  .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
  .brand{display:flex;align-items:center;gap:10px}
  .logo{width:34px;height:34px;border-radius:9px;background:rgba(145,71,255,.16);color:#a970ff;display:grid;place-items:center}
  h1{margin:0;font-size:19px;letter-spacing:-.02em;line-height:1.1}
  .domain{font-size:12px;color:#adadb8}
  .pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#00f593;background:rgba(0,245,147,.12);padding:3px 9px;border-radius:999px}
  .dot{width:6px;height:6px;border-radius:50%;background:#00f593}
  p{margin:0 0 18px;color:#adadb8;font-size:13.5px}
  .actions{display:grid;gap:8px}
  a.btn{display:flex;align-items:center;justify-content:space-between;text-decoration:none;padding:10px 14px;border-radius:6px;font-weight:600;font-size:13.5px;transition:background .12s ease}
  a.primary{background:#9147ff;color:#fff}
  a.primary:hover{background:#772ce8}
  a.secondary{background:rgba(83,83,95,.38);color:#efeff1}
  a.secondary:hover{background:rgba(83,83,95,.54)}
  .meta{margin-top:18px;padding-top:12px;border-top:1px solid rgba(83,83,95,.38);display:flex;justify-content:space-between;font-size:12px;color:#adadb8}
  code{background:#26262c;padding:2px 6px;border-radius:4px;color:#efeff1;font-size:12px}
</style>
</head>
<body>
  <main class="card">
    <div class="top">
      <div class="brand">
        <div class="logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12V5l4 3.5L12 6l3 2.5L19 5v7a7 7 0 0 1-14 0z"/><path d="M8.5 11.5l2 1.2m5-1.2l-2 1.2"/><path d="M8.5 15.2c1.8 1.2 5.2 1.2 7 0"/></svg></div>
        <div><h1>gengar</h1><div class="domain">geng.ar · v${lastBuild.version}</div></div>
      </div>
      <div class="pill"><span class="dot"></span>Live</div>
    </div>
    <p>Install into Tampermonkey or Violentmonkey. Press <code>⌥⇧A</code> or click the Gengar button in the Twitch player bar.</p>
    <div class="actions">
      <a class="btn primary" href="/gengar.user.js"><span>Install / Update gengar.user.js</span><span>${kb} KB →</span></a>
      <a class="btn secondary" href="/gengar.dev.user.js"><span>Local Dev Stub (@require file://)</span><span>Tampermonkey →</span></a>
    </div>
    <div class="meta"><span>Built ${time}</span><span>127.0.0.1:${PORT}</span></div>
  </main>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
    const cleanPath = (req.url || '/').split('?')[0];
    if (cleanPath === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(renderLandingPage());
        return;
    }
    if (cleanPath === '/gengar.user.js' || cleanPath === '/unique-twitch-adblock.user.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        fs.createReadStream(path.join(distDir, 'gengar.user.js')).pipe(res);
        return;
    }
    if (cleanPath === '/gengar.dev.user.js' || cleanPath === '/unique-twitch-adblock.dev.user.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        fs.createReadStream(path.join(distDir, 'gengar.dev.user.js')).pipe(res);
        return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n  gengar (geng.ar)`);
    console.log(`  Dev UI:     http://127.0.0.1:${PORT}/`);
    console.log(`  Userscript: http://127.0.0.1:${PORT}/gengar.user.js\n`);
});
