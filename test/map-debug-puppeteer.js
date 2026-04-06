import puppeteer from 'puppeteer';

const DEV_SERVER_URL = 'http://localhost:5174/test/debug.html';
const WAIT_FOR_LOAD = 5000; // Wait for card to fully initialize and Leaflet to load tiles
const WAIT_BETWEEN_ACTIONS = 3000;

async function runMapDebug() {
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: false, // Show browser so we can see what's happening
        devtools: true,  // Open DevTools automatically
        args: ['--window-size=1400,1000']
    });

    const page = await browser.newPage();

    // Capture all console messages
    const consoleMessages = [];
    page.on('console', msg => {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });

        // Print important messages to terminal
        if (text.includes('[Map]') || text.includes('[RadarScreen]') || text.includes('setupRadarMapBg')) {
            console.log(`  ${msg.type().toUpperCase()}: ${text}`);
        }
    });

    // Capture errors
    page.on('pageerror', error => {
        console.error('❌ Page error:', error.message);
    });

    console.log('📖 Opening debug page...');
    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle2' });

    console.log('⏳ Waiting for card element to be fully defined...');
    await page.waitForFunction(() => {
        const card = document.getElementById('fr24card');
        return card && typeof card.setConfig === 'function' && card.shadowRoot;
    }, { timeout: 10000 });

    console.log(`⏳ Waiting ${WAIT_FOR_LOAD}ms for card to fully initialize...`);
    await new Promise(resolve => setTimeout(resolve, WAIT_FOR_LOAD));

    console.log('\n📊 Initial state:');
    const initialStats = await page.evaluate(() => {
        return {
            setupCalls: document.getElementById('stat-setup-calls').textContent,
            layerRecreations: document.getElementById('stat-layer-recreations').textContent,
            flightUpdates: document.getElementById('stat-flight-updates').textContent,
            mapType: document.getElementById('stat-map-type').textContent
        };
    });
    console.log(initialStats);

    // Check if Leaflet map exists
    console.log('\n🗺️  Checking Leaflet map state...');
    const mapState = await page.evaluate(() => {
        const card = document.getElementById('fr24card');
        const radarMapBg = card.shadowRoot.querySelector('#radar-map-bg');
        const leafletContainer = radarMapBg?.querySelector('.leaflet-container');
        const tiles = leafletContainer?.querySelectorAll('.leaflet-tile');

        return {
            hasRadarMapBg: !!radarMapBg,
            hasLeafletContainer: !!leafletContainer,
            tileCount: tiles?.length || 0,
            leafletContainerClass: leafletContainer?.className || 'N/A',
            radarMapBgOpacity: radarMapBg?.style.opacity || 'N/A'
        };
    });
    console.log(mapState);

    // Test 1: Click "Update Flight Data" button
    console.log('\n🧪 TEST 1: Clicking "Update Flight Data" button...');
    consoleMessages.length = 0; // Clear previous messages

    await page.click('#btn-update-flights');

    console.log(`⏳ Waiting ${WAIT_BETWEEN_ACTIONS}ms for update to process...`);
    await new Promise(resolve => setTimeout(resolve, WAIT_BETWEEN_ACTIONS));

    const afterUpdateStats = await page.evaluate(() => {
        return {
            setupCalls: document.getElementById('stat-setup-calls').textContent,
            layerRecreations: document.getElementById('stat-layer-recreations').textContent,
            flightUpdates: document.getElementById('stat-flight-updates').textContent
        };
    });
    console.log('📊 After flight update:', afterUpdateStats);

    const mapStateAfterUpdate = await page.evaluate(() => {
        const card = document.getElementById('fr24card');
        const radarMapBg = card.shadowRoot.querySelector('#radar-map-bg');
        const leafletContainer = radarMapBg?.querySelector('.leaflet-container');
        const tiles = leafletContainer?.querySelectorAll('.leaflet-tile');
        const leafletPanes = leafletContainer?.querySelectorAll('.leaflet-pane');
        const tilePane = leafletContainer?.querySelector('.leaflet-tile-pane');
        const tileLayers = tilePane?.querySelectorAll('.leaflet-layer');

        return {
            hasRadarMapBg: !!radarMapBg,
            hasLeafletContainer: !!leafletContainer,
            tileCount: tiles?.length || 0,
            paneCount: leafletPanes?.length || 0,
            tileLayerCount: tileLayers?.length || 0,
            radarMapBgChildren: radarMapBg?.children.length || 0,
            leafletContainerInnerHTML: leafletContainer?.innerHTML.substring(0, 200) || 'N/A'
        };
    });
    console.log('🗺️  Map state after update:', mapStateAfterUpdate);

    // Count [Map] log entries
    const mapLogs = consoleMessages.filter(m => m.text.includes('[Map]'));
    console.log(`\n📝 Found ${mapLogs.length} [Map] log entries during update`);
    mapLogs.forEach(log => {
        console.log(`  ${log.type}: ${log.text}`);
    });

    // Test 2: Multiple rapid updates (simulating auto-update)
    console.log('\n🧪 TEST 2: Rapid updates (simulating auto-update)...');
    for (let i = 0; i < 3; i++) {
        console.log(`  Update ${i + 1}/3...`);
        consoleMessages.length = 0;
        await page.click('#btn-update-flights');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const mapLogsThisUpdate = consoleMessages.filter(m => m.text.includes('[Map]'));
        console.log(`    [Map] logs: ${mapLogsThisUpdate.length}`);
    }

    const finalMapState = await page.evaluate(() => {
        const card = document.getElementById('fr24card');
        const radarMapBg = card.shadowRoot.querySelector('#radar-map-bg');
        const leafletContainer = radarMapBg?.querySelector('.leaflet-container');
        const tiles = leafletContainer?.querySelectorAll('.leaflet-tile');

        return {
            tileCount: tiles?.length || 0,
            hasLeafletContainer: !!leafletContainer
        };
    });
    console.log('🗺️  Final map state:', finalMapState);

    // Test 3: Change map type
    console.log('\n🧪 TEST 3: Changing map type...');
    consoleMessages.length = 0;
    await page.click('#btn-change-map-type');
    await new Promise(resolve => setTimeout(resolve, WAIT_BETWEEN_ACTIONS));

    const mapLogsAfterTypeChange = consoleMessages.filter(m => m.text.includes('[Map]'));
    console.log(`📝 [Map] logs after type change: ${mapLogsAfterTypeChange.length}`);
    mapLogsAfterTypeChange.forEach(log => {
        console.log(`  ${log.type}: ${log.text}`);
    });

    console.log('\n✅ Debug session complete. Browser will stay open for manual inspection.');
    console.log('Press Ctrl+C to close when done.');

    // Keep browser open for manual inspection
    // await browser.close();
}

runMapDebug().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
