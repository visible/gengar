import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { buildUserscript } from '../../../packages/core/scripts/build.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(extDir, '../..');
const srcDir = path.join(extDir, 'src');
const distDir = path.join(extDir, 'dist');
const coreSrcDir = path.join(repoRoot, 'packages/core/src');
const iconPath = path.join(repoRoot, 'apps/web/src/app/icon.svg');
const webPublicDir = path.join(repoRoot, 'apps/web/public');

const SOURCE = [
    'LICENSE',
    'package.json',
    'package-lock.json',
    'packages/core/package.json',
    'packages/core/src',
    'packages/core/scripts',
    'packages/core/test',
    'apps/extension/package.json',
    'apps/extension/src',
    'apps/extension/scripts',
    'apps/web/package.json',
    'apps/web/src/app/icon.svg'
];

const SOURCE_README = version => `# Gengar ${version} source

Requirements: Node.js 22 or later and npm.

    npm ci
    npm run build:extension

The build concatenates packages/core/src into page.js, copies apps/extension/src,
renders the icons from apps/web/src/app/icon.svg and writes the manifests.

Output: apps/extension/dist/firefox (unpacked) and
apps/extension/dist/gengar-firefox-${version}.zip (the submitted file).
`;

const TARGETS = ['chrome', 'firefox'];
const FILES = ['background.js', 'bridge.js', 'popup.html', 'popup.css', 'popup.js'];
const SIZES = [16, 32, 48, 128];
const BRAND = '#9146ff';
const MUTED = '#6e6e78';

function manifest(target, version) {
    const icons = Object.fromEntries(SIZES.map(size => [size, `icons/on-${size}.png`]));
    const matches = ['*://*.twitch.tv/*'];
    const base = {
        manifest_version: 3,
        name: 'Gengar',
        version,
        description: 'Twitch without the ad breaks. Gengar removes ads inside the player, so the stream never stops.',
        homepage_url: 'https://geng.ar',
        icons,
        action: { default_title: 'Gengar', default_popup: 'popup.html', default_icon: icons },
        permissions: ['storage'],
        host_permissions: matches,
        content_scripts: [
            { matches, js: ['page.js'], run_at: 'document_start', all_frames: true, world: 'MAIN' },
            { matches, js: ['bridge.js'], run_at: 'document_start', all_frames: true }
        ]
    };

    if (target === 'chrome') {
        return {
            ...base,
            name: 'Gengar - Twitch Ad Blocker',
            minimum_chrome_version: '111',
            background: { service_worker: 'background.js' }
        };
    }

    return {
        ...base,
        background: { scripts: ['background.js'] },
        browser_specific_settings: {
            gecko: {
                id: 'gengar@geng.ar',
                strict_min_version: '140.0',
                data_collection_permissions: { required: ['none'] }
            },
            gecko_android: { strict_min_version: '142.0' }
        }
    };
}

function renderIcons(outDir) {
    const svg = fs.readFileSync(iconPath, 'utf8');
    fs.mkdirSync(outDir, { recursive: true });
    for (const [state, source] of [['on', svg], ['off', svg.replaceAll(BRAND, MUTED)]]) {
        for (const size of SIZES) {
            const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
            fs.writeFileSync(path.join(outDir, `${state}-${size}.png`), png);
        }
    }
}

function listFiles(dir, rel = '') {
    return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap(entry => {
        const name = path.posix.join(rel, entry.name);
        return entry.isDirectory() ? listFiles(dir, name) : [name];
    });
}

