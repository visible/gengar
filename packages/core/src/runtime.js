export function runtime({ version, fns }) {
    const opts = defaults();
    const client = { id: 'kimne78kx3ncx6brgo4mv6wki5h1ko', device: null, version: null, session: null, integrity: null, auth: null };
    const workers = [];
    const stats = { breaks: 0, hidden: 0 };
    const session = Math.random().toString(36).slice(2);
    const keep = ['isVariantA', 'besuper/', '${patch_url}'];
    const watch = { channel: null, started: false, position: 0, buffered: 0, duration: 0, same: 0, fixedAt: 0, live: true };

    let ui = null;
    let target = null;
    let conflict = false;
    let stripping = false;
    let blocking = false;
    let paused = false;
    let catching = false;
    let storageBroken = false;
    let nudgedAt = 0;
    let reloadedAt = 0;
    let pauses = 0;
    let wedgeUntil = 0;
    let frames = -1;
    let frozen = 0;
    let sent = '';

    function report() {
        const data = { source: 'gengar', type: 'state', session, breaks: stats.breaks, hidden: stats.hidden, blocking };
        const key = `${data.breaks}:${data.hidden}:${data.blocking}`;
        if (key === sent) return;
        sent = key;
        try { window.postMessage(data, location.origin); } catch {}
    }

    function off() {
        try { return localStorage.getItem('gengar_off') === '1'; } catch { return false; }
    }

    function tell(type, data = {}) {
        for (const worker of workers) {
            try { worker.postMessage({ gengar: type, ...data }); } catch {}
        }
    }

    function relay({ id, url, init = {} }) {
        // XHR keeps other scripts' fetch hooks away from backup requests
        return new Promise(resolve => {
            const fail = error => resolve({ gengar: 'fetched', id, error });
            try {
                const xhr = new XMLHttpRequest();
                xhr.open(init.method || 'GET', url, true);
                for (const [name, value] of Object.entries(init.headers || {})) {
                    if (value != null) xhr.setRequestHeader(name, String(value));
                }
                xhr.timeout = 8000;
                xhr.onload = () => {
                    const headers = {};
                    for (const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
                        const cut = line.indexOf(':');
                        if (cut > 0) headers[line.slice(0, cut).trim().toLowerCase()] = line.slice(cut + 1).trim();
                    }
                    resolve({ gengar: 'fetched', id, status: xhr.status, statusText: xhr.statusText, headers, body: xhr.responseText });
                };
                xhr.onerror = () => fail('Network error');
                xhr.ontimeout = () => fail('Timeout');
                xhr.send(init.body ?? null);
            } catch (err) {
                fail(err.message);
            }
        });
    }

    function chain(W) {
        const list = [];
        for (let p = W; p; p = Object.getPrototypeOf(p)) list.push(p);
        return list;
    }

    function kept(W) {
        const src = String(W);
        return keep.some(k => src.includes(k));
    }

    function foreign(W) {
        const src = String(W);
        return src.includes('isVariantA') || (src.includes('twitch') && /m3u8|stitched/i.test(src));
    }

    function base(W) {
        let root = null;
        let parent = null;
        for (const p of chain(W)) {
            if (foreign(p)) {
                if (!kept(p)) conflict = true;
                if (parent) Object.setPrototypeOf(parent, Object.getPrototypeOf(p));
            } else {
                root ??= p;
                parent = p;
            }
        }
        return root;
    }

    function restack(W, list) {
        let parent = W;
        for (const p of list) {
            Object.setPrototypeOf(p, parent);
            parent = p;
        }
        return parent;
    }

    function settings() {
        return Object.fromEntries(Object.entries(opts).filter(([, value]) => typeof value !== 'object'));
    }

    function heard(worker, data) {
        switch (data?.gengar) {
            case 'banner':
                stripping = Boolean(data.stripping);
                blocking = Boolean(data.ads);
                ui?.banner(data, watch.live);
                report();
                break;
            case 'start':
                blocking = true;
                stats.breaks++;
                ui?.sync();
                report();
                break;
            case 'nudge':
                nudge();
                break;
            case 'reload':
                reload();
                break;
            case 'end':
                blocking = false;
                report();
                wedgeUntil = Date.now() + 12000;
                frames = -1;
                frozen = 0;
                if (opts.source) setTimeout(upgrade, 1500);
                break;
            case 'fetch':
                relay(data).then(reply => worker.postMessage(reply));
                break;
        }
    }

    function wrapWorker() {
        const extras = chain(window.Worker).filter(kept);
        const sources = fns.map(String);
        const Hooked = class Worker extends base(window.Worker) {
            constructor(url, options) {
                let twitch = false;
                try { twitch = new URL(url).origin.endsWith('.twitch.tv'); } catch {}
                if (!twitch) {
                    super(url, options);
                    return;
                }
                super(URL.createObjectURL(new Blob([blob(url, sources, settings(), client)], { type: 'text/javascript' })), options);
                workers.push(this);
                this.addEventListener('message', e => heard(this, e.data));
                let crashed = false;
                this.addEventListener('error', () => {
                    if (crashed) return;
                    crashed = true;
                    console.warn('[gengar] player worker crashed, reloading');
                    reload();
                });
            }
        };
        if (conflict) console.warn('[gengar] another Twitch ad blocker is running, turn it off to avoid clashes');

        let current = restack(Hooked, extras);
        try {
            Object.defineProperty(window, 'Worker', {
                get: () => current,
                set: value => {
                    if (!foreign(value) || kept(value)) current = value;
                    else conflict = true;
                }
            });
        } catch {
            conflict = true;
        }
    }

    function header(headers, name) {
        if (!headers) return undefined;
        if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
        const lower = name.toLowerCase();
        const key = Object.keys(headers).find(k => k.toLowerCase() === lower);
        return key === undefined ? undefined : headers[key];
    }

    function capture(headers) {
        const fields = [['device', 'X-Device-Id', 'Device-ID'], ['version', 'Client-Version'], ['session', 'Client-Session-Id'], ['integrity', 'Client-Integrity'], ['auth', 'Authorization']];
        for (const [field, ...names] of fields) {
            const value = names.map(name => header(headers, name)).find(Boolean);
            if (typeof value === 'string' && value !== client[field]) {
                client[field] = value;
                tell('client', { field, value });
            }
        }
    }

    function retarget(init) {
        // picture-by-picture tokens are requested a few seconds before most midrolls
        if (init.body.includes('picture-by-picture')) {
            tell('prewarm');
            init.body = '';
        }
        if (!opts.player || !init.body.includes('PlaybackAccessToken')) return;
        try {
            const body = JSON.parse(init.body);
            let changed = false;
            for (const item of [body].flat()) {
                if (item?.variables?.playerType && item.variables.playerType !== opts.player) {
                    item.variables.playerType = opts.player;
                    changed = true;
                }
            }
            if (changed) init.body = JSON.stringify(body);
        } catch {}
    }

    function wrapFetch() {
        const real = window.fetch;
        window.fetch = function (input, init) {
            const url = typeof input === 'string' ? input : typeof input?.url === 'string' ? input.url : '';
            if (url.includes('edge.ads.twitch.tv')) return Promise.resolve(new Response('', { status: 200 }));
            const headers = init?.headers || (input && typeof input === 'object' ? input.headers : null);
            if (url.includes('gql') && headers) {
                capture(headers);
                if (typeof init?.body === 'string' && init.body.includes('PlaybackAccessToken')) retarget(init);
            }
            return real.apply(this, arguments);
        };
    }

    function grab() {
        const el = document.querySelector('#root');
        const key = el && Object.keys(el).find(k => k.startsWith('__reactContainer'));
        const root = el?._reactRootContainer?._internalRoot?.current ?? (key ? el[key] : null);
        if (!root) return null;
        const search = (node, test) => {
            if (!node) return null;
            if (node.stateNode && test(node.stateNode)) return node.stateNode;
            for (let child = node.child; child; child = child.sibling) {
                const hit = search(child, test);
                if (hit) return hit;
            }
            return null;
        };
        let player = search(root, n => n.setPlayerActive && n.props?.mediaPlayerInstance)?.props.mediaPlayerInstance ?? null;
        if (player?.playerInstance) player = player.playerInstance;
        return { player, state: search(root, n => n.setSrc && n.setInitialPlaybackSettings) };
    }

    function telemetry() {
        const player = target?.player;
        if (!player) return { quality: null, latency: null, buffer: null, catching: false };
        const quality = player.core?.state?.quality;
        const latency = player.getLiveLatency?.();
        const buffer = player.getBufferDuration?.();
        return {
            quality: quality?.name || quality?.group || null,
            latency: Number.isFinite(latency) && latency >= 0 ? latency : null,
            buffer: Number.isFinite(buffer) ? buffer : null,
            catching
        };
    }

    function catchup(player) {
        const video = player?.getHTMLVideoElement?.();
        if (!video) return;
        const settle = () => {
            try { video.playbackRate = 1; } catch {}
            catching = false;
        };
        if (!opts.catchup || stripping || player.isPaused()) {
            if (catching) settle();
            return;
        }
        const latency = player.getLiveLatency?.();
        const buffer = player.getBufferDuration?.() ?? 0;
        if (!Number.isFinite(latency)) return;
        if (!catching && video.playbackRate !== 1) return;
        if (latency > opts.driftTrigger && buffer > 1.2) {
            const rate = latency > 7 ? 1.15 : 1.08;
            try {
                if ('preservesPitch' in video) video.preservesPitch = true;
                if (video.playbackRate !== rate) video.playbackRate = rate;
                catching = true;
            } catch {}
        } else if (catching && (latency <= opts.driftTarget || buffer <= 0.8)) {
            settle();
        }
    }

    function upgrade() {
        if (!opts.source || stripping) return;
        const player = target?.player || grab()?.player;
        if (typeof player?.getQualities !== 'function' || typeof player.setQuality !== 'function') return;
        try {
            const list = player.getQualities();
            const best = list?.find(q => q.group !== 'auto') || list?.[0];
            const now = player.core?.state?.quality;
            if (best && now && now.group !== best.group) player.setQuality(best);
        } catch {}
    }

    function resume(player) {
        try { player.play(); } catch {}
        const video = player.getHTMLVideoElement?.();
        if (video?.paused) video.play().catch(() => {});
    }

    function bounce(player) {
        player.pause();
        // resuming on a later tick keeps the player from sticking half-paused
        setTimeout(() => !paused && resume(player), 80);
    }

    function claim(force) {
        const found = grab();
        if (!found?.player || !found.state || (paused && !force)) return null;
        nudgedAt = watch.fixedAt = Date.now();
        watch.same = 0;
        return found;
    }

    function nudge(force) {
        const found = claim(force);
        if (found) bounce(found.player);
    }

    function reload(force) {
        const found = claim(force);
        if (!found) return;
        const { player, state } = found;
        if (!force && opts.reloadGap > 0 && nudgedAt - reloadedAt < opts.reloadGap * 1000) {
            bounce(player);
            return;
        }
        reloadedAt = nudgedAt;

        const keys = ['video-quality', 'video-muted', 'volume'];
        let saved = [];
        try {
            saved = keys.map(k => localStorage.getItem(k));
            const now = player.core?.state;
            if (storageBroken && now) {
                localStorage.setItem('video-muted', JSON.stringify({ default: now.muted }));
                localStorage.setItem('volume', now.volume);
                if (now.quality?.group) localStorage.setItem('video-quality', JSON.stringify({ default: now.quality.group }));
            }
        } catch {}

        state.setSrc({ isNewMediaPlayerInstance: true, refreshAccessToken: true });
        tell('reloaded');
        setTimeout(() => !paused && resume(player), 120);

        if (storageBroken && saved.some(Boolean)) {
            setTimeout(() => {
                try { keys.forEach((k, i) => saved[i] && localStorage.setItem(k, saved[i])); } catch {}
            }, 3000);
        }
    }

    function hideAds() {
        if (!opts.hide) return;
        const main = target?.player?.getHTMLVideoElement?.();
        for (const video of document.getElementsByTagName('video')) {
            let ad = false;
            try {
                const src = video.currentSrc || video.getAttribute('src') || '';
                if (src && !src.startsWith('blob:')) {
                    const host = new URL(src, location.href).hostname.toLowerCase();
                    ad = host === 'media-amazon.com' || host.endsWith('.media-amazon.com');
                }
            } catch {}
            if (ad && video !== main) {
                video.style.setProperty('display', 'none', 'important');
                try {
                    video.muted = true;
                    if (!video.paused) video.pause();
                } catch {}
                if (!video.dataset.gengar) {
                    video.dataset.gengar = 'hidden';
                    stats.hidden++;
                    ui?.sync();
                    report();
                }
            } else if (!ad && video.dataset.gengar) {
                // twitch reuses video elements between ads and the stream
                delete video.dataset.gengar;
                video.style.removeProperty('display');
                try { video.muted = false; } catch {}
            }
        }
        for (const el of document.querySelectorAll('[data-a-target="video-ad-label"], [data-test-selector="sad-overlay"]')) {
            if (el.style.display !== 'none') el.style.setProperty('display', 'none', 'important');
        }
    }

    function recover() {
        if (Date.now() - reloadedAt < 15000) return;
        const gate = document.querySelector('[data-a-target="player-overlay-content-gate"]');
        if (gate && /#(2000|3000|4000)\b/.test(gate.textContent || '')) {
            console.warn('[gengar] player error, reloading');
            reload(true);
        }
    }

    function channel(player) {
        const path = player.core?.state?.path;
        if (!path) return;
        const file = new URL(path).pathname.split('/').pop();
        if (!file?.endsWith('.m3u8')) return;
        const name = file.slice(0, -5);
        if (watch.channel === name) return;
        watch.channel = name;
        watch.started = false;
        watch.same = 0;
        if (opts.source) setTimeout(upgrade, 1200);
    }

    function wedge(player, position) {
        const quality = player.getHTMLVideoElement?.()?.getVideoPlaybackQuality?.();
        if (typeof quality?.totalVideoFrames !== 'number' || !(position > watch.position)) return;
        if (frames !== quality.totalVideoFrames) {
            frames = quality.totalVideoFrames;
            frozen = 0;
        } else if (++frozen >= 3) {
            nudge();
            wedgeUntil = 0;
            frozen = 0;
        }
    }

    function stall(position, buffered, duration) {
        const stuck = watch.started
            && (!opts.prerollCheck || position > opts.prerollOffset)
            && (watch.position === position || duration < opts.danger)
            && watch.buffered === buffered
            && watch.duration >= duration
            && (position !== 0 || buffered !== 0 || duration !== 0);
        if (!stuck) {
            watch.same = 0;
        } else if (++watch.same === opts.sameTicks) {
            if (opts.stallReload) reload();
            else nudge();
            watch.fixedAt = Date.now();
            watch.same = 0;
        }
        watch.position = position;
        watch.buffered = buffered;
        watch.duration = duration;
    }

    function check(player) {
        const video = player.getHTMLVideoElement?.();
        const stopped = player.isPaused() || Boolean(video?.paused);
        // the player can pause itself around a swap, so resume unless the viewer paused
        if (stopped && !paused && watch.started && !video?.ended && (blocking || Date.now() - nudgedAt < 10000)) {
            pauses++;
            if (pauses === 2) {
                resume(player);
            } else if (pauses >= 5) {
                pauses = 0;
                reload();
            }
        } else {
            pauses = 0;
        }
        if (stopped || video?.ended || stripping || watch.fixedAt > Date.now() - opts.stallGap) return;

        channel(player);
        if (player.getState() === 'Playing') {
            watch.started = true;
            catchup(player);
        }
        const { position, bufferedPosition: buffered } = player.core?.state ?? {};
        const duration = player.getBufferDuration();
        if (opts.wedge && Date.now() < wedgeUntil) wedge(player, position);
        if (opts.stalls && position !== undefined && buffered !== undefined) stall(position, buffered, duration);
        else watch.same = 0;
    }

    function loop() {
        hideAds();
        recover();
        ui?.button();
        if (target) {
            try {
                if (!target.player.core) target = null;
                else if (target.state.props?.content?.type === 'live') check(target.player);
            } catch {
                target = null;
            }
        }
        if (!target) {
            const found = grab();
            if (found?.player && found.state) {
                target = found;
                if (opts.source) setTimeout(upgrade, 1000);
            }
        }
        const live = target?.state?.props?.content?.type === 'live';
        if (watch.live && !live) ui?.banner({ ads: false }, false);
        watch.live = live;
        setTimeout(loop, opts.tick);
    }

    function stayVisible() {
        const hidden = document.__lookupGetter__?.('hidden');
        const webkitHidden = document.__lookupGetter__?.('webkitHidden');
        const fake = (prop, value) => {
            try { Object.defineProperty(document, prop, { get: () => value }); } catch {}
        };
        fake('visibilityState', 'visible');
        fake('hidden', false);
        fake(/Firefox/.test(navigator.userAgent) ? 'mozHidden' : 'webkitHidden', false);

        const swallow = e => {
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        let playing = true;
        const change = e => {
            const video = document.getElementsByTagName('video')[0];
            if (video) {
                if (hidden?.call(document) === true || webkitHidden?.call(document) === true) {
                    playing = !video.paused && !video.ended;
                } else {
                    watch.started = true;
                    if (typeof chrome !== 'undefined' && playing && !video.ended && video.paused && video.muted) video.play().catch(() => {});
                }
            }
            swallow(e);
        };
        for (const type of ['visibilitychange', 'webkitvisibilitychange', 'mozvisibilitychange']) {
            document.addEventListener(type, change, true);
        }
        document.addEventListener('hasFocus', swallow, true);
    }

    function cacheStorage() {
        try {
            const cache = new Map(['video-quality', 'video-muted', 'volume', 'lowLatencyModeEnabled', 'persistenceEnabled'].map(k => [k, localStorage.getItem(k)]));
            const set = localStorage.setItem;
            const get = localStorage.getItem;
            const getter = function (key) {
                return cache.has(key) ? cache.get(key) : get.apply(this, arguments);
            };
            localStorage.setItem = function (key, value) {
                if (cache.has(key)) cache.set(key, value);
                return set.apply(this, arguments);
            };
            localStorage.getItem = getter;
            storageBroken = localStorage.getItem !== getter;
        } catch {
            storageBroken = true;
        }
    }

    function trackPause() {
        const sample = () => setTimeout(() => {
            if (target?.player) paused = target.player.isPaused();
        }, 60);
        document.addEventListener('click', e => {
            if (e.target?.closest?.('[data-a-target="player-play-pause-button"], [data-a-target="player-overlay-click-handler"]')) sample();
        }, true);
        document.addEventListener('keydown', e => {
            if ((e.code === 'Space' || e.key?.toLowerCase() === 'k') && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) sample();
        }, true);
    }

    function ready() {
        stayVisible();
        cacheStorage();
        trackPause();
        ui?.mount();
    }

    function wanted() {
        let nested;
        try { nested = window.frameElement !== null; } catch { nested = true; }
        const { hostname, pathname = '' } = location;
        if (nested && hostname !== 'player.twitch.tv' && hostname !== 'embed.twitch.tv' && !pathname.startsWith('/embed/')) return false;
        return hostname !== 'clips.twitch.tv' && !/^\/[^/]+\/clip\/[^/]+/.test(pathname);
    }

    function set(key, value) {
        save(opts, key, value);
        tell('option', { key, value });
    }

    function boot() {
        if (!wanted()) return;
        if (off()) {
            console.log('[gengar] turned off from the extension');
            return;
        }
        if (window.gengar) return;
        console.log(`[gengar] v${version} active on ${location.hostname} (https://geng.ar)`);

        load(opts);
        ui = overlay({
            version,
            players,
            get: key => opts[key],
            set,
            stats: () => stats,
            telemetry,
            conflict: () => conflict,
            upgrade,
            live: () => watch.live,
            reload: () => reload(true),
            simulate: depth => tell('simulate', { depth })
        });
        window.gengar = {
            version,
            homepage: 'https://geng.ar',
            panel: open => ui?.toggle(open),
            reload: () => reload(true),
            nudge: () => nudge(true),
            simulate: depth => depth >= 0 && tell('simulate', { depth }),
            stripAll: () => tell('stripall'),
            stats: () => ({ ...stats }),
            telemetry,
            workers: () => workers
        };

        wrapWorker();
        wrapFetch();
        loop();
        if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', ready);
        else ready();

        window.addEventListener('message', e => {
            if (e.source !== window || e.data?.source !== 'gengar') return;
            if (e.data.type === 'ask') {
                sent = '';
                report();
            } else if (e.data.type === 'panel') {
                if (e.data.open) document.querySelector('.video-player')?.scrollIntoView({ block: 'nearest' });
                ui?.toggle(e.data.open === true);
            }
        });
        report();
    }

    return { boot };
}
