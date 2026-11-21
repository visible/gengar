export function read(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.overrideMimeType('text/javascript');
    xhr.send();
    return xhr.responseText;
}

export function log(...args) {
    if (opts.debug) console.log('[gengar]', ...args);
}

export function rand(length, chars = 'abcdefghijklmnopqrstuvwxyz0123456789') {
    let out = '';
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

export function token(json) {
    if (!json || typeof json !== 'object') return null;
    // some embed responses put the token at the root
    return json.data?.streamPlaybackAccessToken || json.streamPlaybackAccessToken || null;
}

export function access(channel, type, inline) {
    const variables = { isLive: true, login: channel, playerType: type, platform: type === 'autoplay' ? 'android' : 'web' };
    if (inline) {
        return gql({
            operationName: 'PlaybackAccessToken_Template',
            query: 'query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $playerType: String!, $platform: String!) { streamPlaybackAccessToken(channelName: $login, params: {platform: $platform, playerBackend: "mediaplayer", playerType: $playerType}) @include(if: $isLive) { value signature authorization { isForbidden forbiddenReasonCode } __typename } }',
            variables
        });
    }
    return gql({
        operationName: 'PlaybackAccessToken',
        variables: { ...variables, isVod: false, vodID: '' },
        extensions: { persistedQuery: { version: 1, sha256Hash: 'ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9' } }
    });
}

export function gql(body) {
    client.device ||= rand(32);
    const headers = { 'Client-ID': client.id, 'X-Device-Id': client.device };
    if (client.auth) headers.Authorization = client.auth;
    if (client.integrity) headers['Client-Integrity'] = client.integrity;
    if (client.version) headers['Client-Version'] = client.version;
    if (client.session) headers['Client-Session-Id'] = client.session;
    return new Promise((resolve, reject) => {
        const id = rand(12);
        pending.set(id, { resolve, reject });
        postMessage({ gengar: 'fetch', id, url: 'https://gql.twitch.tv/gql', init: { method: 'POST', body: JSON.stringify(body), headers } });
    });
}

export function settle({ id, error, body, status, statusText, headers }) {
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (error) job.reject(new Error(error));
    else job.resolve(new Response(body, { status, statusText, headers }));
}

export async function backup(stream, type, real) {
    const hit = stream.cache.get(type);
    if (hit && Date.now() - hit.at < opts.cacheMs) return { master: hit.master, fresh: false };
    try {
        let res = await access(stream.channel, type, false);
        let tok = null;
        if (res.status === 200) {
            const json = await res.json();
            tok = token(json);
            if (!tok && json?.errors?.some(e => String(e?.message || '').includes('PersistedQueryNotFound'))) {
                res = await access(stream.channel, type, true);
                if (res.status === 200) tok = token(await res.json());
            }
        }
        if (tok?.signature && tok.value) {
            const url = new URL(`https://usher.ttvnw.net/api/${state.v2 ? 'v2/' : ''}channel/hls/${stream.channel}.m3u8${stream.query}`);
            url.searchParams.set('sig', tok.signature);
            url.searchParams.set('token', tok.value);
            // reusing the page's play session can hand the backup the same ads
            if (url.searchParams.has('play_session_id')) url.searchParams.set('play_session_id', rand(32, '0123456789abcdef'));
            url.searchParams.set('p', String(Math.floor(Math.random() * 9999999)));
            const got = await real(url.href);
            if (got.status === 200) {
                const master = await got.text();
                stream.cache.set(type, { master, at: Date.now() });
                stream.failed.delete(type);
                return { master, fresh: true };
            }
            log(`usher ${got.status} for ${type}`);
        } else {
            log(`no token for ${type} (${res.status})`);
        }
    } catch (err) {
        log(`backup ${type} failed:`, err?.message || err);
    }
    stream.failed.set(type, Date.now());
    return { master: null, fresh: true };
}

export async function probe(stream, type, index, want, real) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const { master, fresh } = await backup(stream, type, real);
        if (master) {
            try {
                const url = pick(master, want);
                const res = url ? await real(url) : null;
                const text = res?.status === 200 ? await res.text() : '';
                if (text) {
                    const clean = !hasAds(text) && (state.depth === 0 || index >= state.depth - 1);
                    if (clean || fresh) return { type, text, clean };
                }
            } catch {}
        }
        stream.cache.delete(type);
        if (fresh) break;
    }
    return { type, text: null, clean: false };
}

