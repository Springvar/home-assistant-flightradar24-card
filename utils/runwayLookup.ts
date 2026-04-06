interface RunwayData {
    airportCode: string;
    runwayDesignator: string;
    latitude: number;
    longitude: number;
    heading: number;
    length: number;
}

interface ParsedQuery {
    airportCode: string;
    runwayDesignator: string;
}

interface RunwaySearchResult {
    displayText: string;
    airportCode: string;
    airportName: string;
    iataCode: string;
    runwayDesignator: string;
    data: RunwayData;
}

let cachedRunwayCSV: string | null = null;
let cachedAirportCSV: string | null = null;

/**
 * Parse user input like "ENVA RWY09", "LAX 25L", "LHR09L", etc.
 */
export function parseRunwayQuery(query: string): ParsedQuery | null {
    const cleaned = query.trim().toUpperCase();

    // Pattern 1: "ENVA RWY09" or "ENVA RWY 09"
    let match = cleaned.match(/^([A-Z0-9]{3,4})\s+RWY\s*([0-9]{1,2}[LRC]?)$/);
    if (match) {
        return {
            airportCode: match[1],
            runwayDesignator: match[2].padStart(2, '0')
        };
    }

    // Pattern 2: "ENVA 09" or "LAX 25L"
    match = cleaned.match(/^([A-Z0-9]{3,4})\s+([0-9]{1,2}[LRC]?)$/);
    if (match) {
        return {
            airportCode: match[1],
            runwayDesignator: match[2].padStart(2, '0')
        };
    }

    // Pattern 3: "LHR09L" (no space)
    match = cleaned.match(/^([A-Z0-9]{3,4})([0-9]{1,2}[LRC]?)$/);
    if (match) {
        return {
            airportCode: match[1],
            runwayDesignator: match[2].padStart(2, '0')
        };
    }

    return null;
}

/**
 * Fetch runway CSV data (with caching)
 */
async function fetchRunwayCSV(): Promise<string> {
    if (cachedRunwayCSV) {
        return cachedRunwayCSV;
    }

    // Try local bundled copy first
    try {
        const response = await fetch('/local/flightradar24-card/runways.csv');
        if (response.ok) {
            cachedRunwayCSV = await response.text();
            return cachedRunwayCSV;
        }
    } catch (e) {
        // Fall through to remote fetch
    }

    // Try data directory
    try {
        const response = await fetch('data/runways.csv');
        if (response.ok) {
            cachedRunwayCSV = await response.text();
            return cachedRunwayCSV;
        }
    } catch (e) {
        // Fall through to remote fetch
    }

    // Fallback to remote OurAirports
    const response = await fetch('https://davidmegginson.github.io/ourairports-data/runways.csv');
    if (!response.ok) {
        throw new Error(`Failed to fetch runway data: ${response.status}`);
    }

    cachedRunwayCSV = await response.text();
    return cachedRunwayCSV;
}

/**
 * Fetch airport CSV data (with caching)
 */
async function fetchAirportCSV(): Promise<string> {
    if (cachedAirportCSV) {
        return cachedAirportCSV;
    }

    // Try local bundled copy first
    try {
        const response = await fetch('/local/flightradar24-card/airports.csv');
        if (response.ok) {
            cachedAirportCSV = await response.text();
            return cachedAirportCSV;
        }
    } catch (e) {
        // Fall through to remote fetch
    }

    // Try data directory
    try {
        const response = await fetch('data/airports.csv');
        if (response.ok) {
            cachedAirportCSV = await response.text();
            return cachedAirportCSV;
        }
    } catch (e) {
        // Fall through to remote fetch
    }

    // Fallback to remote OurAirports
    const response = await fetch('https://davidmegginson.github.io/ourairports-data/airports.csv');
    if (!response.ok) {
        throw new Error(`Failed to fetch airport data: ${response.status}`);
    }

    cachedAirportCSV = await response.text();
    return cachedAirportCSV;
}

/**
 * Search for runway by airport code and designator
 */
