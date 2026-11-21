export function defaults() {
    return {
        player: 'popout',
        catchup: true,
        source: false,
        fallback: true,
        hide: true,
        stalls: true,
        badge: true,
        debug: false,

        prewarm: true,
        pin: true,
        seamless: true,
        soft: true,
        strip: true,
        wedge: true,
        skipHevc: false,
        reloadOnAd: false,
        reloadAfter: true,
        stallReload: false,
        early: 4,

        reloadGap: 20,
        quietMs: 1500,
        cacheMs: 12 * 60 * 1000,
        failMs: 15000,
        tick: 400,
        sameTicks: 3,
        danger: 1,
        stallGap: 6000,
        prerollCheck: false,
        prerollOffset: 5,
        driftTarget: 2.4,
        driftTrigger: 3.5,

        markers: ['stitched-ad', 'EXT-X-CUE-OUT', 'twitch-stitched', 'EXT-X-DATERANGE:CLASS="twitch-maf-ad"'],
        adPaths: ['/adsquared/', '/_404/', '/processing'],
        adUrls: /(X-TV-TWITCH-AD(?:-[A-Z]+)*-URLS?=")[^"]*(")/g,
        backups: ['site', 'popout', 'frontpage', 'mobile_web', 'embed'],
        lastResort: 'site'
    };
}

export function players() {
    return ['popout', 'site', 'embed', 'mobile_web', 'autoplay'];
}

export function load(opts) {
    const base = defaults();
    try {
        for (const [key, value] of Object.entries(base)) {
            const raw = localStorage.getItem(`gengar_${key}`);
            if (raw === null) continue;
            if (typeof value === 'boolean' && (raw === 'true' || raw === 'false')) {
                opts[key] = raw === 'true';
            } else if (typeof value === 'number' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
                opts[key] = Math.max(0, Number(raw));
            } else if (key === 'player' && players().includes(raw)) {
                opts[key] = raw;
            }
        }
    } catch {}
    return opts;
}

export function save(opts, key, value) {
    opts[key] = value;
    try { localStorage.setItem(`gengar_${key}`, String(value)); } catch {}
}