export function prewarm(stream, real, now) {
    if (!opts.prewarm || (!now && stream.warming)) return;
    stream.warming = true;
    const type = (opts.pin && stream.pinned) || opts.backups.find(t => t !== opts.player) || opts.backups[0];
    if (!type) return;
    const run = () => {
        if (!state.streams.has(stream.channel)) return;
        if (now) stream.cache.delete(type);
        backup(stream, type, real).then(({ master }) => master && log(`prewarmed ${type}`)).catch(() => {});
    };
    if (now) run();
    else setTimeout(run, 1200);
}

export async function find(stream, want, real) {
    const types = opts.fallback ? [...opts.backups, 'autoplay'] : [...opts.backups];
    const first = (opts.pin && stream.pinned) || opts.backups.find(t => stream.cache.has(t));
    if (types.indexOf(first) > 0) {
        types.splice(types.indexOf(first), 1);
        types.unshift(first);
    }

    const now = Date.now();
    const quiet = stream.reloadedAt > now - opts.quietMs;
    const probed = [];
    let chosen = null;
    let stale = null;
    let spare = null;

    const current = text => {
        const live = stream.timeline?.last;
        const own = live ? timeline(text)?.last : null;
        return !live || !own || own >= live - 3000;
    };
    const cooling = type => now - (stream.failed.get(type) ?? 0) < opts.failMs;
    const take = (result, pin) => {
        chosen = result;
        if (pin && opts.pin) stream.pinned = result.type;
    };
    const seen = result => {
        if (!result.text) return;
        probed.push(result.text);
        if (result.type === opts.lastResort) spare ??= result.text;
    };

    const head = await probe(stream, types[0], 0, want, real);
    seen(head);
    if (head.clean) {
        if (current(head.text)) take(head, true);
        else stale = head;
    } else if (quiet && head.text) {
        take(head, false);
    }

    if (!chosen && types.length > 1) {
        const rest = types
            .map((type, index) => ({ type, index }))
            .slice(1)
            .filter(({ type }) => type !== 'autoplay' && !cooling(type));
        const results = await Promise.all(rest.map(({ type, index }) => probe(stream, type, index, want, real)));
        for (const result of results) {
            seen(result);
            if (!result.clean || chosen) continue;
            if (current(result.text)) take(result, true);
            else stale ??= result;
        }
        if (!chosen && stale) take(stale, true);

        const auto = types.indexOf('autoplay');
        if (!chosen && auto > 0) {
            const result = await probe(stream, 'autoplay', auto, want, real);
            if (result.text) {
                probed.push(result.text);
                take(result, result.clean);
            }
        }
    }

    if (!chosen && spare) chosen = { type: opts.lastResort, text: spare };
    return { chosen, probed };
}

export function ping(stream, text, real) {
    const first = segments(rows(text)).find(s => !s.live && s.url !== undefined && !stream.pinged.has(s.url));
    if (!first) return;
    stream.pinged.add(first.url);
    real(first.url).then(r => r.blob()).catch(() => {});
}

