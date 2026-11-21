import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { defaults, load, save } from '../src/config.js';
import * as m3u8 from '../src/m3u8.js';
import * as worker from '../src/worker.js';
import { blob } from '../src/blob.js';

const { attrs, variants, stamp, restamp, hasAds, hevc, swap, pick, strip, timeline, harvest, patch, align, rows } = m3u8;
const { token } = worker;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundlePath = path.resolve(__dirname, '../dist/gengar.user.js');
const sources = [defaults, ...Object.values(m3u8), ...Object.values(worker)].map(String);

const MASTER_V1 = `#EXTM3U
#EXT-X-TWITCH-INFO:NODE="video-edge-1",SERVER-TIME="1763700000.123"
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=2560x1440,CODECS="hev1.1.6.L150.90,mp4a.40.2",FRAME-RATE=60.000
https://video-weaver.edge.hls.ttvnw.net/v1/playlist/1440p60-hevc.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080,CODECS="avc1.64002A,mp4a.40.2",FRAME-RATE=60.000
https://video-weaver.edge.hls.ttvnw.net/v1/playlist/1080p60.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,CODECS="avc1.4D401F,mp4a.40.2",FRAME-RATE=30.000
https://video-weaver.edge.hls.ttvnw.net/v1/playlist/720p30.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,FRAME-RATE=30.000
https://video-weaver.edge.hls.ttvnw.net/v1/playlist/360p30-nocodec.m3u8`;

const MASTER_V2 = `#EXTM3U
#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE="1763700555.987"
#EXT-X-STREAM-INF:BANDWIDTH=6500000,RESOLUTION=1920x1080,CODECS="av01.0.08M.08,mp4a.40.2",FRAME-RATE=60.000
https://video-weaver.edge.hls.ttvnw.net/v2/playlist/1080p60-av1.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080,CODECS="avc1.64002A,mp4a.40.2",FRAME-RATE=60.000
https://video-weaver.edge.hls.ttvnw.net/v2/playlist/1080p60-avc.m3u8`;

const VARIANT = 'https://video-weaver.edge.hls.ttvnw.net/v1/playlist/1080p60.m3u8';
const CLEAN = '#EXTM3U\n#EXTINF:2.000,live\nhttps://cdn.ttvnw.net/clean-1.ts';
const AD = '#EXTM3U\n#EXT-X-DATERANGE:CLASS="twitch-stitched-ad",X-TV-TWITCH-AD-ROLL-TYPE="MIDROLL"\n#EXTINF:2.000,Amazon|1\nhttps://cdn.ttvnw.net/ad-1.ts';

function sandbox(onGql) {
    const posted = [];
    const box = {
        Date, Map, Set, URL, Math, JSON, Promise, Response, setTimeout,
        console: { log() {}, error() {} },
        opts: defaults(),
        client: { id: 'test', device: null, version: null, session: null, integrity: null, auth: null },
        state: { streams: new Map(), urls: new Map(), ads: new Map(), v2: false, reloaded: false, depth: 0, all: false, real: null },
        pending: new Map(),
        postMessage(msg) {
            posted.push(msg);
            if (msg.gengar !== 'fetch') return;
            const payload = onGql(JSON.parse(msg.init.body));
            box.settle({ id: msg.id, body: JSON.stringify(payload), status: 200, statusText: 'OK', headers: {} });
        }
    };
    vm.createContext(box);
    vm.runInContext(sources.join('\n'), box);
    const stream = box.track('demo', 'https://usher.ttvnw.net/api/channel/hls/demo.m3u8?fast_bread=true', MASTER_V1);
    box.state.streams.set('demo', stream);
    return { box, posted, stream };
}

test('attrs parses quoted strings, numbers, and bare tokens', () => {
    const a = attrs('#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080,CODECS="avc1.64002A,mp4a.40.2",FRAME-RATE=60.000');
    assert.equal(a.BANDWIDTH, 6000000);
    assert.equal(a.RESOLUTION, '1920x1080');
    assert.equal(a.CODECS, 'avc1.64002A,mp4a.40.2');
    assert.equal(a['FRAME-RATE'], 60);
});

