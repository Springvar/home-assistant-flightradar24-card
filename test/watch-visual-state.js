import puppeteer from 'puppeteer';

const DEV_SERVER_URL = 'http://localhost:5174/test/debug.html';

async function watchVisualState() {
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true
    });

    const page = await browser.newPage();

    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[Map]')) {
            console.log(`  ${msg.type()}: ${text}`);
        }
    });

    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.getElementById('fr24card')?.shadowRoot, { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    async function captureVisualState(label) {
        const state = await page.evaluate(() => {
            const card = document.getElementById('fr24card');
            const radarMapBg = card.shadowRoot.querySelector('#radar-map-bg');
            const tileContainer = radarMapBg?.querySelector('.leaflet-tile-container');
            const tiles = tileContainer?.querySelectorAll('.leaflet-tile');

            const radarMapBgStyle = window.getComputedStyle(radarMapBg);
            const tileContainerStyle = tileContainer ? window.getComputedStyle(tileContainer) : null;

            const tileDetails = [];
            tiles?.forEach((tile, i) => {
                const style = window.getComputedStyle(tile);
                tileDetails.push({
                    index: i,
                    src: tile.src?.includes('openstreetmap') ? '...openstreetmap...' : tile.src?.substring(0, 60),
                    complete: tile.complete,
                    naturalWidth: tile.naturalWidth,
                    display: style.display,
                    visibility: style.visibility,
                    opacity: style.opacity,
                    transform: tile.style.transform?.substring(0, 50) || 'none',
                    width: style.width,
                    height: style.height
                });
            });

            return {
                timestamp: Date.now(),
                radarMapBg: {
                    exists: !!radarMapBg,
                    display: radarMapBgStyle.display,
                    visibility: radarMapBgStyle.visibility,
                    opacity: radarMapBgStyle.opacity,
                    transform: radarMapBg.style.transform?.substring(0, 60) || 'none',
                    zIndex: radarMapBgStyle.zIndex,
                    width: radarMapBgStyle.width,
                    height: radarMapBgStyle.height
                },
                tileContainer: tileContainer ? {
                    exists: true,
                    display: tileContainerStyle.display,
                    visibility: tileContainerStyle.visibility,
                    opacity: tileContainerStyle.opacity,
                    transform: tileContainer.style.transform?.substring(0, 60) || 'none',
                    zIndex: tileContainerStyle.zIndex
                } : { exists: false },
                tileCount: tiles?.length || 0,
                tiles: tileDetails.slice(0, 3)
            };
        });

        console.log(`\n\n📸 ${label}`);
        console.log('═'.repeat(60));
        console.log(JSON.stringify(state, null, 2));
        return state;
    }

    const initial = await captureVisualState('INITIAL STATE');

    console.log('\n\n🎬 Starting continuous monitoring...');
    console.log('Will capture state: before update -> immediately after -> 1s after -> 2s after');

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n\n🧪 Clicking "Update Flight Data"...');
    const beforeClick = await captureVisualState('BEFORE UPDATE');

    await page.click('#btn-update-flights');

    // Capture immediately
    const immediate = await captureVisualState('IMMEDIATELY AFTER UPDATE (0ms)');

    await new Promise(resolve => setTimeout(resolve, 100));
    const after100ms = await captureVisualState('100ms AFTER UPDATE');

    await new Promise(resolve => setTimeout(resolve, 400));
    const after500ms = await captureVisualState('500ms AFTER UPDATE');

    await new Promise(resolve => setTimeout(resolve, 500));
    const after1s = await captureVisualState('1000ms AFTER UPDATE');

    await new Promise(resolve => setTimeout(resolve, 1000));
    const after2s = await captureVisualState('2000ms AFTER UPDATE');

    // Check for any changes
    console.log('\n\n📊 CHANGE DETECTION:');
    console.log('═'.repeat(60));

    function compareStates(label1, state1, label2, state2) {
        const changes = [];

        if (state1.radarMapBg.opacity !== state2.radarMapBg.opacity) {
            changes.push(`  ⚠️  radarMapBg opacity: ${state1.radarMapBg.opacity} → ${state2.radarMapBg.opacity}`);
        }
        if (state1.radarMapBg.visibility !== state2.radarMapBg.visibility) {
            changes.push(`  ⚠️  radarMapBg visibility: ${state1.radarMapBg.visibility} → ${state2.radarMapBg.visibility}`);
        }
        if (state1.radarMapBg.display !== state2.radarMapBg.display) {
            changes.push(`  ⚠️  radarMapBg display: ${state1.radarMapBg.display} → ${state2.radarMapBg.display}`);
        }
        if (state1.radarMapBg.transform !== state2.radarMapBg.transform) {
            changes.push(`  ⚠️  radarMapBg transform: ${state1.radarMapBg.transform} → ${state2.radarMapBg.transform}`);
        }
        if (state1.tileCount !== state2.tileCount) {
            changes.push(`  ⚠️  Tile count: ${state1.tileCount} → ${state2.tileCount}`);
        }

        if (changes.length > 0) {
            console.log(`\n${label1} → ${label2}:`);
            changes.forEach(c => console.log(c));
        } else {
            console.log(`\n${label1} → ${label2}: ✅ No changes detected`);
        }
    }

    compareStates('BEFORE', beforeClick, 'IMMEDIATE', immediate);
    compareStates('IMMEDIATE', immediate, '100ms', after100ms);
    compareStates('100ms', after100ms, '500ms', after500ms);
    compareStates('500ms', after500ms, '1000ms', after1s);
    compareStates('1000ms', after1s, '2000ms', after2s);

    console.log('\n\n✅ Visual state monitoring complete. Browser stays open.');
}

watchVisualState().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
