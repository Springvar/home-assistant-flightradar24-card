import puppeteer from 'puppeteer';

const DEV_SERVER_URL = 'http://localhost:5174/test/debug.html';

async function inspectMapTypeChange() {
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true,
        args: ['--window-size=1400,1000']
    });

    const page = await browser.newPage();

    let tileRequests = [];
    page.on('request', request => {
        const url = request.url();
        if (url.includes('.png') && (url.includes('tile') || url.includes('openstreetmap') || url.includes('cartocdn') || url.includes('opentopomap') || url.includes('arcgis'))) {
            tileRequests.push({
                url: url.substring(0, 80),
                timestamp: Date.now(),
                status: 'pending'
            });
        }
    });

    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[Map]') || text.includes('[RadarScreen]')) {
            console.log(`  ${msg.type()}: ${text}`);
        }
    });

    console.log('📖 Opening debug page...');
    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.getElementById('fr24card')?.shadowRoot, { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    async function inspectAllMaps(label) {
        const state = await page.evaluate(() => {
            const card = document.getElementById('fr24card');

            // Find ALL Leaflet maps in the entire document
            const allLeafletContainers = Array.from(document.querySelectorAll('.leaflet-container'));
            const shadowLeafletContainers = card.shadowRoot ?
                Array.from(card.shadowRoot.querySelectorAll('.leaflet-container')) : [];

            const maps = [];

            [...allLeafletContainers, ...shadowLeafletContainers].forEach((container, i) => {
                const tiles = container.querySelectorAll('.leaflet-tile');
                const tilePane = container.querySelector('.leaflet-tile-pane');
                const layers = tilePane?.querySelectorAll('.leaflet-layer');

                maps.push({
                    index: i,
                    id: container.id || 'no-id',
                    inShadowRoot: card.shadowRoot?.contains(container) || false,
                    tileCount: tiles.length,
                    layerCount: layers?.length || 0,
                    parentElement: container.parentElement?.tagName || 'unknown',
                    sampleTileSrc: tiles[0]?.src?.substring(0, 60) || 'no-tiles',
                    visible: container.offsetParent !== null
                });
            });

            // Check cardState
            const hasLeafletMapInState = !!card.cardState?._leafletMap;
            const stateMapContainer = card.cardState?._leafletMap?.getContainer();
            const stateMapContainerId = stateMapContainer?.id || 'N/A';

            return {
                totalMapsFound: maps.length,
                maps,
                cardStateHasMap: hasLeafletMapInState,
                cardStateMapId: stateMapContainerId
            };
        });

        console.log(`\n\n📍 ${label}`);
        console.log('═'.repeat(80));
        console.log(JSON.stringify(state, null, 2));

        return state;
    }

    console.log('\n🔍 INITIAL STATE - All Leaflet maps in document');
    const initial = await inspectAllMaps('INITIAL (color map)');

    const initialTileCount = tileRequests.length;
    console.log(`\n📊 Tile requests so far: ${initialTileCount}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n\n🧪 TEST: Clicking "Change Map Type" button...');
    tileRequests = []; // Reset counter

    await page.click('#btn-change-map-type');

    await new Promise(resolve => setTimeout(resolve, 500));
    await inspectAllMaps('IMMEDIATELY AFTER MAP TYPE CHANGE (500ms)');

    await new Promise(resolve => setTimeout(resolve, 2000));
    const after2s = await inspectAllMaps('2 SECONDS AFTER MAP TYPE CHANGE');

    console.log(`\n📊 New tile requests after map type change: ${tileRequests.length}`);
    console.log('Sample of new requests:', tileRequests.slice(0, 5).map(r => r.url).join('\n'));

    // Try changing again
    console.log('\n\n🧪 TEST 2: Changing map type AGAIN...');
    tileRequests = [];

    await page.click('#btn-change-map-type');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const secondChange = await inspectAllMaps('AFTER SECOND MAP TYPE CHANGE');
    console.log(`\n📊 Tile requests on second change: ${tileRequests.length}`);

    // Analysis
    console.log('\n\n📊 ANALYSIS');
    console.log('═'.repeat(80));
    console.log(`Initial maps: ${initial.totalMapsFound}`);
    console.log(`After 1st change: ${after2s.totalMapsFound}`);
    console.log(`After 2nd change: ${secondChange.totalMapsFound}`);

    if (after2s.totalMapsFound > 1) {
        console.log('\n⚠️  WARNING: Multiple Leaflet maps detected!');
        console.log('This could cause tiles to appear in wrong places.');
    }

    console.log('\n✅ Inspection complete. Browser stays open.');
}

inspectMapTypeChange().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
