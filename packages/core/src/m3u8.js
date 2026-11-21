export function rows(text) {
    return text.replaceAll('\r', '').split('\n');
}

export function attrs(line) {
    const out = {};
    const body = line.slice(line.indexOf(':') + 1);
    for (const [, key, raw] of body.matchAll(/([^=,]+)=("[^"]*"|[^,]*)/g)) {
        if (raw.startsWith('"')) out[key] = raw.slice(1, -1);
        else if (raw !== '' && !Number.isNaN(Number(raw))) out[key] = Number(raw);
        else out[key] = raw;
    }
    return out;
}

export function variants(master) {
    const list = [];
    const all = rows(master);
    for (let i = 0; i < all.length - 1; i++) {
        if (!all[i].startsWith('#EXT-X-STREAM-INF') || !all[i + 1].includes('.m3u8')) continue;
        const a = attrs(all[i]);
        list.push({
            res: typeof a.RESOLUTION === 'string' && a.RESOLUTION.includes('x') ? a.RESOLUTION : '',
            fps: a['FRAME-RATE'],
            codecs: typeof a.CODECS === 'string' ? a.CODECS : '',
            url: all[i + 1].trimEnd()
        });
    }
    return list;
}

export function segments(lines) {
    const list = [];
    let time = null;
    lines.forEach((line, i) => {
        if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
            const ms = Date.parse(line.slice(25).trim());
            if (!Number.isNaN(ms)) time = ms;
        } else if (line.startsWith('#EXTINF:')) {
            const head = i > 0 && lines[i - 1].startsWith('#EXT-X-PROGRAM-DATE-TIME:') ? i - 1 : i;
            list.push({ at: i, head, info: line, url: lines[i + 1], time, live: line.includes(',live') });
            time = null;
        }
    });
    return list;
}

export function area(res) {
    const [w, h] = res.split('x').map(Number);
    return w * h;
}

