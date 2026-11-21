import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(coreDir, '../..');
const srcDir = path.join(coreDir, 'src');
const distDir = path.join(coreDir, 'dist');
const webPublicDir = path.join(repoRoot, 'apps/web/public');

const SOURCE_FILES = ['config.js', 'm3u8.js', 'worker.js', 'blob.js', 'ui.js', 'runtime.js'];

const WORKER_SOURCE_FILES = ['m3u8.js', 'worker.js'];

function stripExports(code) {
    return code.replace(/^export\s+(async\s+)?function\s+/gm, '$1function ');
}

function extractExportedFunctionNames(code) {
    const names = [];
    const re = /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/gm;
    let m;
    while ((m = re.exec(code)) !== null) {
        names.push(m[1]);
    }
    return names;
}

export function buildUserscript() {
    const pkg = JSON.parse(fs.readFileSync(path.join(coreDir, 'package.json'), 'utf8'));

    const workerFunctionNames = ['defaults'];
    for (const file of WORKER_SOURCE_FILES) {
        const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
        workerFunctionNames.push(...extractExportedFunctionNames(content));
    }

    const sections = SOURCE_FILES.map(file => {
        const content = fs.readFileSync(path.join(srcDir, file), 'utf8').trim();
        return stripExports(content).replace(/^/gm, '    ');
    });

    const header = `// ==UserScript==
// @name         Gengar - Twitch AdBlock
// @namespace    https://geng.ar
// @homepageURL  https://geng.ar
// @updateURL    https://geng.ar/gengar.user.js
// @downloadURL  https://geng.ar/gengar.user.js
// @version      ${pkg.version}
// @description  Twitch without the ad breaks (geng.ar)
// @author       gengar
// @license      MIT
// @copyright    2026 Visible
// @match        *://*.twitch.tv/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==`;

    const body = `(function() {
    'use strict';

${sections.join('\n\n')}

    runtime({
        version: '${pkg.version}',
        fns: [
            ${workerFunctionNames.join(',\n            ')}
        ]
    }).boot();
})();
`;

    const bundle = `${header}\n${body}`;

    fs.mkdirSync(distDir, { recursive: true });
    const outPath = path.join(distDir, 'gengar.user.js');
    fs.writeFileSync(outPath, bundle, 'utf8');

    const pagePath = path.join(distDir, 'page.js');
    fs.writeFileSync(pagePath, body, 'utf8');

    if (fs.existsSync(path.join(repoRoot, 'apps/web'))) {
        fs.mkdirSync(webPublicDir, { recursive: true });
        fs.writeFileSync(path.join(webPublicDir, 'gengar.user.js'), bundle, 'utf8');
    }

    const devStub = `// ==UserScript==
// @name         Gengar - Twitch AdBlock [LOCAL DEV]
// @namespace    https://geng.ar
// @homepageURL  https://geng.ar
// @version      ${pkg.version}-dev
// @description  Local dev loader for Gengar (geng.ar)
// @match        *://*.twitch.tv/*
// @run-at       document-start
// @inject-into  page
// @grant        none
// @require      file://${outPath}
// ==/UserScript==
`;
    const devStubPath = path.join(distDir, 'gengar.dev.user.js');
    fs.writeFileSync(devStubPath, devStub, 'utf8');

    return {
        outPath,
        pagePath,
        devStubPath,
        version: pkg.version,
        workerFunctionNames,
        sizeBytes: Buffer.byteLength(bundle, 'utf8'),
        builtAt: new Date()
    };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const result = buildUserscript();
    console.log(`Built ${path.relative(repoRoot, result.outPath)} (${(result.sizeBytes / 1024).toFixed(1)} KB, ${result.workerFunctionNames.length} worker fns)`);
}
