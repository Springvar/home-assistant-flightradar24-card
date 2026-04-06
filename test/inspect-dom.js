import puppeteer from 'puppeteer';

const DEV_SERVER_URL = 'http://localhost:5174/test/debug.html';

async function inspectDOM() {
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true
    });

    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`  ${msg.type()}: ${msg.text()}`);
    });

    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.getElementById('fr24card')?.shadowRoot, { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🔍 INITIAL: Full DOM structure inspection');
    const initialStructure = await page.evaluate(() => {
        const card = document.getElementById('fr24card');
        const radarMapBg = card.shadowRoot.querySelector('#radar-map-bg');

        function describeElement(el, depth = 0) {
            if (!el) return 'null';
            const indent = '  '.repeat(depth);
            const tag = el.tagName?.toLowerCase() || 'node';
            const id = el.id ? `#${el.id}` : '';
            const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
            const childCount = el.children?.length || 0;

            let result = `${indent}${tag}${id}${classes} (${childCount} children)\n`;

            // Only go 4 levels deep
            if (depth < 4 && el.children) {
                for (let i = 0; i < Math.min(el.children.length, 5); i++) {
                    result += describeElement(el.children[i], depth + 1);
                }
                if (el.children.length > 5) {
                    result += `${indent}  ... and ${el.children.length - 5} more\n`;
                }
            }

            return result;
        }

        return {
            radarMapBgExists: !!radarMapBg,
            radarMapBgChildren: radarMapBg?.children.length || 0,
            structure: describeElement(radarMapBg)
        };
    });

    console.log('\n📊 Initial structure:');
    console.log(JSON.stringify(initialStructure, null, 2));
    console.log('\nDOM tree:\n' + initialStructure.structure);

    // Now trigger update
    console.log('\n\n🧪 Triggering flight update...');
    await page.click('#btn-update-flights');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🔍 AFTER UPDATE: DOM structure inspection');
    const afterStructure = await page.evaluate(() => {
        const card = document.getElementById('fr24card');
        const radarMapBg = card.shadowRoot.querySelector('#radar-map-bg');

        function describeElement(el, depth = 0) {
            if (!el) return 'null';
            const indent = '  '.repeat(depth);
            const tag = el.tagName?.toLowerCase() || 'node';
            const id = el.id ? `#${el.id}` : '';
            const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
            const childCount = el.children?.length || 0;

            let result = `${indent}${tag}${id}${classes} (${childCount} children)\n`;

            if (depth < 4 && el.children) {
                for (let i = 0; i < Math.min(el.children.length, 5); i++) {
                    result += describeElement(el.children[i], depth + 1);
                }
                if (el.children.length > 5) {
                    result += `${indent}  ... and ${el.children.length - 5} more\n`;
                }
            }

            return result;
        }

        // Also check if Leaflet thinks it has a map
        const hasLeafletMap = !!card.cardState?._leafletMap;
        const leafletMapContainer = card.cardState?._leafletMap?.getContainer();

        return {
            radarMapBgExists: !!radarMapBg,
            radarMapBgChildren: radarMapBg?.children.length || 0,
            structure: describeElement(radarMapBg),
            hasLeafletMapInState: hasLeafletMap,
            leafletMapContainerIsRadarMapBg: leafletMapContainer === radarMapBg,
            leafletMapContainerTag: leafletMapContainer?.tagName || 'N/A',
            leafletMapContainerId: leafletMapContainer?.id || 'N/A'
        };
    });

    console.log('\n📊 After update structure:');
    console.log(JSON.stringify(afterStructure, null, 2));
    console.log('\nDOM tree:\n' + afterStructure.structure);

    console.log('\n✅ Inspection complete. Browser stays open.');
}

inspectDOM().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
