export function overlay(api) {
    const HOST = 'data-gengar';
    let panelHost = null;
    let panelRoot = null;
    let panelEl = null;
    let isOpen = false;
    let isSimulating = false;
    let telemetryTimer = null;
    let state = { ads: false, midroll: false, stripping: false, backup: null };

    const SHORTCUT = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform ?? navigator.platform) ? '⌥⇧A' : 'Alt+Shift+A';

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const ICONS = {
        mark: { size: 16, box: 16, evenodd: true, paths: ['M13 2V10H7A4 4 0 0 1 7 2ZM10 5V7H7.5A1 1 0 0 1 7.5 5ZM10 11H13V11.5A2.5 2.5 0 0 1 10.5 14H4V11Z'] },
        close: { size: 20, box: 20, paths: ['M8.5 10L4 5.5 5.5 4 10 8.5 14.5 4 16 5.5 11.5 10l4.5 4.5-1.5 1.5-4.5-4.5L5.5 16 4 14.5 8.5 10z'] },
        next: { size: 16, box: 20, paths: ['M7.5 4.5L13 10l-5.5 5.5-1.4-1.4L10.2 10 6.1 5.9 7.5 4.5z'] },
        back: { size: 16, box: 20, paths: ['M12.5 15.5L7 10l5.5-5.5 1.4 1.4L9.8 10l4.1 4.1-1.4 1.4z'] },
        reload: { size: 15, box: 24, stroke: true, paths: ['M21 12a9 9 0 1 1-2.64-6.36L21 8', 'M21 3v5h-5'] }
    };

    function icon(name) {
        const { size, box, paths, stroke, evenodd } = ICONS[name];
        const svg = document.createElementNS(SVG_NS, 'svg');
        const attrs = stroke
            ? { fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
            : { fill: 'currentColor' };
        for (const [key, value] of Object.entries({ width: size, height: size, viewBox: `0 0 ${box} ${box}`, 'aria-hidden': 'true', ...attrs })) {
            svg.setAttribute(key, String(value));
        }
        for (const d of paths) {
            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', d);
            if (evenodd) path.setAttribute('fill-rule', 'evenodd');
            svg.appendChild(path);
        }
        return svg;
    }

    function h(tag, props = {}, ...children) {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(props)) {
            if (key === 'class') el.className = value;
            else if (key === 'text') el.textContent = value;
            else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
            else el.setAttribute(key, value);
        }
        el.append(...children.flat().filter(child => child !== null && child !== undefined));
        return el;
    }

    const FONT = 'var(--font-base,"Inter","Roobert","Helvetica Neue",Helvetica,Arial,sans-serif)';
    const STYLES = `
:host{all:initial}
:host([data-gengar="button"]){display:inline-flex}
:host([data-gengar="pill"]){position:absolute;top:14px;left:14px;z-index:9998}
*{box-sizing:border-box}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.85)}}
@keyframes pop{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.pill{display:none;align-items:center;gap:7px;padding:5px 10px;border-radius:6px;background:rgba(32,32,38,.9);backdrop-filter:blur(10px);border:1px solid rgba(169,112,255,.35);color:var(--color-text-overlay,#fff);font:500 12px/1.2 ${FONT};cursor:pointer;user-select:none;box-shadow:var(--shadow-elevation-2,0 4px 12px rgba(0,0,0,.5));transition:border-color .12s ease}
.pill[data-show="1"]{display:inline-flex}
.pill:hover{border-color:rgba(169,112,255,.75)}
.pill svg{color:var(--color-fill-brand,#a970ff);flex-shrink:0}
.dot{width:6px;height:6px;border-radius:9000px;background:var(--color-fill-brand,#a970ff);animation:pulse 1.6s ease-in-out infinite;flex-shrink:0}
.button{position:relative;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:none;border-radius:var(--border-radius-rounded,9000px);background:transparent;color:var(--color-text-overlay,#fff);cursor:pointer;padding:0;transition:background-color .1s ease,color .1s ease}
.button:hover{background:var(--color-background-interactable-alpha-hover,rgba(255,255,255,.16))}
.button[data-active="1"]{background:rgba(255,255,255,.13);color:var(--color-fill-brand,#a970ff)}
.indicator{position:absolute;top:5px;right:5px;width:5px;height:5px;border-radius:9000px;background:#00f593;box-shadow:0 0 0 1.5px rgba(0,0,0,.45)}
.button[data-blocking="1"] .indicator{background:var(--color-fill-brand,#a970ff);animation:pulse 1.4s ease-in-out infinite}
.panel{position:fixed;z-index:2147483640;width:300px;border-radius:6px;background:var(--color-background-float,#323239);color:var(--color-text-base,#efeff1);font:400 14px/1.4 ${FONT};box-shadow:var(--shadow-elevation-3,0 6px 16px rgba(0,0,0,.6),0 0 4px rgba(0,0,0,.4));padding:8px;display:none;flex-direction:column;cursor:default}
.panel[data-open="1"]{display:flex;animation:pop .12s ease-out}
.menu{display:flex;align-items:center;justify-content:space-between;width:100%;height:32px;padding:0 8px;border:none;border-radius:4px;background:transparent;color:var(--color-text-base,#efeff1);font:inherit;cursor:pointer;text-align:left;transition:background-color .08s ease}
.menu:hover{background:var(--color-background-interactable-hover,rgba(83,83,95,.48))}
.start{display:inline-flex;align-items:center;gap:8px}
.end{display:inline-flex;align-items:center;gap:4px;color:var(--color-text-alt-2,#d3d3d9);font-size:12.5px}
.divider{height:1px;background:rgba(255,255,255,.1);margin:6px 0}
.status{font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;background:rgba(0,245,147,.14);color:#00f593;letter-spacing:.01em}
.status[data-blocking="1"]{background:rgba(169,112,255,.22);color:#c4b5fd}
.stats{display:flex;align-items:center;justify-content:space-between;margin:2px 4px 4px;padding:6px 10px;border-radius:4px;background:rgba(0,0,0,.22);font-size:12px;color:var(--color-text-alt-2,#d3d3d9);font-variant-numeric:tabular-nums}
.stats strong{color:var(--color-text-base,#efeff1);font-weight:600}
.live{display:inline-flex;align-items:center;gap:6px}
.quality{color:var(--color-text-base,#efeff1);font-weight:600}
.sync{color:var(--color-fill-brand,#a970ff);font-weight:500}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px;height:32px;padding:0 8px;border-radius:4px;transition:background-color .08s ease}
.row:hover{background:var(--color-background-interactable-hover,rgba(83,83,95,.48))}
.row label{color:var(--color-text-base,#efeff1);font-size:14px;cursor:pointer;user-select:none;flex:1}
.select{height:24px;background:rgba(0,0,0,.3);color:var(--color-text-base,#efeff1);border:1px solid rgba(255,255,255,.14);border-radius:4px;padding:0 6px;font:500 12.5px/1 ${FONT};outline:none;cursor:pointer}
.select:focus{border-color:var(--color-fill-brand,#a970ff)}
.switch{position:relative;width:36px;height:20px;border-radius:12px;background:var(--color-background-toggle,transparent);border:2px solid var(--color-border-toggle,rgba(222,222,227,.95));cursor:pointer;padding:0;flex-shrink:0;transition:border-color .12s ease,background-color .12s ease}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:9000px;background:var(--color-border-toggle,rgba(222,222,227,.95));transition:transform .12s ease,background-color .12s ease}
.switch[aria-checked="true"]{background:var(--color-background-toggle-checked,#000);border-color:var(--color-fill-brand,#a970ff)}
.switch[aria-checked="true"]::before{content:"";position:absolute;left:5px;top:3px;width:4px;height:7px;border:solid var(--color-fill-brand,#a970ff);border-width:0 2px 2px 0;transform:rotate(42deg)}
.switch[aria-checked="true"]::after{background:var(--color-fill-brand,#a970ff);transform:translateX(16px)}
.sim{font-size:11px;font-weight:600;padding:1px 7px;border-radius:4px;background:rgba(255,255,255,.08);color:var(--color-text-alt-2,#d3d3d9)}
.sim[data-on="1"]{background:rgba(145,71,255,.28);color:#c4b5fd}
.view{display:none;flex-direction:column}
.view[data-active="1"]{display:flex}
.warn{margin:2px 4px 4px;padding:6px 8px;border-radius:4px;background:rgba(245,158,11,.16);color:#fcd34d;font-size:11.5px;line-height:1.35;display:none}
.warn[data-show="1"]{display:block}
.foot{display:flex;align-items:center;justify-content:space-between;padding:5px 8px 2px;font-size:11px;color:var(--color-text-alt-2,#d3d3d9);opacity:.68}
.foot a{color:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-weight:500}
.foot a:hover{color:var(--color-fill-brand,#a970ff);opacity:1}
`.trim();

    function shadow(role) {
        const host = document.createElement('div');
        host.setAttribute(HOST, role);
        const root = host.attachShadow({ mode: 'open' });
        root.appendChild(h('style', { text: STYLES }));
        return { host, root };
    }

    function control() {
        return document.querySelector(`[${HOST}="button"]`)?.shadowRoot?.querySelector('.button') || null;
    }

    function button() {
        const group = document.querySelector('.player-controls__right-control-group');
        if (!group || group.querySelector(`[${HOST}="button"]`)) return;

        const { host, root } = shadow('button');
        const btn = h('button', { type: 'button', class: 'button', title: `Gengar (${SHORTCUT})`, 'aria-label': 'Gengar settings' },
            icon('mark'),
            h('span', { class: 'indicator' })
        );
        host.addEventListener('click', e => {
            e.stopPropagation();
            toggle();
        });
        root.appendChild(btn);
        group.insertBefore(host, group.firstChild);
        indicate();
    }

    function place() {
        if (!panelEl) return;
        const target = document.fullscreenElement || document.body;
        if (target && panelHost.parentElement !== target) {
            target.appendChild(panelHost);
        }
        const player = document.querySelector('.video-player');
        const controls = document.querySelector('.player-controls');
        const playerRect = player?.getBoundingClientRect();
        const controlsRect = controls?.getBoundingClientRect();

        if (playerRect && playerRect.height > 0) {
            const rightPx = Math.max(12, window.innerWidth - playerRect.right + 32);
            const controlsTop = controlsRect && controlsRect.height > 0 && controlsRect.top > playerRect.top
                ? controlsRect.top
                : playerRect.bottom - 48;
            const bottomPx = Math.max(56, window.innerHeight - controlsTop + 8);
            panelEl.style.right = `${Math.round(rightPx)}px`;
            panelEl.style.bottom = `${Math.round(bottomPx)}px`;
            panelEl.style.maxHeight = `${Math.max(180, Math.round(controlsTop - playerRect.top - 16))}px`;
        } else {
            panelEl.style.right = '24px';
            panelEl.style.bottom = '64px';
            panelEl.style.maxHeight = '80vh';
        }
        panelEl.style.overflowY = 'auto';
    }

    function view(viewName) {
        if (!panelRoot) return;
        panelRoot.querySelectorAll('.view').forEach(el => {
            el.dataset.active = el.dataset.view === viewName ? '1' : '0';
        });
    }

    function panel() {
        if (panelEl) {
            if (!panelHost.isConnected && document.body) document.body.appendChild(panelHost);
            return panelEl;
        }
        if (!document.body) return null;

        ({ host: panelHost, root: panelRoot } = shadow('panel'));

        const flip = event => {
            const btn = event.currentTarget;
            const next = btn.getAttribute('aria-checked') !== 'true';
            api.set(btn.dataset.key, next);
            btn.setAttribute('aria-checked', String(next));
            if (btn.dataset.key === 'badge') {
                banner(state, api.live());
            } else if (btn.dataset.key === 'source' && next) {
                api.upgrade();
            }
        };

        const toggleRow = (key, label) => h('div', { class: 'row' },
            h('label', { for: `t-${key}`, text: label }),
            h('button', { id: `t-${key}`, type: 'button', class: 'switch', role: 'switch', 'data-key': key, 'aria-checked': 'false', onclick: flip })
        );

        const foot = shortcut => h('div', { class: 'foot' },
            h('a', { href: 'https://geng.ar', target: '_blank', rel: 'noopener' }, icon('mark'), h('span', { text: 'geng.ar' })),
            h('span', { text: `v${api.version}${shortcut ? ` · ${SHORTCUT}` : ''}` })
        );

        const simLabel = h('span', { text: 'Test Ad Block' });
        const simState = h('span', { class: 'sim', 'data-on': '0', text: 'Off' });
        const simulate = () => {
            isSimulating = !isSimulating;
            api.simulate(isSimulating ? 1 : 0);
            simLabel.textContent = isSimulating ? 'Stop Ad Test' : 'Test Ad Block';
            simState.textContent = isSimulating ? 'Live' : 'Off';
            simState.dataset.on = isSimulating ? '1' : '0';
        };

        const select = h('select', { id: 'player-type', class: 'select' },
            api.players().map(type => h('option', { value: type, text: type }))
        );
        select.addEventListener('change', () => api.set('player', select.value));

        panelEl = h('div', { class: 'panel', role: 'dialog', 'aria-label': 'Gengar settings' },
            h('div', { class: 'view', 'data-view': 'main', 'data-active': '1' },
                h('button', { type: 'button', class: 'menu', onclick: () => toggle(false) },
                    h('span', { class: 'start' }, icon('close'), h('span', { text: 'Close' })),
                    h('span', { class: 'status', 'data-ref': 'status', text: 'Ready' })
                ),
                h('div', { class: 'divider' }),
                h('div', { class: 'warn', 'data-ref': 'conflict', text: 'Duplicate Twitch HLS script detected. uBlock/AdBlock are fine, but disable other Twitch video-ad userscripts.' }),
                h('div', { class: 'stats' },
                    h('span', { class: 'live' },
                        h('span', { class: 'quality', 'data-ref': 'quality', text: 'Live' }),
                        h('span', { 'data-ref': 'latency' })
                    ),
                    h('strong', { 'data-ref': 'blockedSummary', text: '0 blocked' })
                ),
                h('div', { class: 'row' }, h('label', { for: 'player-type', text: 'Player type' }), select),
                toggleRow('catchup', 'Zero-delay catch-up'),
                toggleRow('source', 'Lock source quality'),
                toggleRow('fallback', '360p fallback'),
                h('button', { type: 'button', class: 'menu', onclick: () => view('advanced') },
                    h('span', { text: 'Advanced' }),
                    h('span', { class: 'end' }, icon('next'))
                ),
                h('div', { class: 'divider' }),
                h('button', { type: 'button', class: 'menu', onclick: () => api.reload() },
                    h('span', { text: 'Reload Player' }),
                    h('span', { class: 'end' }, icon('reload'))
                ),
                h('button', { type: 'button', class: 'menu', onclick: simulate }, simLabel, simState),
                foot(true)
            ),
            h('div', { class: 'view', 'data-view': 'advanced', 'data-active': '0' },
                h('button', { type: 'button', class: 'menu', onclick: () => view('main') },
                    h('span', { class: 'start' }, icon('back'), h('span', { text: 'Advanced' }))
                ),
                h('div', { class: 'divider' }),
                h('div', { class: 'stats' },
                    h('span', {}, 'Breaks: ', h('strong', { 'data-ref': 'breaks', text: '0' })),
                    h('span', {}, 'Side ads: ', h('strong', { 'data-ref': 'separate', text: '0' }))
                ),
                toggleRow('hide', 'Hide separate ads'),
                toggleRow('stalls', 'Stall recovery'),
                toggleRow('badge', 'Show player badge'),
                toggleRow('debug', 'Debug logs'),
                foot(false)
            )
        );

        const stop = e => e.stopPropagation();
        panelHost.addEventListener('click', stop);
        panelHost.addEventListener('mousedown', stop);
        panelHost.addEventListener('dblclick', stop);

        panelRoot.appendChild(panelEl);
        document.body.appendChild(panelHost);
        sync();
        return panelEl;
    }

    function sync() {
        if (!panelEl) return;
        const stats = api.stats();
        panelEl.querySelector('[data-ref="blockedSummary"]').textContent = `${stats.breaks + stats.hidden} blocked`;
        panelEl.querySelector('[data-ref="breaks"]').textContent = String(stats.breaks);
        panelEl.querySelector('[data-ref="separate"]').textContent = String(stats.hidden);

        const telemetry = api.telemetry();
        panelEl.querySelector('[data-ref="quality"]').textContent = telemetry.quality || 'Live';
        const latEl = panelEl.querySelector('[data-ref="latency"]');
        if (telemetry.latency !== null && telemetry.latency > 0) {
            latEl.textContent = telemetry.catching
                ? `· ${telemetry.latency.toFixed(1)}s syncing`
                : `· ${telemetry.latency.toFixed(1)}s`;
            latEl.className = telemetry.catching ? 'sync' : '';
        } else {
            latEl.textContent = '';
            latEl.className = '';
        }

        const statusEl = panelEl.querySelector('[data-ref="status"]');
        if (state.ads) {
            statusEl.dataset.blocking = '1';
            statusEl.textContent = state.backup ? `Blocking · ${state.backup}` : 'Blocking';
        } else {
            statusEl.dataset.blocking = '0';
            statusEl.textContent = 'Ready';
        }

        panelEl.querySelector('[data-ref="conflict"]').dataset.show = api.conflict() ? '1' : '0';
        panelEl.querySelector('#player-type').value = api.get('player') || 'popout';

        panelEl.querySelectorAll('.switch').forEach(btn => {
            btn.setAttribute('aria-checked', String(Boolean(api.get(btn.dataset.key))));
        });
    }

    function indicate() {
        const btn = control();
        if (!btn) return;
        btn.dataset.blocking = state.ads ? '1' : '0';
        btn.dataset.active = isOpen ? '1' : '0';
    }

    function toggle(forceOpen) {
        if (forceOpen === false && !isOpen) return;
        if (!panel()) return;
        isOpen = typeof forceOpen === 'boolean' ? forceOpen : !isOpen;
        if (isOpen) {
            view('main');
            place();
            sync();
            clearInterval(telemetryTimer);
            telemetryTimer = setInterval(() => {
                sync();
                place();
            }, 1000);
        } else {
            clearInterval(telemetryTimer);
        }
        panelEl.dataset.open = isOpen ? '1' : '0';
        indicate();
    }

    function banner(data, isLive) {
        state = { ...state, ...data };
        button();
        indicate();
        if (isOpen) sync();

        const player = document.querySelector('.video-player');
        if (!player) return;

        let host = player.querySelector(`[${HOST}="pill"]`);
        if (!host) {
            const created = shadow('pill');
            host = created.host;
            const pill = h('div', { class: 'pill' }, h('span', { class: 'dot' }), icon('mark'), h('span', { class: 'text' }));
            host.addEventListener('click', e => {
                e.stopPropagation();
                toggle(true);
            });
            created.root.appendChild(pill);
            player.appendChild(host);
        }

        const pill = host.shadowRoot.querySelector('.pill');
        if (!api.get('badge') || !data.ads || !isLive) {
            pill.dataset.show = '0';
            return;
        }

        const label = data.midroll ? 'Blocking midroll' : 'Blocking ads';
        const suffix = data.stripping ? 'stripping' : (data.backup || '');
        pill.querySelector('.text').textContent = suffix ? `${label} · ${suffix}` : label;
        pill.dataset.show = '1';
    }

    function mount() {
        document.querySelectorAll(`[${HOST}]`).forEach(el => el.remove());
        button();

        window.addEventListener('resize', () => {
            if (isOpen) place();
        });
        document.addEventListener('fullscreenchange', () => {
            if (isOpen) place();
        });
        document.addEventListener('click', () => {
            if (isOpen) toggle(false);
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && isOpen) {
                toggle(false);
            } else if (e.altKey && e.shiftKey && e.code === 'KeyA') {
                e.preventDefault();
                toggle();
            }
        });
    }

    return {
        mount,
        button,
        banner,
        sync,
        toggle
    };
}
