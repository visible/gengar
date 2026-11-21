const ICONS = {
    on: { 16: 'icons/on-16.png', 32: 'icons/on-32.png', 48: 'icons/on-48.png', 128: 'icons/on-128.png' },
    off: { 16: 'icons/off-16.png', 32: 'icons/off-32.png', 48: 'icons/off-48.png', 128: 'icons/off-128.png' }
};

let queue = Promise.resolve();

function serial(task) {
    queue = queue.then(task, task);
    return queue;
}

async function readTab(tabId) {
    const key = `tab:${tabId}`;
    const stored = await chrome.storage.session.get(key);
    return stored[key] ?? { frames: {} };
}

function sumTab(tab) {
    let blocked = 0;
    let blocking = false;
    for (const frame of Object.values(tab.frames)) {
        blocked += frame.breaks + frame.hidden;
        blocking ||= frame.blocking;
    }
    return { blocked, blocking, active: Object.keys(tab.frames).length > 0 };
}

async function onState(tabId, frameId, { session, breaks, hidden, blocking }) {
    const tab = await readTab(tabId);
    const previous = tab.frames[frameId];
    const fresh = previous?.session !== session;
    const delta = fresh
        ? breaks + hidden
        : Math.max(0, breaks - previous.breaks) + Math.max(0, hidden - previous.hidden);

    if (fresh && frameId === 0) tab.frames = {};
    tab.frames[frameId] = { session, breaks, hidden, blocking };
    await chrome.storage.session.set({ [`tab:${tabId}`]: tab });

    if (delta > 0) {
        const { total } = await chrome.storage.local.get({ total: 0 });
        await chrome.storage.local.set({ total: total + delta });
    }

    const { blocked } = sumTab(tab);
    chrome.action.setBadgeText({ tabId, text: blocked > 0 ? String(blocked) : '' }).catch(() => {});
}

async function summary(tabId) {
    const { enabled, total } = await chrome.storage.local.get({ enabled: true, total: 0 });
    const tab = tabId === undefined ? { frames: {} } : await readTab(tabId);
    return { enabled, total, tab: sumTab(tab) };
}

async function syncIcon() {
    const { enabled } = await chrome.storage.local.get({ enabled: true });
    await chrome.action.setIcon({ path: enabled ? ICONS.on : ICONS.off });
    await chrome.action.setTitle({ title: enabled ? 'Gengar' : 'Gengar is off' });
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setBadgeBackgroundColor({ color: '#1f1f23' });
    chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
    syncIcon();
});

chrome.runtime.onStartup.addListener(syncIcon);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) syncIcon();
});

chrome.tabs.onRemoved.addListener(tabId => {
    serial(() => chrome.storage.session.remove(`tab:${tabId}`));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'state' && sender.tab?.id !== undefined) {
        serial(() => onState(sender.tab.id, sender.frameId ?? 0, message));
        return false;
    }
    if (message?.type === 'summary') {
        serial(() => summary(message.tabId)).then(sendResponse);
        return true;
    }
    return false;
});
