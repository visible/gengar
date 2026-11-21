export function blob(url, fns, settings, client) {
    const src = JSON.stringify(url);
    return `/* gengar */
(() => {
${fns.join('\n')}
const pending = new Map();
const opts = Object.assign(defaults(), ${JSON.stringify(settings)});
const client = ${JSON.stringify(client)};
const state = { streams: new Map(), urls: new Map(), ads: new Map(), v2: false, reloaded: false, depth: 0, all: false, real: null };
self.addEventListener('message', e => listen(e.data));
if (!read(${src}).includes('/* gengar */')) hook();
})();
importScripts(${src});
`;
}