test('server time is read and replaced in v1 and v2 masters', () => {
    assert.equal(stamp(MASTER_V1, false), '1763700000.123');
    assert.equal(stamp(restamp(MASTER_V1, '1763709999.000', false), false), '1763709999.000');
    assert.equal(stamp(MASTER_V2, true), '1763700555.987');
    assert.equal(stamp(restamp(MASTER_V2, '1763711111.555', true), true), '1763711111.555');
});

test('hasAds catches ad markers without flagging live twitch-trigger tags', () => {
    const opts = defaults();
    const live = `#EXTM3U
#EXT-X-DATERANGE:ID="session",CLASS="twitch-session"
#EXT-X-DATERANGE:ID="source",CLASS="twitch-stream-source",X-TV-TWITCH-STREAM-SOURCE="live"
#EXT-X-DATERANGE:ID="trigger-1",CLASS="twitch-trigger",X-TV-TWITCH-TRIGGER-URL="https://euw11.playlist.ttvnw.net/trigger/abc"
#EXTINF:2.000,live
https://video-edge.ttvnw.net/v1/segment/abc.ts`;
    assert.equal(hasAds(live, opts), false);
    assert.equal(hasAds('#EXT-X-DATERANGE:ID="stitched-ad-1",CLASS="twitch-stitched-ad"', opts), true);
    assert.equal(hasAds('#EXT-X-DATERANGE:CLASS="twitch-maf-ad"', opts), true);
    assert.equal(hasAds('#EXT-X-CUE-OUT:30', opts), true);
    assert.equal(hasAds('https://d2e2de1etea730.cloudfront.net/adsquared/seg1.ts', opts), true);
});

test('pick matches resolution and codec, and handles missing CODECS', () => {
    assert.equal(
        pick(MASTER_V2, { res: '1920x1080', fps: 60, codecs: 'avc1.64002A,mp4a.40.2' }),
        'https://video-weaver.edge.hls.ttvnw.net/v2/playlist/1080p60-avc.m3u8'
    );
    assert.equal(
        pick(MASTER_V1, { res: '640x360', fps: 30, codecs: '' }),
        'https://video-weaver.edge.hls.ttvnw.net/v1/playlist/360p30-nocodec.m3u8'
    );
});

test('swap replaces HEVC and AV1 variants with the closest AVC one', () => {
    assert.equal(hevc('hev1.1.6.L150.90'), true);
    assert.equal(hevc('av01.0.08M.08'), true);
    assert.equal(hevc('avc1.64002A'), false);
    assert.equal(hevc(undefined), false);

    const out = swap(MASTER_V1, variants(MASTER_V1).filter(v => v.res), false, false);
    assert.ok(out);
    assert.equal(out.includes('1440p60-hevc.m3u8'), false);
    assert.equal(out.includes('CODECS="avc1.64002A,mp4a.40.2"'), true);
    const urls = rows(out).filter(line => line.startsWith('https://'));
    assert.equal(new Set(urls).size, urls.length);
});

test('strip drops prefetches, neuters tracking URLs, and remembers ad segments', () => {
    const box = { Date, opts: defaults(), state: { ads: new Map(), all: false } };
    vm.createContext(box);
    vm.runInContext([rows, hasAds, strip].map(String).join('\n'), box);

    const playlist = `#EXTM3U
#EXT-X-DATERANGE:ID="ad",CLASS="twitch-stitched-ad",X-TV-TWITCH-AD-URL="https://ads.example.com/buy",X-TV-TWITCH-AD-CLICK-TRACKING-URL="https://track.example.com/click"
#EXTINF:2.000,Amazon|12345
https://cdn.example.com/ad-seg-1.ts
#EXTINF:2.000,live
https://cdn.example.com/live-seg-2.ts
#EXT-X-TWITCH-PREFETCH:https://cdn.example.com/ad-prefetch.ts`;

    const stream = { stripped: 0, stripping: false, allStripped: false };
    const out = box.strip(playlist, false, stream);

    assert.equal(stream.stripping, true);
    assert.equal(stream.stripped, 1);
    assert.equal(stream.allStripped, false);
    assert.equal(box.state.ads.has('https://cdn.example.com/ad-seg-1.ts'), true);
    assert.equal(box.state.ads.has('https://cdn.example.com/live-seg-2.ts'), false);
    assert.equal(out.includes('ads.example.com'), false);
    assert.equal(out.includes('track.example.com'), false);
    assert.equal(out.includes('#EXT-X-TWITCH-PREFETCH:'), false);
});

