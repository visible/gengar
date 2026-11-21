const COLUMNS = 12;
const ROWS = 5;

const LETTERS = [
  [0, 0, 'g'],
  [4, 0, 'e'],
  [9, 1, 'n'],
  [2, 2, 'g e'],
  [6, 2, 'gengar'],
  [11, 3, 'a'],
  [1, 4, 'r'],
  [5, 4, 'g'],
  [8, 4, 'n a']
];

const RESERVED = new Set([
  'directory', 'search', 'settings', 'videos', 'downloads', 'jobs', 'turbo', 'p',
  'subscriptions', 'inventory', 'wallet', 'drops', 'following', 'friends', 'login', 'signup'
]);

const cover = document.querySelector('.cover');
const power = document.querySelector('.power');
const settings = document.querySelector('.settings');
const total = document.querySelector('[data-ref="total"]');
const label = document.querySelector('[data-ref="label"]');
const status = document.querySelector('[data-ref="status"]');

let enabled = true;
let tabId;

function grid() {
  const el = document.querySelector('.grid');
  for (const [col, row, text] of LETTERS) {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.left = `${(col / COLUMNS) * 100}%`;
    span.style.top = `${(row / ROWS) * 100}%`;
    el.append(span);
  }
}

function place(url) {
  try {
    const { hostname, pathname, searchParams } = new URL(url);
    if (hostname !== 'twitch.tv' && !hostname.endsWith('.twitch.tv')) return { twitch: false, channel: null };
    if (hostname === 'player.twitch.tv') return { twitch: true, channel: searchParams.get('channel') };
    const name = pathname.split('/')[1] ?? '';
    const isChannel = /^[a-z0-9_]{2,25}$/i.test(name) && !RESERVED.has(name.toLowerCase());
    return { twitch: true, channel: isChannel ? name : null };
  } catch {
    return { twitch: false, channel: null };
  }
}

function describe({ enabled, tab }, { twitch, channel }) {
  if (!enabled) return 'Off. Twitch ads will play until you turn it back on.';
  if (!twitch) return 'Open a Twitch stream and Gengar starts on its own.';
  if (!tab.active) return 'Reload this tab to start blocking.';
  if (tab.blocking) return 'Blocking an ad break right now.';
  const here = `${tab.blocked} blocked on this tab.`;
  return channel ? `Watching ${channel}. ${here}` : here;
}

function render(data, where) {
  enabled = data.enabled;
  cover.dataset.on = String(enabled);
  power.setAttribute('aria-checked', String(enabled));
  power.textContent = enabled ? 'On' : 'Off';
  total.textContent = data.total.toLocaleString();
  label.textContent = data.total === 1 ? 'ad blocked' : 'ads blocked';
  status.textContent = describe(data, where);
  settings.hidden = !(data.enabled && data.tab.active && where.channel);
}

async function load() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  const data = await chrome.runtime.sendMessage({ type: 'summary', tabId });
  render(data, place(tab?.url ?? ''));
}

power.addEventListener('click', async () => {
  await chrome.storage.local.set({ enabled: !enabled });
  await load();
});

function panel(open) {
  if (tabId === undefined) return Promise.resolve();
  const message = { type: 'panel', open };
  const sent = open ? chrome.tabs.sendMessage(tabId, message, { frameId: 0 }) : chrome.tabs.sendMessage(tabId, message);
  return sent.catch(() => {});
}

settings.addEventListener('click', async () => {
  await panel(true);
  window.close();
});

grid();
load().then(() => panel(false));
