import puppeteer from 'puppeteer';

const DEV_SERVER_URL = 'http://localhost:5174/test/debug.html';

async function checkConfig() {
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true
    });

    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`  ${msg.type()}: ${msg.text()}`);
    });

    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle2' });

    await page.waitForFunction(() => {
        return document.getElementById('fr24card');
    }, { timeout: 10000 });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const configCheck = await page.evaluate(() => {
        const card = document.getElementById('fr24card');

        // Get the cardConfig from the page script
        const scriptContent = document.querySelector('script:not([src])').textContent;
        const cardConfigMatch = scriptContent.match(/const cardConfig = ({[\s\S]*?});/);

        return {
            scriptHasConfig: !!cardConfigMatch,
            cardConfigSnippet: cardConfigMatch ? cardConfigMatch[1].substring(0, 500) : 'not found',
            cardStateConfig: card.cardState.config ? JSON.stringify(card.cardState.config, null, 2) : 'missing',
            cardStateRadar: card.cardState.radar ? JSON.stringify(card.cardState.radar, null, 2) : 'missing'
        };
    });

    console.log('\n📋 Config check:\n', JSON.stringify(configCheck, null, 2));

    console.log('\n✅ Complete.');
}

checkConfig().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
