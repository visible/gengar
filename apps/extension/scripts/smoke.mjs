import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.resolve(__dirname, '..');
const unpacked = path.join(extDir, 'dist/chrome');
const shots = path.join(extDir, 'dist/shots');
const requested = process.argv.slice(2).find(arg => !arg.startsWith('--'));

let failed = 0;
function check(name, ok, detail = '') {
    if (!ok) failed++;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const DIRECTORIES = ['category/chess', 'category/music', 'category/art', 'all'];

async function findLiveChannels(page) {
    const channels = [];
    for (const directory of DIRECTORIES) {
        await page.goto(`https://www.twitch.tv/directory/${directory}`, { waitUntil: 'domcontentloaded' });
        const found = await page
            .waitForSelector('a[data-a-target="preview-card-image-link"]', { timeout: 20000 })
            .then(() => page.$$eval('a[data-a-target="preview-card-image-link"]', links => links.map(link => link.getAttribute('href').split('/')[1])))
            .catch(() => []);
        channels.push(...found.slice(0, 3));
    }
    return [...new Set(channels)];
}

async function openPlayable(page, channels) {
    for (const channel of channels) {
        await page.goto(`https://www.twitch.tv/${channel}`, { waitUntil: 'domcontentloaded' });
        const state = await poll(() => page.evaluate(() => {
            if (document.body.innerText.includes('intended for certain audiences')) return 'gated';
            const video = document.querySelector('video');
            return video && !video.paused && video.currentTime > 1 ? 'playing' : null;
        }), 25000);
        if (state === 'playing') return channel;
        console.log(`      skipping ${channel}, ${state === 'gated' ? 'mature content needs a login' : 'the stream did not start'}`);
    }
    return null;
}

async function poll(fn, timeout = 20000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
        const value = await fn().catch(() => null);
        if (value) return value;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return null;
}

fs.mkdirSync(shots, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gengar-smoke-'));
const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: !process.argv.includes('--headed'),
    viewport: { width: 1280, height: 800 },
    args: [
        `--disable-extensions-except=${unpacked}`,
        `--load-extension=${unpacked}`,
        '--mute-audio',
        '--autoplay-policy=no-user-gesture-required'
    ]
});

try {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    check('service worker running', Boolean(id), id);

    const tabState = () => worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ url: '*://*.twitch.tv/*' });
        const { total = 0 } = await chrome.storage.local.get('total');
        return { badge: await chrome.action.getBadgeText({ tabId: tab.id }), total };
    });

    const twitch = context.pages()[0] ?? (await context.newPage());
    const logs = [];
    twitch.on('console', message => message.text().startsWith('[gengar]') && logs.push(message.text()));
    const channel = await openPlayable(twitch, requested ? [requested] : await findLiveChannels(twitch));
    check('found a playable live stream', Boolean(channel), channel ?? 'none of the first channels played');

    await twitch.waitForFunction(() => window.gengar?.version, null, { timeout: 20000 });
    check('runtime boots in the page', logs.some(line => line.includes('active on')), logs.find(line => line.includes('active on')));

    const mounted = await twitch
        .waitForSelector('[data-gengar="button"]', { state: 'attached', timeout: 45000 })
        .then(() => true, () => false);
    check('player button mounted', mounted);

    const workers = await poll(() => twitch.evaluate(() => window.gengar.workers().length), 30000);
    check('twitch worker hooked', Boolean(workers), `${workers ?? 0} worker`);

    if (mounted) {
        await twitch.evaluate(() => document.querySelector('[data-gengar="button"]').click());
        const open = await poll(() => twitch.evaluate(() =>
            document.querySelector('[data-gengar="panel"]')?.shadowRoot?.querySelector('.panel')?.dataset.open === '1'
        ), 5000);
        check('panel opens from the button', Boolean(open));
        await twitch.screenshot({ path: path.join(shots, 'player.png') });
        await twitch.evaluate(() => window.gengar.panel());
    }

    await twitch.evaluate(() => window.gengar.simulate(1));
    const breaks = await poll(() => twitch.evaluate(() => window.gengar.stats().breaks), 45000);
    await twitch.evaluate(() => window.gengar.simulate(0));
    check('simulated ad break blocked', Boolean(breaks), `${breaks ?? 0} break`);

    const counted = await poll(async () => {
        const state = await tabState();
        return state.badge !== '' && state.total > 0 ? state : null;
    }, 10000);
    check('badge and total updated', Boolean(counted), counted ? `badge ${counted.badge}, total ${counted.total}` : '');

    const popup = await context.newPage();
    await popup.setViewportSize({ width: 300, height: 240 });
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForFunction(() => document.querySelector('[data-ref="status"]').textContent !== '');
    const total = await popup.textContent('[data-ref="total"]');
    check('popup shows the total', total === String(counted?.total ?? -1), `shows ${total}`);
    await popup.screenshot({ path: path.join(shots, 'popup-on.png') });

    logs.length = 0;
    await popup.click('.power');
    const off = await poll(() => twitch.evaluate(() => !window.gengar && document.readyState !== 'loading'), 20000);
    check('turning off reloads twitch without blocking', Boolean(off) && logs.some(line => line.includes('turned off')));
    await popup.screenshot({ path: path.join(shots, 'popup-off.png') });

    logs.length = 0;
    await popup.click('.power');
    const on = await poll(() => twitch.evaluate(() => Boolean(window.gengar?.version)), 20000);
    check('turning on brings it back', Boolean(on));

    await twitch.waitForSelector('[data-gengar="button"]', { state: 'attached', timeout: 45000 }).catch(() => {});
    await twitch.bringToFront();
    const linked = await poll(async () => {
        await popup.reload();
        await popup.waitForFunction(() => document.querySelector('[data-ref="status"]').textContent !== '');
        return popup.evaluate(() => !document.querySelector('.settings').hidden);
    }, 15000);
    check('popup links to player settings on a stream', Boolean(linked));
    if (linked) {
        await popup.screenshot({ path: path.join(shots, 'popup-stream.png') });
        await popup.click('.settings');
        const opened = await poll(() => twitch.evaluate(() =>
            document.querySelector('[data-gengar="panel"]')?.shadowRoot?.querySelector('.panel')?.dataset.open === '1'
        ), 5000);
        check('player settings opens the panel', Boolean(opened));

        if (opened) {
            const again = await context.newPage();
            await twitch.bringToFront();
            await again.goto(`chrome-extension://${id}/popup.html`);
            const closed = await poll(() => twitch.evaluate(() =>
                document.querySelector('[data-gengar="panel"]')?.shadowRoot?.querySelector('.panel')?.dataset.open === '0'
            ), 5000);
            check('opening the popup closes player settings', Boolean(closed));
        }
    }
} finally {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} check${failed === 1 ? '' : 's'} failed` : `\nAll checks passed. Screenshots in ${path.relative(process.cwd(), shots)}`);
process.exit(failed ? 1 : 0);
