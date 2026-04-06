import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNWAYS_FILE = join(__dirname, '../../data/runways.csv');
const dataFileExists = existsSync(RUNWAYS_FILE);

describe('Runway Data', () => {
    it.skipIf(!dataFileExists)('should exist', () => {
        expect(existsSync(RUNWAYS_FILE)).toBe(true);
    });

    it.skipIf(!dataFileExists)('should have required columns', () => {
        const csv = readFileSync(RUNWAYS_FILE, 'utf-8');
        const lines = csv.split('\n');
        const header = lines[0];

        const requiredColumns = [
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

        for (const col of requiredColumns) {
            expect(header).toContain(col);
        }
    });

    it.skipIf(!dataFileExists)('should have valid data rows', () => {
        const csv = readFileSync(RUNWAYS_FILE, 'utf-8');
        const lines = csv.split('\n').filter(line => line.trim());
        // Parse CSV header, removing quotes
        const header = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));

        // Get column indices
        const airportIdx = header.indexOf('airport_ident');
        const leIdentIdx = header.indexOf('le_ident');
        const leLat = header.indexOf('le_latitude_deg');
        const leLon = header.indexOf('le_longitude_deg');
        const lengthIdx = header.indexOf('length_ft');

        expect(airportIdx).toBeGreaterThanOrEqual(0);
        expect(leIdentIdx).toBeGreaterThanOrEqual(0);

        // Test a few rows
        for (let i = 1; i < Math.min(10, lines.length); i++) {
            const row = lines[i].split(',').map(v => v.replace(/^"|"$/g, ''));

            // Airport code should exist and be uppercase
            expect(row[airportIdx]).toBeTruthy();
            expect(row[airportIdx]).toMatch(/^[A-Z0-9]+$/);

            // Latitude should be a valid number between -90 and 90
            const lat = parseFloat(row[leLat]);
            if (!isNaN(lat)) {
                expect(lat).toBeGreaterThanOrEqual(-90);
                expect(lat).toBeLessThanOrEqual(90);
            }

            // Longitude should be a valid number between -180 and 180
            const lon = parseFloat(row[leLon]);
            if (!isNaN(lon)) {
                expect(lon).toBeGreaterThanOrEqual(-180);
                expect(lon).toBeLessThanOrEqual(180);
            }

            // Length should be a positive number
            const length = parseFloat(row[lengthIdx]);
            if (!isNaN(length)) {
                expect(length).toBeGreaterThan(0);
            }
        }
    });

    it.skipIf(!dataFileExists)('should have reasonable number of records', () => {
        const csv = readFileSync(RUNWAYS_FILE, 'utf-8');
        const lines = csv.split('\n').filter(line => line.trim());

        // OurAirports has tens of thousands of runways
        expect(lines.length).toBeGreaterThan(1000);
    });
});