test('save persists under gengar_ and load restores it', () => {
    const store = new Map();
    globalThis.localStorage = {
        getItem: k => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v))
    };
    const a = defaults();
    save(a, 'player', 'site');
    save(a, 'catchup', false);
    store.set('gengar_early', '0');
    store.set('gengar_badge', 'maybe');

    assert.equal(store.get('gengar_player'), 'site');
    assert.equal(store.get('gengar_catchup'), 'false');

    const b = load(defaults());
    assert.equal(b.player, 'site');
    assert.equal(b.catchup, false);
    assert.equal(b.early, 0);
    assert.equal(b.badge, true);
    delete globalThis.localStorage;
});

test('a prewarmed backup is used with no GQL calls and returns seamlessly', async () => {
    let calls = 0;
    const { box, posted, stream } = sandbox(() => {
        calls++;
        return { data: { streamPlaybackAccessToken: { signature: 's', value: '{}' } } };
    });

    const warm = 'https://prewarm.hls.ttvnw.net/v1/playlist/1080p60.m3u8';
    stream.cache.set('site', { master: `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080,CODECS="avc1.64002A,mp4a.40.2",FRAME-RATE=60.000\n${warm}`, at: Date.now() });

    const real = async url => new Response(url === warm ? CLEAN : '', { status: 200 });

    assert.equal(await box.rewrite(VARIANT, AD, real), CLEAN);
    assert.equal(calls, 0);
    assert.equal(stream.backup, 'site');

    assert.equal(await box.rewrite(VARIANT, CLEAN, real), CLEAN);
    assert.equal(stream.inAd, false);
    assert.equal(posted.some(m => m.gengar === 'reload'), false);
    assert.equal(posted.some(m => m.gengar === 'nudge'), false);
    assert.ok(posted.some(m => m.gengar === 'end'));
});

test('falls back to the inline token query and races the other backups', async () => {
    const operations = [];
    const { box, stream } = sandbox(body => {
        operations.push(body.operationName);
        if (body.operationName === 'PlaybackAccessToken') return { errors: [{ message: 'PersistedQueryNotFound' }] };
        return { data: { streamPlaybackAccessToken: { signature: `sig_${body.variables.playerType}`, value: '{"channel":"demo"}' } } };
    });

    const real = async url => {
        if (url.includes('usher.ttvnw.net')) {
            const sig = new URL(url).searchParams.get('sig');
            return new Response(`#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080,CODECS="avc1.64002A,mp4a.40.2",FRAME-RATE=60.000\nhttps://backup.hls.ttvnw.net/${sig}.m3u8`, { status: 200 });
        }
        return new Response(url.includes('sig_popout') ? CLEAN : AD, { status: 200 });
    };

    assert.equal(await box.rewrite(VARIANT, AD, real), CLEAN);
    assert.ok(operations.includes('PlaybackAccessToken_Template'));
    assert.equal(stream.backup, 'popout');
    assert.equal(stream.pinned, 'popout');
});

test('align maps the backup sequence onto the main timeline without going back', () => {
    const main = `#EXTM3U
#EXT-X-MEDIA-SEQUENCE:7430
#EXT-X-TWITCH-LIVE-SEQUENCE:7430
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:01:20.000Z
#EXTINF:2.000,live
https://cdn/main-0.ts
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:01:22.000Z
#EXTINF:2.000,live
https://cdn/main-1.ts`;

    // the backup numbers its segments differently but starts two segments later
    const backup = `#EXTM3U
#EXT-X-MEDIA-SEQUENCE:100
#EXT-X-TWITCH-LIVE-SEQUENCE:100
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:01:24.000Z
#EXTINF:2.000,live
https://cdn/backup-0.ts
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:01:26.000Z
#EXTINF:2.000,live
https://cdn/backup-1.ts`;

    const line = timeline(main);
    assert.equal(line.seq, 7430);
    assert.equal(line.avg, 2000);

    const stream = { timeline: line, seq: 7430 };
    const aligned = align(backup, stream);
    assert.ok(aligned.includes('#EXT-X-MEDIA-SEQUENCE:7432'));
    assert.ok(aligned.includes('#EXT-X-TWITCH-LIVE-SEQUENCE:7432'));
    assert.equal(stream.seq, 7432);

    const older = `#EXTM3U
#EXT-X-MEDIA-SEQUENCE:99
#EXT-X-TWITCH-LIVE-SEQUENCE:99
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:01:22.000Z
#EXTINF:2.000,live
https://cdn/old-0.ts
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:01:24.000Z
#EXTINF:2.000,live
https://cdn/keep-1.ts
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:01:26.000Z
#EXTINF:2.000,live
https://cdn/keep-2.ts
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:01:28.000Z
#EXTINF:2.000,live
https://cdn/keep-3.ts
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:01:30.000Z
#EXTINF:2.000,live
https://cdn/keep-4.ts`;
    const trimmed = align(older, stream);
    assert.ok(trimmed.includes('#EXT-X-MEDIA-SEQUENCE:7432'));
    assert.equal(trimmed.includes('old-0.ts'), false);
    assert.ok(trimmed.includes('keep-1.ts'));
});

