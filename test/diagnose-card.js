import puppeteer from 'puppeteer';

const DEV_SERVER_URL = 'http://localhost:5174/test/debug.html';

async function diagnoseCard() {
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true,
        args: ['--window-size=1400,1000']
    });

    const page = await browser.newPage();

    // Capture ALL console messages
    page.on('console', msg => {
        console.log(`  CONSOLE ${msg.type()}: ${msg.text()}`);
    });

    page.on('pageerror', error => {
        console.error('❌ Page error:', error.message);
    });

    console.log('📖 Opening debug page...');
    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle2' });

    console.log('⏳ Waiting for card element...');
    await page.waitForFunction(() => {
        return document.getElementById('fr24card');
    }, { timeout: 10000 });

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🔍 Diagnosing card state...');
    const diagnosis = await page.evaluate(() => {
        const card = document.getElementById('fr24card');

        return {
            cardExists: !!card,
            cardTagName: card?.tagName,
            hasShadowRoot: !!card?.shadowRoot,
            hasSetConfig: typeof card?.setConfig === 'function',
            hasHass: !!card?.hass,
            hasCardState: !!card?.cardState,
            cardStateConfig: card?.cardState?.config ? 'exists' : 'missing',
            cardStateRadar: card?.cardState?.radar ? JSON.stringify(card?.cardState?.radar) : 'missing',
            cardStateDimensions: card?.cardState?.dimensions ? JSON.stringify(card?.cardState?.dimensions) : 'missing',
            shadowRootChildren: card?.shadowRoot?.children?.length || 0,
            shadowRootChildIds: Array.from(card?.shadowRoot?.children || []).map(c => c.id),
            radarExists: !!card?.shadowRoot?.querySelector('#radar'),
            radarScreenExists: !!card?.shadowRoot?.querySelector('#radar-screen'),
            radarMapBgExists: !!card?.shadowRoot?.querySelector('#radar-map-bg'),
            leafletLoaded: !!(window.L),
            updateRequired: card?._updateRequired
        };
    });

    console.log('\n📋 Diagnosis:', JSON.stringify(diagnosis, null, 2));

    // Try to manually trigger update
    console.log('\n🔧 Attempting to manually trigger card update...');
    await page.evaluate(() => {
        const card = document.getElementById('fr24card');
        if (card) {
            card._updateRequired = true;
            card.hass = card.hass; // Trigger hass setter
        }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const afterUpdate = await page.evaluate(() => {
        const card = document.getElementById('fr24card');
        return {
            radarMapBgExists: !!card?.shadowRoot?.querySelector('#radar-map-bg'),
            radarMapBgHTML: card?.shadowRoot?.querySelector('#radar-map-bg')?.innerHTML?.substring(0, 200) || 'N/A',
            updateRequired: card?._updateRequired
        };
    });

    console.log('\n📋 After manual update:', JSON.stringify(afterUpdate, null, 2));

    console.log('\n✅ Diagnosis complete. Browser will stay open.');
    console.log('Press Ctrl+C to close when done.');
}

diagnoseCard().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
