import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNWAYS_URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv';
const AIRPORTS_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const RUNWAYS_OUTPUT = `${__dirname}/../data/runways.csv`;
const AIRPORTS_OUTPUT = `${__dirname}/../data/airports.csv`;

async function fetchRunwayData() {
    console.info('Fetching data from OurAirports...');

    try {
        // Fetch runways
        console.info('  - Downloading runways.csv...');
        const runwaysResponse = await fetch(RUNWAYS_URL);
        if (!runwaysResponse.ok) {
            throw new Error(`HTTP error fetching runways: ${runwaysResponse.status}`);
        }
        const runwaysCSV = await runwaysResponse.text();

        // Verify runways structure
        const runwaysLines = runwaysCSV.split('\n');
        const runwaysHeader = runwaysLines[0];
        const requiredRunwaysColumns = [
            'airport_ident',
            'le_ident',
            'he_ident',
            'le_latitude_deg',
            'le_longitude_deg',
            'he_latitude_deg',
            'he_longitude_deg',
            'le_heading_degT',
            'he_heading_degT',
            'length_ft'
        ];

        for (const col of requiredRunwaysColumns) {
            if (!runwaysHeader.includes(col)) {
                throw new Error(`Missing required runway column: ${col}`);
            }
        }

        console.info(`    ✓ ${runwaysLines.length - 1} runway records`);

        // Fetch airports
        console.info('  - Downloading airports.csv...');
        const airportsResponse = await fetch(AIRPORTS_URL);
        if (!airportsResponse.ok) {
            throw new Error(`HTTP error fetching airports: ${airportsResponse.status}`);
        }
        const airportsCSV = await airportsResponse.text();

        // Verify airports structure
        const airportsLines = airportsCSV.split('\n');
        const airportsHeader = airportsLines[0];
        const requiredAirportsColumns = [
            'ident',
            'name',
            'iata_code'
        ];

        for (const col of requiredAirportsColumns) {
            if (!airportsHeader.includes(col)) {
                throw new Error(`Missing required airport column: ${col}`);
            }
        }

        console.info(`    ✓ ${airportsLines.length - 1} airport records`);

        // Ensure output directory exists
        mkdirSync(dirname(RUNWAYS_OUTPUT), { recursive: true });

        // Write files
        writeFileSync(RUNWAYS_OUTPUT, runwaysCSV, 'utf-8');
        writeFileSync(AIRPORTS_OUTPUT, airportsCSV, 'utf-8');

        console.info(`✓ Data saved to data/ directory`);

    } catch (error) {
        console.error('Failed to fetch airport/runway data:', error);
        process.exit(1);
    }
}

fetchRunwayData();