export async function onAd(stream, url, text, real) {
    stream.midroll = text.includes('"MIDROLL"') || text.includes('"midroll"');
    if (!stream.inAd) {
        stream.inAd = true;
        stream.strippedAny = false;
        stream.allStreak = 0;
        postMessage({ gengar: 'start', midroll: stream.midroll });
        postMessage({ gengar: 'banner', midroll: stream.midroll, ads: true, stripping: false, backup: stream.backup });
    }
    if (!stream.midroll) ping(stream, text, real);

    const want = stream.variants.get(url);
    if (!want) {
        log(`no variant for ${url}`);
        return text;
    }

    const heavy = hevc(want.codecs);
    if (((heavy && !opts.skipHevc) || opts.reloadOnAd) && stream.swapped && !stream.useSwapped) {
        stream.useSwapped = true;
        stream.reloadedAt = Date.now();
        postMessage({ gengar: 'reload' });
    }

    const { chosen, probed } = await find(stream, want, real);
    if (chosen) {
        text = align(chosen.text, stream);
        if (stream.backup !== chosen.type) {
            stream.backup = chosen.type;
            console.log(`[gengar] blocking ${stream.midroll ? 'midroll ' : ''}ads (${chosen.type})`);
        }
    }

    if (hasAds(text) && probed.length) {
        const patched = patch(text, harvest(probed));
        if (patched.count) text = patched.text;
    }

    const force = heavy && Boolean(stream.swapped);
    if (opts.strip || force) {
        text = strip(text, force, stream);
        if (stream.stripping) stream.strippedAny = true;
        if (!stream.allStripped) {
            stream.allStreak = 0;
        } else if (++stream.allStreak === opts.early && opts.early > 0) {
            stream.cache.clear();
            stream.failed.clear();
            postMessage({ gengar: 'reload' });
        }
    }
    return text;
}

