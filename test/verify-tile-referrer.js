import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

// Verifies the fix for issue #42: OpenStreetMap answered tile requests with
// "403 Access Blocked (Referer required)" because Home Assistant's
// <meta name="referrer" content="same-origin"> strips the Referer header from
// cross-origin requests. The test pages do not set that policy, which is why
// the bug was never reproducible locally.
//
// Usage:  npm run build && node test/verify-tile-referrer.js
//
// Serves the card directory itself rather than relying on `vite dev`, because a
// long-running dev server will happily serve a stale cached bundle and the check
// would then pass against code that no longer contains the fix. Runs headless,
// so it works over SSH.
//
// Part 1 proves the mechanism against two local origins and needs no external
// network. Part 2 checks the real card. Part 3 reports live OSM status
// informationally, since OSM's block is temporary and cannot be provoked.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = '/test/debug.html';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.yaml': 'text/yaml; charset=utf-8'
};

const LAUNCH = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
const ok = label => `\x1b[32m${label}\x1b[0m`;
const bad = label => `\x1b[31m${label}\x1b[0m`;

/** Static file server over the card directory, so every read hits disk. */
function startHarness(injectMeta) {
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = path.join(ROOT, rel);
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404).end('not found');
            return;
        }
        const ext = path.extname(file);
        let body = fs.readFileSync(file);
        if (injectMeta && rel === HARNESS) {
            body = Buffer.from(
                body.toString('utf8').replace(/<head>/i, `<head>\n    ${HA_REFERRER_META}`)
            );
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(body);
    });
    return new Promise(resolve => {
        server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
}

// Home Assistant serves its frontend with this policy in <head>. It strips the
// Referer header from cross-origin requests, which is what makes OpenStreetMap
// answer tile requests with "403 Access Blocked (Referer required)".
// The test pages do not set it, which is why the bug was invisible locally.
const HA_REFERRER_META = '<meta name="referrer" content="same-origin">';

const TILE_HOSTS = ['tile.openstreetmap.org', 'basemaps.cartocdn.com', 'tile.opentopomap.org'];
const isTile = url => TILE_HOSTS.some(host => url.includes(host));

/**
 * Part 1 — mechanism, with no dependency on OpenStreetMap.
 *
 * Serves a page carrying HA's referrer policy and a tile image on a genuinely
 * different origin, then reads the Referer the tile server actually received.
 * A bare <img> must send none; an <img> with referrerPolicy must send the origin.
 */
async function checkMechanism() {
    const PAGE_PORT = 5200;
    const TILE_PORT = 5199;
    const received = [];

    const tileServer = http.createServer((req, res) => {
        received.push({ referer: req.headers.referer ?? null });
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
        ));
    });
    const pageServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><head>${HA_REFERRER_META}</head><body>
