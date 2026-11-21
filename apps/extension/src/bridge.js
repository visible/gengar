const OFF_KEY = 'gengar_off';
const isTop = window === window.top;

function isOff() {
    try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return false; }
}

function setOff(off) {
    try {
        if (off) localStorage.setItem(OFF_KEY, '1');
        else localStorage.removeItem(OFF_KEY);
    } catch {}
}

function apply(enabled) {
    if (isOff() !== enabled) return;
    setOff(!enabled);
    if (isTop) location.reload();
}

chrome.storage.local.get({ enabled: true }).then(({ enabled }) => apply(enabled));

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) apply(changes.enabled.newValue !== false);
});

window.addEventListener('message', e => {
    const data = e.data;
    if (e.source !== window || data?.source !== 'gengar' || data.type !== 'state') return;
    if (typeof data.session !== 'string' || !Number.isInteger(data.breaks) || !Number.isInteger(data.hidden)) return;
    chrome.runtime.sendMessage({
        type: 'state',
        session: data.session,
        breaks: data.breaks,
        hidden: data.hidden,
        blocking: data.blocking === true
    }).catch(() => {});
});

chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'panel') window.postMessage({ source: 'gengar', type: 'panel', open: message.open === true }, location.origin);
});

window.postMessage({ source: 'gengar', type: 'ask' }, location.origin);
