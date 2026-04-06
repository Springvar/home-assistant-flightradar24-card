import puppeteer from 'puppeteer';

const DEV_SERVER_URL = 'http://localhost:5174/test/debug.html';

async function testRapidConfigChanges() {
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true
    });

    const page = await browser.newPage();

    let tileLoadEvents = [];
    page.on('response', response => {
        const url = response.url();
        if (url.includes('.png') && (url.includes('tile') || url.includes('openstreetmap') || url.includes('cartocdn'))) {
            tileLoadEvents.push({
                url: url.substring(url.lastIndexOf('/') - 20),
                status: response.status(),
                timestamp: Date.now()
            });
        }
    });

    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.getElementById('fr24card')?.shadowRoot, { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🧪 TEST: Rapid config changes (change map type 5 times quickly)\n');

    for (let i = 0; i < 5; i++) {
        console.log(`  Change ${i + 1}/5...`);
        tileLoadEvents = [];
        await page.click('#btn-change-map-type');
        await new Promise(resolve => setTimeout(resolve, 500));

        const state = await page.evaluate(() => {
            const card = document.getElementById('fr24card');

            // Count ALL Leaflet containers in the entire document tree
            const allLeafletContainers = [];

            // Check main document
            document.querySelectorAll('.leaflet-container').forEach(c => {
                allLeafletContainers.push({ location: 'main-document', id: c.id || 'no-id' });
            });

            // Check shadow root
            if (card.shadowRoot) {
                card.shadowRoot.querySelectorAll('.leaflet-container').forEach(c => {
                    allLeafletContainers.push({ location: 'shadow-root', id: c.id || 'no-id' });
                });
            }

            const radarMapBg = card.shadowRoot?.querySelector('#radar-map-bg');
            const tiles = radarMapBg?.querySelectorAll('.leaflet-tile');

            return {
                totalLeafletContainers: allLeafletContainers.length,
                containers: allLeafletContainers,
                cardStateHasMap: !!card.cardState?._leafletMap,
                tileCount: tiles?.length || 0,
                loadedTiles: Array.from(tiles || []).filter(t => t.complete).length
            };
        });

        console.log(`    Leaflet containers: ${state.totalLeafletContainers}, Tiles: ${state.tileCount} (${state.loadedTiles} loaded)`);
        console.log(`    Tile loads in last 500ms: ${tileLoadEvents.length}`);

        if (state.totalLeafletContainers > 1) {
            console.log(`    ⚠️  WARNING: Multiple Leaflet containers detected!`);
            console.log(`    Containers:`, state.containers);
        }
    }

    // Final check after all changes
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📊 FINAL STATE CHECK');
    const finalState = await page.evaluate(() => {
        const card = document.getElementById('fr24card');

        const allLeafletContainers = [];
        document.querySelectorAll('.leaflet-container').forEach(c => {
            allLeafletContainers.push({ location: 'main-document', id: c.id || 'no-id' });
        });
        if (card.shadowRoot) {
            card.shadowRoot.querySelectorAll('.leaflet-container').forEach(c => {
                allLeafletContainers.push({ location: 'shadow-root', id: c.id || 'no-id' });
            });
        }

        const radarMapBg = card.shadowRoot?.querySelector('#radar-map-bg');
        const tiles = radarMapBg?.querySelectorAll('.leaflet-tile');

        return {
            totalLeafletContainers: allLeafletContainers.length,
            containers: allLeafletContainers,
            cardStateHasMap: !!card.cardState?._leafletMap,
            tileCount: tiles?.length || 0,
            allTilesComplete: Array.from(tiles || []).every(t => t.complete && t.naturalWidth > 0)
        };
    });

    console.log(JSON.stringify(finalState, null, 2));

    if (finalState.totalLeafletContainers === 1 && finalState.allTilesComplete) {
        console.log('\n✅ SUCCESS: Single Leaflet map, all tiles loaded correctly');
    } else if (finalState.totalLeafletContainers > 1) {
        console.log('\n❌ FAIL: Multiple Leaflet containers detected - memory leak!');
    } else if (!finalState.allTilesComplete) {
        console.log('\n⚠️  WARNING: Some tiles failed to load');
    }

    console.log('\n✅ Test complete. Browser stays open for manual inspection.');
}

testRapidConfigChanges().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