test('patch swaps ad segments for clean ones with the same timestamp', () => {
    const ad = `#EXTM3U
#EXT-X-MEDIA-SEQUENCE:500
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:05:00.000Z
#EXTINF:2.000,Amazon|1
https://cdn/ad-0.ts
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:05:02.000Z
#EXTINF:2.000,live
https://cdn/live-1.ts`;

    const partial = `#EXTM3U
#EXT-X-MEDIA-SEQUENCE:500
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:05:00.000Z
#EXTINF:2.000,live
https://cdn/clean-backup-0.ts
#EXT-X-PROGRAM-DATE-TIME:2026-11-21T08:05:02.000Z
#EXTINF:2.000,Amazon|2
https://cdn/ad-other-1.ts`;

    const out = patch(ad, harvest([partial]));
    assert.equal(out.count, 1);
    assert.equal(out.text.includes('ad-0.ts'), false);
    assert.ok(out.text.includes('clean-backup-0.ts'));
    assert.ok(out.text.includes('live-1.ts'));
});

test('token handles nested and flat GQL shapes', () => {
    assert.deepEqual(token({ data: { streamPlaybackAccessToken: { value: 'v1', signature: 's1' } } }), { value: 'v1', signature: 's1' });
    assert.deepEqual(token({ streamPlaybackAccessToken: { value: 'v2', signature: 's2' } }), { value: 'v2', signature: 's2' });
    assert.equal(token({ errors: [{ message: 'server error' }] }), null);
});

test('worker code stays out of the global scope Twitch shares', () => {
    const imported = [];
    const box = {
        URL, Response, Map, Set, console: { log() {} },
        addEventListener() {},
        fetch: async () => new Response(''),
        importScripts: url => imported.push(url),
        XMLHttpRequest: class {
            open() {}
            overrideMimeType() {}
            send() { this.responseText = 'twitch worker'; }
        }
    };
    box.self = box;
    vm.createContext(box);
    const url = 'blob:https://www.twitch.tv/test-worker';
    const before = box.fetch;
    vm.runInContext(blob(url, sources, { player: 'popout' }, { id: 'test' }), box);

    assert.deepEqual(imported, [url]);
    assert.notEqual(box.fetch, before);
    assert.doesNotThrow(() => vm.runInContext('const opts = 1, state = 2, client = 3, pending = 4; function read() {}', box));
});

test('built gengar.user.js and the worker blob compile', () => {
    assert.equal(fs.existsSync(bundlePath), true);
    const bundle = fs.readFileSync(bundlePath, 'utf8');
    assert.ok(bundle.startsWith('// ==UserScript=='));
    assert.ok(bundle.includes('// @namespace    https://geng.ar'));
    assert.ok(bundle.includes('// @match        *://*.twitch.tv/*'));

    const fns = bundle.match(/fns: \[([\s\S]*?)\]/)[1].split(',').map(name => name.trim());
    for (const name of ['defaults', 'timeline', 'drop', 'harvest', 'patch', 'align', 'backup', 'probe', 'prewarm', 'find', 'rewrite', 'hook', 'listen']) {
        assert.ok(fns.includes(name), `missing ${name} in fns`);
    }

    new vm.Script(bundle, { filename: 'gengar.user.js' });
    new vm.Script(blob('blob:https://www.twitch.tv/test-worker', sources, { player: 'popout' }, { id: 'test' }), { filename: 'blob.js' });
});