/**
 * Simple CSV line parser that handles quoted fields
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

export async function lookupRunway(query: string): Promise<RunwayData | null> {
    const parsed = parseRunwayQuery(query);
    if (!parsed) {
        throw new Error('Invalid runway query format. Use: "ENVA RWY09", "LAX 25L", or "LHR09L"');
    }

    const csv = await fetchRunwayCSV();
    const lines = csv.split('\n');
    const header = parseCSVLine(lines[0]);

    // Find column indices
    const airportIdx = header.indexOf('airport_ident');
    const leIdentIdx = header.indexOf('le_ident');
    const heIdentIdx = header.indexOf('he_ident');
    const leLatIdx = header.indexOf('le_latitude_deg');
    const leLonIdx = header.indexOf('le_longitude_deg');
    const heLatIdx = header.indexOf('he_latitude_deg');
    const heLonIdx = header.indexOf('he_longitude_deg');
    const leHeadingIdx = header.indexOf('le_heading_degT');
    const heHeadingIdx = header.indexOf('he_heading_degT');
    const lengthIdx = header.indexOf('length_ft');

    if (airportIdx === -1 || leIdentIdx === -1) {
        throw new Error('Invalid runway data format');
    }

    // Search for matching runway
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row = parseCSVLine(line);
        const airportCode = row[airportIdx];

        if (airportCode !== parsed.airportCode) continue;

        const leIdent = row[leIdentIdx];
        const heIdent = row[heIdentIdx];

        // Match against low end (le)
        if (leIdent === parsed.runwayDesignator) {
            return {
                airportCode,
                runwayDesignator: leIdent,
                latitude: parseFloat(row[leLatIdx]),
                longitude: parseFloat(row[leLonIdx]),
                heading: parseFloat(row[leHeadingIdx]),
                length: parseFloat(row[lengthIdx])
            };
        }

        // Match against high end (he)
        if (heIdent === parsed.runwayDesignator) {
            return {
                airportCode,
                runwayDesignator: heIdent,
                latitude: parseFloat(row[heLatIdx]),
                longitude: parseFloat(row[heLonIdx]),
                heading: parseFloat(row[heHeadingIdx]),
                length: parseFloat(row[lengthIdx])
            };
        }
    }

    return null;
}

interface ScoredResult extends RunwaySearchResult {
    score: number;
}

/**
 * Calculate match score for prioritizing results
 */
function calculateMatchScore(searchTerm: string, airportCode: string, iataCode: string, airportName: string, runwayDesignator: string): number {
    let score = 0;

    // Exact IATA match - highest priority
    if (iataCode && iataCode === searchTerm) {
        score += 1000;
    }

    // IATA starts with search term
    if (iataCode && iataCode.startsWith(searchTerm)) {
        score += 500;
    }

    // Exact ICAO match
    if (airportCode === searchTerm) {
        score += 900;
    }

    // ICAO starts with search term
    if (airportCode.startsWith(searchTerm)) {
        score += 400;
    }

    // Runway designator matches
    if (runwayDesignator && `${airportCode}${runwayDesignator}`.includes(searchTerm)) {
        score += 300;
    }

    // Airport name word starts with search term
    const nameWords = airportName.toUpperCase().split(/[\s,/-]+/);
    for (const word of nameWords) {
        if (word.startsWith(searchTerm)) {
            score += 250;
            break;
        }
    }

    // Airport name contains search term (not at word boundary)
    if (airportName.toUpperCase().includes(searchTerm)) {
        score += 100;
    }

    return score;
}

/**
 * Search for runways with typeahead - returns up to 10 matches, ranked by relevance
 */