export function stamp(master, v2) {
    if (!master) return null;
    const hit = v2
        ? master.match(/#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE="([^"]+)"/)
        : master.match(/SERVER-TIME="([0-9.]+)"/);
    return hit ? hit[1] : null;
}

export function restamp(master, time, v2) {
    if (!master || !time) return master;
    return v2
        ? master.replace(/(#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE=")[^"]+"/, `$1${time}"`)
        : master.replace(/SERVER-TIME="[0-9.]+"/, `SERVER-TIME="${time}"`);
}

export function hasAds(text, o = opts) {
    return Boolean(text) && (o.markers.some(m => text.includes(m)) || o.adPaths.some(p => text.includes(p)));
}

export function hevc(codecs) {
    return typeof codecs === 'string' && /^(hev|hvc|av0)/.test(codecs);
}

export function swap(master, list, always, skip) {
    const avc = list.filter(v => v.codecs.startsWith('avc'));
    const heavy = list.some(v => hevc(v.codecs));
    if (!always && (!heavy || skip || !avc.length)) return null;
    const out = rows(master);
    if (!avc.length || !heavy || skip) return out.join('\n');
    for (let i = 0; i < out.length - 1; i++) {
        if (!out[i].startsWith('#EXT-X-STREAM-INF')) continue;
        const a = attrs(out[i]);
        if (!hevc(a.CODECS) || typeof a.RESOLUTION !== 'string' || !a.RESOLUTION.includes('x')) continue;
        const size = area(a.RESOLUTION);
        const fps = Number(a['FRAME-RATE']) || 0;
        const gap = v => Math.abs(area(v.res) - size);
        const drift = v => Math.abs((Number(v.fps) || 0) - fps);
        const best = [...avc].sort((x, y) => gap(x) - gap(y) || drift(x) - drift(y))[0];
        out[i] = out[i].replace(/CODECS="[^"]+"/, `CODECS="${best.codecs}"`);
        // the player dedupes variant lines, so each copy needs its own padding
        out[i + 1] = best.url + ' '.repeat(i + 1);
    }
    return out.join('\n');
}

export function pick(master, want) {
    if (!master || !want?.res) return null;
    const size = area(want.res);
    const family = typeof want.codecs === 'string' ? want.codecs.slice(0, 3) : '';
    let exact = null;
    let near = null;
    let gap = Infinity;
    for (const v of variants(master)) {
        if (!v.res) continue;
        const codec = !family || v.codecs.startsWith(family);
        if (v.res === want.res) {
            const fps = v.fps === want.fps;
            if (!exact || (!exact.codec && codec) || (codec === exact.codec && !exact.fps && fps)) {
                if (fps && codec) return v.url;
                exact = { url: v.url, fps, codec };
            }
        }
        const diff = Math.abs(area(v.res) - size);
        if (diff < gap) {
            near = v.url;
            gap = diff;
        }
    }
    return exact?.url ?? near;
}

export function strip(text, all, stream) {
    const out = rows(text);
    const now = Date.now();
    let found = false;
    let cut = 0;
    let total = 0;
    for (let i = 0; i < out.length; i++) {
        if (out[i].includes('X-TV-TWITCH-AD')) out[i] = out[i].replaceAll(opts.adUrls, '$1https://twitch.tv$2');
        const line = out[i];
        if (i < out.length - 1 && line.startsWith('#EXTINF')) {
            total++;
            const url = out[i + 1];
            if (all || state.all || !line.includes(',live') || opts.adPaths.some(p => url.includes(p))) {
                if (!state.ads.has(url)) stream.stripped++;
                state.ads.set(url, now);
                found = true;
                cut++;
            }
        }
        if (hasAds(line)) found = true;
    }
    if (found) {
        for (let i = 0; i < out.length; i++) {
            if (out[i].startsWith('#EXT-X-TWITCH-PREFETCH:')) out[i] = '';
        }
    } else {
        stream.stripped = 0;
    }
    stream.stripping = found;
    stream.allStripped = total > 0 && cut >= total;
    for (const [url, at] of state.ads) {
        if (at < now - 120000) state.ads.delete(url);
    }
    return out.join('\n');
}

export function timeline(text) {
    const head = text?.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
    if (!head) return null;
    const seq = Number(head[1]);
    let ref = null;
    let first = null;
    let last = null;
    let sum = 0;
    let count = 0;
    segments(rows(text)).forEach((s, i) => {
        if (s.time !== null) {
            first ??= s.time;
            if (s.live) {
                ref ??= { seq: seq + i, at: s.time };
                last = s.time;
            }
        }
        const dur = s.info.match(/^#EXTINF:([0-9.]+)/);
        const ms = dur ? Number(dur[1]) * 1000 : 2000;
        if (ms > 200 && ms < 15000) {
            sum += ms;
            count++;
        }
    });
    if (first === null) return null;
    return {
        seq,
        refSeq: ref?.seq ?? seq,
        refAt: ref?.at ?? first,
        first,
        last: last ?? first,
        avg: count ? sum / count : 2000
    };
}

export function drop(text, count) {
    if (!text || count <= 0) return text;
    const out = rows(text);
    const list = segments(out);
    if (list.length - count < 4) return text;
    return [...out.slice(0, list[0].head), ...out.slice(list[count].head)].join('\n');
}

export function harvest(texts, clean = new Map()) {
    for (const text of texts) {
        if (!text) continue;
        for (const s of segments(rows(text))) {
            if (s.live && s.time !== null && s.url && !s.url.startsWith('#')) {
                clean.set(Math.round(s.time / 1000), { info: s.info, url: s.url });
            }
        }
    }
    return clean;
}

export function patch(text, clean) {
    if (!text || !clean?.size) return { text, count: 0 };
    const out = rows(text);
    let count = 0;
    for (const s of segments(out)) {
        if (s.live || s.time === null || s.url === undefined) continue;
        const sec = Math.round(s.time / 1000);
        const hit = clean.get(sec) || clean.get(sec - 1) || clean.get(sec + 1);
        if (!hit) continue;
        out[s.at] = hit.info;
        out[s.at + 1] = hit.url;
        count++;
    }
    return { text: out.join('\n'), count };
}

export function align(text, stream) {
    const main = stream?.timeline;
    if (!text || !main) return text;
    const own = timeline(text);
    if (!own) return text;
    const step = main.avg || own.avg || 2000;
    let seq = main.refSeq + Math.round((own.first - main.refAt) / step);
    if (seq < 0) return text;
    let out = text;
    if (typeof stream.seq === 'number' && seq < stream.seq) {
        const behind = stream.seq - seq;
        if (behind <= 10) out = drop(out, behind);
        seq = stream.seq;
    }
    stream.seq = seq;
    return out
        .replace(/#EXT-X-MEDIA-SEQUENCE:\d+/, `#EXT-X-MEDIA-SEQUENCE:${seq}`)
        .replace(/#EXT-X-TWITCH-LIVE-SEQUENCE:\d+/, `#EXT-X-TWITCH-LIVE-SEQUENCE:${seq}`);
}
