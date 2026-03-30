import { describe, it, expect } from 'vitest';
import {
    toRadians,
    toDegrees,
    haversine,
    calculateBearing,
    calculateNewPosition,
    calculateClosestPassingPoint,
    getCardinalDirection,
    areHeadingsAligned
} from '../../../utils/geometric';

describe('geometric utilities', () => {
    describe('toRadians', () => {
        it('converts 0 degrees to 0 radians', () => {
            expect(toRadians(0)).toBe(0);
        });

        it('converts 90 degrees to PI/2 radians', () => {
            expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
        });

        it('converts 180 degrees to PI radians', () => {
            expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
        });

        it('converts 360 degrees to 2*PI radians', () => {
            expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 10);
        });

        it('handles negative degrees', () => {
            expect(toRadians(-90)).toBeCloseTo(-Math.PI / 2, 10);
        });
    });

    describe('toDegrees', () => {
        it('converts 0 radians to 0 degrees', () => {
            expect(toDegrees(0)).toBe(0);
        });

        it('converts PI/2 radians to 90 degrees', () => {
            expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 10);
        });

        it('converts PI radians to 180 degrees', () => {
            expect(toDegrees(Math.PI)).toBeCloseTo(180, 10);
        });

        it('converts 2*PI radians to 360 degrees', () => {
            expect(toDegrees(2 * Math.PI)).toBeCloseTo(360, 10);
        });

        it('is the inverse of toRadians', () => {
            const degrees = 45;
            expect(toDegrees(toRadians(degrees))).toBeCloseTo(degrees, 10);
        });
    });

    describe('haversine', () => {
        // Reference: Oslo (59.9139, 10.7522) to Trondheim (63.4305, 10.3951) is ~390 km
        const osloLat = 59.9139;
        const osloLon = 10.7522;
        const trondheimLat = 63.4305;
        const trondheimLon = 10.3951;

        it('calculates distance in kilometers by default', () => {
            const distance = haversine(osloLat, osloLon, trondheimLat, trondheimLon);
            expect(distance).toBeCloseTo(390, -1); // Within 10 km
        });

        it('calculates distance in kilometers when specified', () => {
            const distance = haversine(osloLat, osloLon, trondheimLat, trondheimLon, 'km');
            expect(distance).toBeCloseTo(390, -1);
        });

        it('calculates distance in miles when specified', () => {
            const distanceKm = haversine(osloLat, osloLon, trondheimLat, trondheimLon, 'km');
            const distanceMiles = haversine(osloLat, osloLon, trondheimLat, trondheimLon, 'miles');
            // 1 mile = 1.60934 km
            expect(distanceKm / distanceMiles).toBeCloseTo(1.60934, 3);
        });

        it('returns 0 for same point', () => {
            const distance = haversine(osloLat, osloLon, osloLat, osloLon);
            expect(distance).toBe(0);
        });

        it('handles antipodal points', () => {
            // From 0,0 to 0,180 should be ~20,000 km (half Earth circumference)
            const distance = haversine(0, 0, 0, 180);
            expect(distance).toBeCloseTo(20015, -2); // Within 100 km
        });
    });

    describe('calculateBearing', () => {
        it('returns 0 for due north', () => {
            const bearing = calculateBearing(0, 0, 1, 0);
            expect(bearing).toBeCloseTo(0, 0);
        });

        it('returns 90 for due east', () => {
            const bearing = calculateBearing(0, 0, 0, 1);
            expect(bearing).toBeCloseTo(90, 0);
        });

        it('returns 180 for due south', () => {
            const bearing = calculateBearing(1, 0, 0, 0);
            expect(bearing).toBeCloseTo(180, 0);
        });

        it('returns 270 for due west', () => {
            const bearing = calculateBearing(0, 1, 0, 0);
            expect(bearing).toBeCloseTo(270, 0);
        });

        it('returns value between 0 and 360', () => {
            const bearing = calculateBearing(63.4, 10.4, 59.9, 10.7);
            expect(bearing).toBeGreaterThanOrEqual(0);
            expect(bearing).toBeLessThan(360);
        });
    });

    describe('calculateNewPosition', () => {
        it('moves north correctly', () => {
            const start = { lat: 0, lon: 0 };
            const distance = 111.32; // ~1 degree at equator in km
            const result = calculateNewPosition(start.lat, start.lon, 0, distance);
            expect(result.lat).toBeCloseTo(1, 0);
            expect(result.lon).toBeCloseTo(0, 5);
        });

        it('moves east correctly', () => {
            const start = { lat: 0, lon: 0 };
            const distance = 111.32;
            const result = calculateNewPosition(start.lat, start.lon, 90, distance);
            expect(result.lat).toBeCloseTo(0, 5);
            expect(result.lon).toBeCloseTo(1, 0);
        });

        it('returns same position for 0 distance', () => {
            const start = { lat: 63.4, lon: 10.4 };
            const result = calculateNewPosition(start.lat, start.lon, 45, 0);
            expect(result.lat).toBeCloseTo(start.lat, 10);
            expect(result.lon).toBeCloseTo(start.lon, 10);
        });

        it('is reversible with inverse bearing', () => {
            const start = { lat: 63.4, lon: 10.4 };
            const distance = 50;
            const bearing = 45;
            const forward = calculateNewPosition(start.lat, start.lon, bearing, distance);
            const back = calculateNewPosition(forward.lat, forward.lon, (bearing + 180) % 360, distance);
            // Allow tolerance due to spherical geometry approximations at high latitudes
            expect(back.lat).toBeCloseTo(start.lat, 1);
            expect(back.lon).toBeCloseTo(start.lon, 1);
        });
    });

    describe('calculateClosestPassingPoint', () => {
        it('calculates point on flight path closest to reference', () => {
            // Flight heading east, reference point to the south
            const refLat = 63.0;
            const refLon = 10.4;
            const flightLat = 63.4;
            const flightLon = 10.0;
            const heading = 90; // East

            const closest = calculateClosestPassingPoint(refLat, refLon, flightLat, flightLon, heading);

            // The closest point should be roughly at the same longitude as reference
            expect(closest.lon).toBeCloseTo(refLon, 0);
        });

        it('returns flight position when heading directly toward reference', () => {
            const refLat = 63.0;
            const refLon = 10.4;
            const flightLat = 63.4;
            const flightLon = 10.4;

            // Calculate bearing from flight to reference
            const heading = calculateBearing(flightLat, flightLon, refLat, refLon);

            const closest = calculateClosestPassingPoint(refLat, refLon, flightLat, flightLon, heading);

            // Closest point should be near the reference point
            const distanceToRef = haversine(refLat, refLon, closest.lat, closest.lon);
            expect(distanceToRef).toBeLessThan(1); // Within 1 km
        });
    });

    describe('getCardinalDirection', () => {
        // The function uses Math.round(bearing / 45) % 8
        // Boundaries are at 22.5, 67.5, 112.5, etc. (Math.round rounds 0.5 up)
        it.each([
            [0, 'N'],
            [22, 'N'],
            [23, 'NE'],  // 22.5+ rounds to 1 (NE)
            [45, 'NE'],
            [67, 'NE'],
            [68, 'E'],   // 67.5+ rounds to 2 (E)
            [90, 'E'],
            [112, 'E'],
            [113, 'SE'], // 112.5+ rounds to 3 (SE)
            [135, 'SE'],
            [157, 'SE'],
            [158, 'S'],  // 157.5+ rounds to 4 (S)
            [180, 'S'],
            [202, 'S'],
            [203, 'SW'], // 202.5+ rounds to 5 (SW)
            [225, 'SW'],
            [247, 'SW'],
            [248, 'W'],  // 247.5+ rounds to 6 (W)
            [270, 'W'],
            [292, 'W'],
            [293, 'NW'], // 292.5+ rounds to 7 (NW)
            [315, 'NW'],
            [337, 'NW'],
            [338, 'N'],  // 337.5+ rounds to 8 % 8 = 0 (N)
            [359, 'N']
        ])('bearing %d returns %s', (bearing, expected) => {
            expect(getCardinalDirection(bearing)).toBe(expected);
        });

        it('handles 360 degrees as N', () => {
            expect(getCardinalDirection(360)).toBe('N');
        });
    });

    describe('areHeadingsAligned', () => {
        it('returns true when headings match exactly', () => {
            expect(areHeadingsAligned(180, 180)).toBe(true);
        });

        it('returns true when within default margin of 60 degrees', () => {
            expect(areHeadingsAligned(180, 170)).toBe(true);
            expect(areHeadingsAligned(180, 190)).toBe(true);
            expect(areHeadingsAligned(180, 120)).toBe(true);
            expect(areHeadingsAligned(180, 240)).toBe(true);
        });

        it('returns false when outside default margin', () => {
            expect(areHeadingsAligned(180, 100)).toBe(false);
            expect(areHeadingsAligned(180, 260)).toBe(false);
        });

        it('handles wrap-around at 0/360', () => {
            expect(areHeadingsAligned(10, 350)).toBe(true);
            expect(areHeadingsAligned(350, 10)).toBe(true);
            expect(areHeadingsAligned(0, 359)).toBe(true);
        });

        it('respects custom margin parameter', () => {
            expect(areHeadingsAligned(180, 160, 30)).toBe(true);
            expect(areHeadingsAligned(180, 140, 30)).toBe(false);
        });

        it('handles opposite directions as not aligned', () => {
            expect(areHeadingsAligned(0, 180)).toBe(false);
            expect(areHeadingsAligned(90, 270)).toBe(false);
        });
    });
});
