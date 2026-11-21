import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.resolve(__dirname, '..');
const out = path.join(extDir, 'dist/store');
const { version } = JSON.parse(fs.readFileSync(path.join(extDir, 'package.json'), 'utf8'));

const MOUNTS = {
    '/ext/': path.join(extDir, 'dist/chrome'),
    '/core/': path.resolve(extDir, '../../packages/core/src')
};

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const grid = fs.readFileSync(path.resolve(extDir, '../web/src/components/grid.tsx'), 'utf8');
const LETTERS = [...grid.matchAll(/\[(\d+), (\d+), '([^']+)'\]/g)].map(([, col, row, text]) => [Number(col), Number(row), text]);

const BASE = `
*{box-sizing:border-box;margin:0}
html,body{overflow:hidden;background:#9146ff;color:#fff;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
`;

const SHOT = `${BASE}
html,body{width:1024px;height:640px}
.frame{position:absolute;inset:45px 51px}
.mast{position:absolute;top:0;right:0;width:275px;font-size:16px;line-height:1.35;text-box:trim-both cap alphabetic}
.mast b{display:block}
.cap{position:absolute;right:0;top:106px;width:275px;font-size:20px;line-height:1.3}
.cap b{display:block}
.head{position:absolute;left:0;bottom:0;font-size:86px;line-height:0.92;font-weight:700;letter-spacing:-0.05em;text-box:trim-both cap alphabetic}
.word{position:absolute;left:-10px;bottom:0;font-size:250px;line-height:1;font-weight:700;letter-spacing:-0.06em;text-box:trim-both cap text}
.video-player{position:absolute;overflow:hidden;background:#140733}
.stream{position:absolute;inset:0;background:radial-gradient(60% 75% at 30% 35%,#6a35d9 0%,transparent 70%),radial-gradient(50% 60% at 78% 68%,#4b22a6 0%,transparent 70%),linear-gradient(160deg,#2b1166,#140733)}
.badge{position:absolute;top:14px;right:14px;padding:3px 7px;border-radius:4px;background:#eb0400;font:600 13px/1.2 "Helvetica Neue",Helvetica,Arial,sans-serif;letter-spacing:.02em}
.player-controls{position:absolute;left:0;right:0;bottom:0;height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;background:linear-gradient(transparent,rgba(0,0,0,.65))}
.player-controls>div{display:flex;align-items:center;gap:4px}
.ctl{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;color:#fff}
.popup{position:absolute;left:0;top:0;width:300px;height:240px;transform:scale(1.6);transform-origin:0 0;border:0;box-shadow:0 0 0 1px #fff}
`;

const SVG = d => `<span class="ctl"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`;

const CONTROLS = `
<div class="player-controls">
  <div>${SVG('<path d="M8 5v14M16 5v14"/>')}${SVG('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/>')}</div>
  <div class="player-controls__right-control-group">${SVG('<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>')}${SVG('<rect x="3" y="6" width="18" height="12" rx="1"/><path d="M15 6v12"/>')}${SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>')}</div>
</div>`;

const MAST = '<p class="mast"><b>Gengar</b>Twitch ad blocker</p>';

const player = ({ left, top, width, height }) => `
<div class="video-player" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px">
  <div class="stream"></div>
  <span class="badge">LIVE</span>
  ${CONTROLS}
</div>`;

const overlay = script => `
<script type="module">
  import { overlay } from '/core/ui.js';
  const opts = { badge: true, catchup: true, source: true, fallback: false, player: 'popout' };
  const ui = overlay({
    version: '${version}',
    live: () => true,
    players: () => ['popout', 'embed', 'site', 'autoplay'],
    get: key => opts[key],
    stats: () => ({ breaks: 12, hidden: 2 }),
    telemetry: () => ({ quality: '1080p60', latency: 1.8, catching: false }),
    set() {}, upgrade() {}, simulate() {}, reload() {}, conflict: () => false
  });
  ui.mount();
  ${script}
  document.body.dataset.ready = '1';
</script>`;

const shot = body => `<!doctype html><html><head><meta charset="utf-8"><style>${SHOT}</style></head><body>${body}</body></html>`;

const PAGES = {
    player: () => shot(`
${player({ left: 51, top: 45, width: 614, height: 345 })}
<div class="frame">
  ${MAST}
  <p class="cap"><b>The stream keeps playing.</b>When an ad break starts, Gengar plays an ad-free copy of the same stream until it ends.</p>
  <h1 class="head">Twitch without<br>the ad breaks</h1>
</div>
${overlay("ui.banner({ ads: true, midroll: true, backup: 'popout', stripping: false }, true);")}`),

    panel: () => shot(`
${player({ left: -182, top: -52, width: 848, height: 477 })}
<div class="frame">
  ${MAST}
  <p class="cap"><b>No need to leave the stream.</b>Lock source quality, catch up to live or run a test ad break from the Gengar button.</p>
  <h1 class="head">Right inside<br>the player</h1>
</div>
${overlay('ui.banner({ ads: false }, true); ui.toggle(true);')}`),

    popup: () => shot(`
<div class="frame">
  <iframe class="popup" src="/ext/popup.html"></iframe>
  ${MAST}
  <p class="cap"><b>One click to check.</b>The Gengar icon shows the running total, what is happening on this tab and an off switch.</p>
  <h1 class="head">See what<br>it blocked</h1>
</div>
<script>document.querySelector('iframe').addEventListener('load', () => setTimeout(() => { document.body.dataset.ready = '1'; }, 300));</script>`),

    nothing: () => shot(`
<div class="frame">
  ${MAST}
  <p class="cap"><b>That is what Gengar collects.</b>No servers, no accounts and no analytics. It only talks to Twitch.</p>
  <h1 class="word">nothing</h1>
</div>
<script>document.body.dataset.ready = '1';</script>`),

    tile: () => tile({ width: 440, height: 280, inset: [24, 26], letter: 11, word: 54 }),
    marquee: () => tile({ width: 1400, height: 560, inset: [52, 64], letter: 22, word: 128 })
};

function tile({ width, height, inset, letter, word }) {
    const spans = LETTERS.map(([col, row, text]) => {
        const main = text === 'gengar';
        const style = `left:${(col / 32) * 100}%;top:${(row / 20) * 100}%;${main ? `font-size:${word}px;transform:translateY(-35%)` : ''}`;
        return `<span class="${main ? 'main' : 'faint'}" style="${style}">${text}</span>`;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}
html,body{width:${width}px;height:${height}px}
.grid{position:absolute;inset:${inset[0]}px ${inset[1]}px;font-size:${letter}px;line-height:1.05;font-weight:700;letter-spacing:-0.015em}
.grid span{position:absolute;white-space:pre}
.faint{opacity:.35}
.main{letter-spacing:-0.05em;line-height:1}
</style></head><body><div class="grid">${spans}</div>
<script>
  const main = document.querySelector('.main').getBoundingClientRect();
  const pad = ${Math.round(word * 0.25)};
  for (const el of document.querySelectorAll('.faint')) {
    const r = el.getBoundingClientRect();
    if (r.right > main.left - pad && r.left < main.right + pad && r.bottom > main.top - pad && r.top < main.bottom + pad) el.remove();
  }
  document.body.dataset.ready = '1';
</script></body></html>`;
}

const OUTPUTS = [
    ['player', 'screenshot-1.png', 1024, 640, 1.25],
    ['panel', 'screenshot-2.png', 1024, 640, 1.25],
    ['popup', 'screenshot-3.png', 1024, 640, 1.25],
    ['nothing', 'screenshot-4.png', 1024, 640, 1.25],
    ['tile', 'promo-small.png', 440, 280, 1],
    ['marquee', 'promo-marquee.png', 1400, 560, 1]
];

if (!fs.existsSync(path.join(MOUNTS['/ext/'], 'popup.html'))) {
    console.error('Run npm run build first.');
    process.exit(1);
}

const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname.startsWith('/page/')) {
        const page = PAGES[pathname.slice(6)];
        res.writeHead(page ? 200 : 404, { 'content-type': 'text/html' });
        return res.end(page ? page() : '');
    }
    const mount = Object.keys(MOUNTS).find(prefix => pathname.startsWith(prefix));
    const file = mount && path.join(MOUNTS[mount], pathname.slice(mount.length));
    if (!file || !fs.existsSync(file)) {
        res.writeHead(404);
        return res.end();
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
fs.mkdirSync(out, { recursive: true });

for (const [name, file, width, height, scale] of OUTPUTS) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
    await context.addInitScript(() => {
        if (!location.pathname.endsWith('/popup.html')) return;
        Object.defineProperty(window, 'chrome', {
            configurable: true,
            value: {
                tabs: { query: async () => [{ id: 1, url: 'https://www.twitch.tv/directory' }] },
                runtime: { sendMessage: async () => ({ enabled: true, total: 1284, tab: { blocked: 3, blocking: false, active: true } }) },
                storage: { local: { set: async () => {} } }
            }
        });
    });
    const page = await context.newPage();
    await page.goto(`${origin}/page/${name}`);
    await page.waitForSelector('body[data-ready="1"]');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
    await context.close();
    console.log(`${file}  ${width * scale}x${height * scale}`);
}

await browser.close();
server.close();
console.log(`Saved to ${path.relative(process.cwd(), out)}`);
