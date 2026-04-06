import puppeteer from 'puppeteer';

const DEV_SERVER_URL = 'http://localhost:5174/test/debug.html';

async function inspectTiles() {
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true,
        args: ['--window-size=1400,1000']
    });

    const page = await browser.newPage();

    // Track network requests for tile images
    const tileRequests = [];
    page.on('request', request => {
        const url = request.url();
        if (url.includes('.png') && (url.includes('tile') || url.includes('openstreetmap') || url.includes('cartocdn') || url.includes('opentopomap'))) {
            tileRequests.push({ url, status: 'pending' });
            console.log(`  🌐 TILE REQUEST: ${url.substring(0, 100)}...`);
        }
    });

    page.on('response', response => {
        const url = response.url();
        if (url.includes('.png') && (url.includes('tile') || url.includes('openstreetmap') || url.includes('cartocdn') || url.includes('opentopomap'))) {
            const existing = tileRequests.find(r => r.url === url);
            if (existing) {
                existing.status = response.status();
            }
            console.log(`  ✅ TILE RESPONSE: ${response.status()} - ${url.substring(0, 100)}...`);
        }
    });

    // Capture console messages
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[Map]') || text.includes('[RadarScreen]')) {
            console.log(`  ${msg.type()}: ${text}`);
        }
    });

    console.log('📖 Opening debug page...');
    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle2' });

    console.log('⏳ Waiting for card to initialize...');
    await page.waitForFunction(() => {
        return document.getElementById('fr24card')?.shadowRoot;
    }, { timeout: 10000 });

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🔍 INITIAL STATE - Inspecting tile layers...');
    const initialState = await page.evaluate(() => {
        const card = document.getElementById('fr24card');
        const radarMapBg = card.shadowRoot.querySelector('#radar-map-bg');
        const leafletContainer = radarMapBg?.querySelector('.leaflet-container');
        const tilePane = leafletContainer?.querySelector('.leaflet-tile-pane');
        const layers = tilePane?.querySelectorAll('.leaflet-layer');
        const tiles = tilePane?.querySelectorAll('.leaflet-tile');

        const layerDetails = [];
        layers?.forEach((layer, i) => {
            const layerTiles = layer.querySelectorAll('.leaflet-tile');
            const tileInfo = [];
            layerTiles.forEach((tile, j) => {
                tileInfo.push({
                    index: j,
                    src: tile.src?.substring(0, 100) || 'no-src',
                    complete: tile.complete,
                    naturalWidth: tile.naturalWidth,
                    style: tile.getAttribute('style')?.substring(0, 100) || 'no-style',
                    classes: tile.className
                });
            });
            layerDetails.push({
                index: i,
                zIndex: layer.style.zIndex,
                opacity: layer.style.opacity,
                tileCount: layerTiles.length,
                tiles: tileInfo.slice(0, 3) // First 3 tiles
            });
        });

        return {
            hasRadarMapBg: !!radarMapBg,
            hasLeafletContainer: !!leafletContainer,
            hasTilePane: !!tilePane,
            layerCount: layers?.length || 0,
            totalTileCount: tiles?.length || 0,
            layers: layerDetails,
            radarMapBgHTML: radarMapBg?.innerHTML?.substring(0, 300) || 'N/A'
        };
    });

    console.log('\n📊 Initial tile inspection:');
    console.log(JSON.stringify(initialState, null, 2));

    console.log(`\n📊 Tile requests so far: ${tileRequests.length}`);
    console.log('Sample requests:', tileRequests.slice(0, 5).map(r => `${r.status} - ${r.url.substring(0, 80)}`).join('\n'));

    // TEST 1: Update flight data
    console.log('\n\n🧪 TEST 1: Clicking "Update Flight Data"...');
    const beforeUpdateTiles = tileRequests.length;

    await page.click('#btn-update-flights');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🔍 AFTER FLIGHT UPDATE - Inspecting tile layers...');
    const afterUpdateState = await page.evaluate(() => {
        const card = document.getElementById('fr24card');
        const radarMapBg = card.shadowRoot.querySelector('#radar-map-bg');
        const leafletContainer = radarMapBg?.querySelector('.leaflet-container');
        const tilePane = leafletContainer?.querySelector('.leaflet-tile-pane');
        const layers = tilePane?.querySelectorAll('.leaflet-layer');
        const tiles = tilePane?.querySelectorAll('.leaflet-tile');

        return {
            hasRadarMapBg: !!radarMapBg,
            hasLeafletContainer: !!leafletContainer,
            hasTilePane: !!tilePane,
            layerCount: layers?.length || 0,
            totalTileCount: tiles?.length || 0,
            radarMapBgChildren: radarMapBg?.children.length || 0,
            leafletContainerChildren: leafletContainer?.children.length || 0,
            tilePaneChildren: tilePane?.children.length || 0
        };
    });

    console.log('\n📊 After flight update:');
    console.log(JSON.stringify(afterUpdateState, null, 2));

    const afterUpdateTiles = tileRequests.length;
    console.log(`\n📊 New tile requests: ${afterUpdateTiles - beforeUpdateTiles}`);
    console.log(`Total tile requests: ${afterUpdateTiles}`);

    // TEST 2: Multiple rapid updates
    console.log('\n\n🧪 TEST 2: Three rapid flight updates...');
    const beforeRapidTiles = tileRequests.length;

    for (let i = 0; i < 3; i++) {
        console.log(`  Update ${i + 1}/3...`);
        await page.click('#btn-update-flights');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🔍 AFTER RAPID UPDATES - Inspecting tile layers...');
    const afterRapidState = await page.evaluate(() => {
        const card = document.getElementById('fr24card');
        const radarMapBg = card.shadowRoot.querySelector('#radar-map-bg');
        const tilePane = radarMapBg?.querySelector('.leaflet-tile-pane');
        const tiles = tilePane?.querySelectorAll('.leaflet-tile');

        const tileStates = {
            loaded: 0,
            loading: 0,
            error: 0
        };

        tiles?.forEach(tile => {
            if (tile.complete && tile.naturalWidth > 0) {
                tileStates.loaded++;
            } else if (!tile.complete) {
                tileStates.loading++;
            } else {
                tileStates.error++;
            }
        });

        return {
            totalTileCount: tiles?.length || 0,
            tileStates,
            firstTileSrc: tiles?.[0]?.src || 'N/A'
        };
    });

    console.log('\n📊 After rapid updates:');
    console.log(JSON.stringify(afterRapidState, null, 2));

    const afterRapidTiles = tileRequests.length;
    console.log(`\n📊 New tile requests during rapid updates: ${afterRapidTiles - beforeRapidTiles}`);
    console.log(`Total tile requests: ${afterRapidTiles}`);

    console.log('\n✅ Inspection complete. Browser will stay open for manual inspection.');
    console.log('Press Ctrl+C to close when done.');
}

inspectTiles().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