export function onClean(stream, text) {
    const main = timeline(text);
    if (main) {
        stream.timeline = main;
        if (typeof stream.seq !== 'number' || Math.abs(main.seq - stream.seq) > 50) stream.seq = main.seq;
        else if (main.seq < stream.seq) text = text.replace(/#EXT-X-MEDIA-SEQUENCE:\d+/, `#EXT-X-MEDIA-SEQUENCE:${stream.seq}`);
        else stream.seq = main.seq;
    }
    if (stream.inAd) end(stream);
    return text;
}

export function end(stream) {
    console.log('[gengar] finished blocking ads');
    const stripped = stream.strippedAny;
    const swapped = stream.useSwapped;
    const low = stream.backup === 'autoplay';
    Object.assign(stream, { inAd: false, stripping: false, stripped: 0, backup: null, strippedAny: false, allStreak: 0, useSwapped: false });

    // a clean swap needs no nudge, the stall watcher steps in if playback wedges
    if (!(opts.seamless && !stripped && !swapped && !low)) {
        if (opts.soft && !stripped && !swapped) {
            postMessage({ gengar: 'nudge' });
        } else if (swapped || opts.reloadAfter) {
            stream.reloadedAt = Date.now();
            postMessage({ gengar: 'reload' });
        } else {
            postMessage({ gengar: 'nudge' });
        }
    }
    postMessage({ gengar: 'end' });
}

export async function rewrite(url, text, real) {
    const stream = state.urls.get(url);
    if (!stream) return text;
    if (state.reloaded) {
        state.reloaded = false;
        stream.reloadedAt = Date.now();
    }
    const out = hasAds(text) || state.depth > 0 ? await onAd(stream, url, text, real) : onClean(stream, text);
    postMessage({ gengar: 'banner', midroll: stream.midroll, ads: stream.inAd, stripping: stream.stripping, stripped: stream.stripped, backup: stream.backup });
    return out;
}

export function track(channel, url, master) {
    const stream = {
        channel,
        master,
        swapped: null,
        useSwapped: false,
        query: new URL(url).search,
        variants: new Map(),
        list: [],
        inAd: false,
        midroll: false,
        reloadedAt: 0,
        pinged: new Set(),
        cache: new Map(),
        failed: new Map(),
        warming: false,
        pinned: null,
        backup: null,
        timeline: null,
        seq: null,
        stripping: false,
        stripped: 0,
        strippedAny: false,
        allStripped: false,
        allStreak: 0
    };
    for (const v of variants(master)) {
        if (v.res) {
            stream.variants.set(v.url, v);
            stream.list.push(v);
        }
        state.urls.set(v.url, stream);
    }
    stream.swapped = swap(master, stream.list, opts.reloadOnAd, opts.skipHevc);
    return stream;
}

export async function usher(url, init, real) {
    state.v2 = url.includes('/api/v2/');
    const channel = new URL(url).pathname.match(/([^/]+)(?=\.\w+$)/)?.[0];
    if (!channel) return real(url, init);
    if (opts.player) {
        const clean = new URL(url);
        clean.searchParams.delete('parent_domains');
        url = clean.toString();
    }

    const res = await real(url, init);
    if (res.status !== 200) return res;
    const text = await res.text();
    const time = stamp(text, state.v2);

    let stream = state.streams.get(channel);
    if (stream) {
        const first = stream.master.match(/^https:.*\.m3u8$/m);
        if (!first || (await real(first[0])).status !== 200) stream = null;
    }
    if (!stream) {
        stream = track(channel, url, text);
        state.streams.set(channel, stream);
        prewarm(stream, real);
    }
    stream.reloadedAt = Date.now();
    return new Response(restamp(stream.useSwapped && stream.swapped ? stream.swapped : stream.master, time, state.v2));
}

export function blank() {
    return 'data:video/mp4;base64,AAAAKGZ0eXBtcDQyAAAAAWlzb21tcDQyZGFzaGF2YzFpc282aGxzZgAABEltb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAYagAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAABqHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAURtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAALuAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAADvbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAACzc3RibAAAAGdzdHNkAAAAAAAAAAEAAABXbXA0YQAAAAAAAAABAAAAAAAAAAAAAgAQAAAAALuAAAAAAAAzZXNkcwAAAAADgICAIgABAASAgIAUQBUAAAAAAAAAAAAAAAWAgIACEZAGgICAAQIAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAeV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAoAAAAFoAAAAAAGBbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAA9CQAAAAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABLG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAOxzdGJsAAAAoHN0c2QAAAAAAAAAAQAAAJBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAoABaABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAOmF2Y0MBTUAe/+EAI2dNQB6WUoFAX/LgLUBAQFAAAD6AAA6mDgAAHoQAA9CW7y4KAQAEaOuPIAAAABBzdHRzAAAAAAAAAAAAAAAQc3RzYwAAAAAAAAAAAAAAFHN0c3oAAAAAAAAAAAAAAAAAAAAQc3RjbwAAAAAAAAAAAAAASG12ZXgAAAAgdHJleAAAAAAAAAABAAAAAQAAAC4AAAAAAoAAAAAAACB0cmV4AAAAAAAAAAIAAAABAACCNQAAAAACQAAA';
}

export function hook() {
    const real = self.fetch;
    state.real = real;
    self.fetch = async function (url, init) {
        if (typeof url !== 'string') return real.apply(this, arguments);
        if (state.ads.has(url)) return real(blank(), init);
        const clean = url.trimEnd();
        if (clean.endsWith('m3u8')) {
            const res = await real(clean, init);
            if (res.status !== 200) return res;
            const text = await res.text();
            try {
                return new Response(await rewrite(clean, text, real));
            } catch (err) {
                log('rewrite failed:', err);
                return new Response(text);
            }
        }
        if (clean.includes('/channel/hls/') && !clean.includes('picture-by-picture')) return usher(clean, init, real);
        return real.apply(this, arguments);
    };
}

export function listen(msg) {
    switch (msg?.gengar) {
        case 'client':
            client[msg.field] = msg.value;
            break;
        case 'option':
            opts[msg.key] = msg.value;
            break;
        case 'fetched':
            settle(msg);
            break;
        case 'prewarm':
            for (const stream of state.streams.values()) {
                if (!stream.inAd) prewarm(stream, state.real || self.fetch, true);
            }
            break;
        case 'reloaded':
            state.reloaded = true;
            break;
        case 'simulate':
            state.depth = msg.depth;
            console.log('[gengar] simulating ads:', msg.depth);
            break;
        case 'stripall':
            state.all = !state.all;
            console.log('[gengar] strip all:', state.all);
            break;
    }
}