function zipDir(dir, out) {
    const DOS_DATE_1980 = 0x21;
    const UNIX_FILE = (0o100644 << 16) >>> 0;
    const local = [];
    const central = [];
    let offset = 0;

    for (const name of listFiles(dir).sort()) {
        const data = fs.readFileSync(path.join(dir, name));
        const packed = zlib.deflateRawSync(data, { level: 9 });
        const crc = zlib.crc32(data);
        const nameBuf = Buffer.from(name);

        const head = Buffer.alloc(30);
        head.writeUInt32LE(0x04034b50, 0);
        head.writeUInt16LE(20, 4);
        head.writeUInt16LE(8, 8);
        head.writeUInt16LE(DOS_DATE_1980, 12);
        head.writeUInt32LE(crc, 14);
        head.writeUInt32LE(packed.length, 18);
        head.writeUInt32LE(data.length, 22);
        head.writeUInt16LE(nameBuf.length, 26);
        local.push(head, nameBuf, packed);

        const entry = Buffer.alloc(46);
        entry.writeUInt32LE(0x02014b50, 0);
        entry.writeUInt16LE((3 << 8) | 20, 4);
        entry.writeUInt16LE(20, 6);
        entry.writeUInt16LE(8, 10);
        entry.writeUInt16LE(DOS_DATE_1980, 14);
        entry.writeUInt32LE(crc, 16);
        entry.writeUInt32LE(packed.length, 20);
        entry.writeUInt32LE(data.length, 24);
        entry.writeUInt16LE(nameBuf.length, 28);
        entry.writeUInt32LE(UNIX_FILE, 38);
        entry.writeUInt32LE(offset, 42);
        central.push(entry, nameBuf);

        offset += head.length + nameBuf.length + packed.length;
    }

    const directory = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(central.length / 2, 8);
    end.writeUInt16LE(central.length / 2, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(offset, 16);
    fs.writeFileSync(out, Buffer.concat([...local, directory, end]));
}

function packSource(version) {
    const stage = path.join(distDir, 'source');
    fs.rmSync(stage, { recursive: true, force: true });
    for (const entry of SOURCE) {
        fs.cpSync(path.join(repoRoot, entry), path.join(stage, entry), { recursive: true });
    }
    fs.writeFileSync(path.join(stage, 'README.md'), SOURCE_README(version));
    zipDir(stage, path.join(distDir, `gengar-source-${version}.zip`));
    fs.rmSync(stage, { recursive: true, force: true });
}

export function buildExtension({ zip = true } = {}) {
    const core = buildUserscript();

    for (const target of TARGETS) {
        const out = path.join(distDir, target);
        fs.rmSync(out, { recursive: true, force: true });
        fs.mkdirSync(out, { recursive: true });

        fs.copyFileSync(core.pagePath, path.join(out, 'page.js'));
        for (const file of FILES) fs.copyFileSync(path.join(srcDir, file), path.join(out, file));
        fs.copyFileSync(path.join(repoRoot, 'LICENSE'), path.join(out, 'LICENSE'));
        renderIcons(path.join(out, 'icons'));
        fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest(target, core.version), null, 2)}\n`);

        if (zip) {
            const archive = path.join(distDir, `gengar-${target}-${core.version}.zip`);
            zipDir(out, archive);
            fs.copyFileSync(archive, path.join(webPublicDir, `gengar-${target}.zip`));
        }
    }

    if (zip) packSource(core.version);
    return core.version;
}

function log(version, reason) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] Built Gengar ${version} for ${TARGETS.join(' and ')}${reason ? ` (${reason})` : ''}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const watch = process.argv.includes('--watch');
    log(buildExtension({ zip: !watch }));

    if (watch) {
        let timer = null;
        const rebuild = reason => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                try {
                    log(buildExtension({ zip: false }), reason);
                } catch (error) {
                    console.error(error);
                }
            }, 120);
        };
        fs.watch(srcDir, (_event, file) => file && rebuild(`src/${file}`));
        fs.watch(coreSrcDir, (_event, file) => file && rebuild(`core/${file}`));
        fs.watch(iconPath, () => rebuild('icon.svg'));
        console.log(`Watching. Load ${path.relative(repoRoot, path.join(distDir, 'chrome'))} as an unpacked extension.`);
    }
}