export async function searchRunways(query: string): Promise<RunwaySearchResult[]> {
    if (!query || query.length < 2) {
        return [];
    }

    const searchTerm = query.trim().toUpperCase();
    const scoredResults: ScoredResult[] = [];

    // Fetch both datasets
    const [runwaysCSV, airportsCSV] = await Promise.all([
        fetchRunwayCSV(),
        fetchAirportCSV()
    ]);

    // Parse airports to build lookup map
    const airportMap = new Map<string, { name: string; iata: string }>();
    const airportsLines = airportsCSV.split('\n');
    const airportsHeader = parseCSVLine(airportsLines[0]);
    const identIdx = airportsHeader.indexOf('ident');
    const nameIdx = airportsHeader.indexOf('name');
    const iataIdx = airportsHeader.indexOf('iata_code');

    for (let i = 1; i < airportsLines.length; i++) {
        const line = airportsLines[i].trim();
        if (!line) continue;

        const row = parseCSVLine(line);
        const ident = row[identIdx];
        const name = row[nameIdx];
        const iata = row[iataIdx];

        if (ident) {
            airportMap.set(ident, { name: name || '', iata: iata || '' });
        }
    }

    // Parse runways and search
    const runwaysLines = runwaysCSV.split('\n');
    const runwaysHeader = parseCSVLine(runwaysLines[0]);

    const airportIdx = runwaysHeader.indexOf('airport_ident');
    const leIdentIdx = runwaysHeader.indexOf('le_ident');
    const heIdentIdx = runwaysHeader.indexOf('he_ident');
    const leLatIdx = runwaysHeader.indexOf('le_latitude_deg');
    const leLonIdx = runwaysHeader.indexOf('le_longitude_deg');
    const heLatIdx = runwaysHeader.indexOf('he_latitude_deg');
    const heLonIdx = runwaysHeader.indexOf('he_longitude_deg');
    const leHeadingIdx = runwaysHeader.indexOf('le_heading_degT');
    const heHeadingIdx = runwaysHeader.indexOf('he_heading_degT');
    const lengthIdx = runwaysHeader.indexOf('length_ft');

    for (let i = 1; i < runwaysLines.length; i++) {
        const line = runwaysLines[i].trim();
        if (!line) continue;

        const row = parseCSVLine(line);
        const airportCode = row[airportIdx];
        const leIdent = row[leIdentIdx];
        const heIdent = row[heIdentIdx];

        const airportInfo = airportMap.get(airportCode);
        if (!airportInfo) continue;

        const { name: airportName, iata: iataCode } = airportInfo;

        // Check if search term matches
        const matchICAO = airportCode.startsWith(searchTerm);
        const matchIATA = iataCode && iataCode.toUpperCase().startsWith(searchTerm);
        const matchName = airportName.toUpperCase().includes(searchTerm);
        const matchLE = leIdent && `${airportCode}${leIdent}`.includes(searchTerm);
        const matchHE = heIdent && `${airportCode}${heIdent}`.includes(searchTerm);

        if (!matchICAO && !matchIATA && !matchName && !matchLE && !matchHE) {
            continue;
        }

        // Calculate score for this airport
        const baseScore = calculateMatchScore(searchTerm, airportCode, iataCode, airportName, leIdent || heIdent || '');

        // Add low end runway
        if (leIdent) {
            const displayParts = [];
            if (iataCode) displayParts.push(iataCode);
            displayParts.push(airportCode);
            displayParts.push(`RWY${leIdent}`);
            if (airportName) displayParts.push(`- ${airportName}`);

            scoredResults.push({
                displayText: displayParts.join(' '),
                airportCode,
                airportName,
                iataCode,
                runwayDesignator: leIdent,
                data: {
                    airportCode,
                    runwayDesignator: leIdent,
                    latitude: parseFloat(row[leLatIdx]),
                    longitude: parseFloat(row[leLonIdx]),
                    heading: parseFloat(row[leHeadingIdx]),
                    length: parseFloat(row[lengthIdx])
                },
                score: baseScore
            });
        }

        // Add high end runway
        if (heIdent) {
            const displayParts = [];
            if (iataCode) displayParts.push(iataCode);
            displayParts.push(airportCode);
            displayParts.push(`RWY${heIdent}`);
            if (airportName) displayParts.push(`- ${airportName}`);

            scoredResults.push({
                displayText: displayParts.join(' '),
                airportCode,
                airportName,
                iataCode,
                runwayDesignator: heIdent,
                data: {
                    airportCode,
                    runwayDesignator: heIdent,
                    latitude: parseFloat(row[heLatIdx]),
                    longitude: parseFloat(row[heLonIdx]),
                    heading: parseFloat(row[heHeadingIdx]),
                    length: parseFloat(row[lengthIdx])
                },
                score: baseScore
            });
        }
    }

    // Sort by score (highest first) and return top 10
    return scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(({ score, ...result }) => result);
}