<img src="http://127.0.0.1:${TILE_PORT}/t.png?case=bare">
<img referrerpolicy="strict-origin-when-cross-origin" src="http://127.0.0.1:${TILE_PORT}/t.png?case=policy">
</body></html>`);
    });

    await new Promise(r => tileServer.listen(TILE_PORT, r));
    await new Promise(r => pageServer.listen(PAGE_PORT, r));

    const browser = await puppeteer.launch(LAUNCH);
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PAGE_PORT}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
    tileServer.close();
    pageServer.close();

    const bare = received[0];
    const policy = received[1];
    const strips = !!bare && bare.referer === null;
    const restores = !!policy && typeof policy.referer === 'string' && policy.referer.length > 0;

    console.log('\n  1. Mechanism (local origins, no external network)');
    console.log(`     bare <img> under HA policy  -> Referer: ${JSON.stringify(bare?.referer)}`);
    console.log(`     with referrerPolicy         -> Referer: ${JSON.stringify(policy?.referer)}`);
    console.log(`     HA same-origin strips it    : ${strips ? ok('YES') : bad('NO')}`);
    console.log(`     referrerPolicy restores it  : ${restores ? ok('YES') : bad('NO')}`);

    return strips && restores;
}

/**
 * Part 2 — the real card. Serves this harness with HA's referrer policy injected
 * and reads the referrer policy applied to each Leaflet tile element.
 * `simulatePreFix` neutralises Leaflet's assignment to reproduce the old
 * behaviour deterministically.
 */
async function checkCard(simulatePreFix) {
    const { server, port } = await startHarness(true);
    const origin = `http://127.0.0.1:${port}`;

    const browser = await puppeteer.launch(LAUNCH);
    const page = await browser.newPage();
    const tileResponses = [];

    // Always read fresh from the server, never from a stale browser cache.
    await page.setCacheEnabled(false);

    page.on('response', response => {
        if (isTile(response.url())) tileResponses.push(response.status());
    });

    if (simulatePreFix) {
        // Deterministic stand-in for the pre-fix card: swallow the assignment
        // Leaflet makes to every tile <img>, so tiles keep the document policy.
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(HTMLImageElement.prototype, 'referrerPolicy', {
                configurable: true,
                get: () => '',
                set: () => {}
            });
        });
    }

    await page.goto(origin + HARNESS, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await page.waitForFunction(
        () => !!document.getElementById('fr24card')?.shadowRoot
            && document.getElementById('fr24card').shadowRoot.querySelectorAll('img.leaflet-tile').length > 0,
        { timeout: 20000 }
    ).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));

    // Leaflet lives inside the card's shadow root, so a document-level query
    // would never see the tile elements.
    const tiles = await page.evaluate(() => {
        const root = document.getElementById('fr24card')?.shadowRoot;
        return Array.from(root ? root.querySelectorAll('img.leaflet-tile') : []).map(img => ({
            idl: img.referrerPolicy,
            attr: img.getAttribute('referrerpolicy')
        }));
    });
    await browser.close();
    server.close();
    return { tiles, tileResponses, origin };
}

async function main() {
    console.log('\nVerifying OSM tile Referer handling (issue #42)');

    const mechanism = await checkMechanism();

    const before = await checkCard(true);
    const after = await checkCard(false);

    console.log(`\n  harness: self-hosted from disk (${after.origin}${HARNESS})`);

    // The content attribute is the signal, not the IDL getter: with the document
    // policy set to same-origin the getter resolves to "" either way, but only a
    // present attribute overrides the document policy for the request.
    const allSet = tiles => tiles.length > 0 && tiles.every(t => t.attr === 'strict-origin-when-cross-origin');
    const allUnset = tiles => tiles.length > 0 && tiles.every(t => t.attr === null);

    console.log('\n  2. Card tile elements (HA policy injected)');
    console.log(`     before fix: ${before.tiles.length} tiles, referrerpolicy attr=${JSON.stringify([...new Set(before.tiles.map(t => t.attr))])}`);
    console.log(`     after fix : ${after.tiles.length} tiles, referrerpolicy attr=${JSON.stringify([...new Set(after.tiles.map(t => t.attr))])}`);
    console.log(`     pre-fix leaves tiles on document policy : ${allUnset(before.tiles) ? ok('reproduced') : bad('unexpected')}`);
    console.log(`     card sets strict-origin-when-cross-origin: ${allSet(after.tiles) ? ok('YES') : bad('NO')}`);

    const blocked = after.tileResponses.filter(s => s === 403).length;
    console.log('\n  3. Live OpenStreetMap responses (informational)');
    console.log(`     ${after.tileResponses.length} tile responses: ${JSON.stringify([...new Set(after.tileResponses)].sort())}`);
    if (blocked) console.log(bad(`     ${blocked} tile(s) returned 403 — the fix is not working against OSM`));
    else console.log(`     no 403s ${ok('(OSM blocks are temporary and self-resolving, so absence here is not proof)')}`);

    console.log('\n' + '='.repeat(66));
    const fixed = mechanism && allSet(after.tiles);
    console.log(`  mechanism understood : ${mechanism ? ok('YES') : bad('NO')}`);
    console.log(`  card applies fix     : ${allSet(after.tiles) ? ok('YES') : bad('NO')}`);
    console.log(`  OSM 403s             : ${blocked === 0 ? ok('0') : bad(String(blocked))}`);
    console.log('='.repeat(66));

    process.exit(fixed && blocked === 0 ? 0 : 1);
}

main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
});
