import { describe, it, expect } from 'vitest';
import { parseSortField, getSortFn } from '../../../utils/sort';

describe('sort utilities', () => {
    describe('parseSortField', () => {
        it('returns direct field value', () => {
            const obj = { name: 'test', value: 42 };
            expect(parseSortField(obj, 'name')).toBe('test');
            expect(parseSortField(obj, 'value')).toBe(42);
        });

        it('returns undefined for missing field', () => {
            const obj = { name: 'test' };
            expect(parseSortField(obj, 'missing')).toBeUndefined();
        });

        it('handles fallback with ?? operator', () => {
            const obj = { primary: null, secondary: 'fallback' };
            expect(parseSortField(obj, 'primary ?? secondary')).toBe('fallback');
        });

        it('returns first non-nullish value in chain', () => {
            const obj = { a: undefined, b: null, c: 'value' };
            expect(parseSortField(obj, 'a ?? b ?? c')).toBe('value');
        });

        it('returns undefined if all values in chain are nullish', () => {
            const obj = { a: undefined, b: null };
            expect(parseSortField(obj, 'a ?? b ?? c')).toBeUndefined();
        });
    });

    describe('getSortFn', () => {
        const flights = [
            { id: 'A', altitude: 5000, distance: 10, callsign: 'ALPHA' },
            { id: 'B', altitude: 10000, distance: 5, callsign: 'BRAVO' },
            { id: 'C', altitude: 5000, distance: 15, callsign: 'CHARLIE' }
        ];

        describe('default (no comparator)', () => {
            it('sorts by numeric field ascending', () => {
                const sortFn = getSortFn([{ field: 'distance' }]);
                const sorted = [...flights].sort(sortFn);
                expect(sorted.map(f => f.id)).toEqual(['B', 'A', 'C']);
            });

            it('sorts by numeric field descending', () => {
                const sortFn = getSortFn([{ field: 'distance', order: 'DESC' }]);
                const sorted = [...flights].sort(sortFn);
                expect(sorted.map(f => f.id)).toEqual(['C', 'A', 'B']);
            });

            it('handles case-insensitive order', () => {
                const sortFn = getSortFn([{ field: 'distance', order: 'desc' }]);
                const sorted = [...flights].sort(sortFn);
                expect(sorted.map(f => f.id)).toEqual(['C', 'A', 'B']);
            });
        });

        describe('eq comparator', () => {
            // Note: comparators put MATCHING items LAST in ASC order (result=1 when a matches)
            it('puts non-matching items first when ASC', () => {
                const sortFn = getSortFn([{ field: 'altitude', comparator: 'eq', value: 5000 }]);
                const sorted = [...flights].sort(sortFn);
                // Items where altitude !== 5000 come first
                expect(sorted[0].altitude).toBe(10000);
            });

            it('puts matching items first when DESC', () => {
                const sortFn = getSortFn([{ field: 'altitude', comparator: 'eq', value: 5000, order: 'DESC' }]);
                const sorted = [...flights].sort(sortFn);
                // DESC reverses: matching items come first
                expect(sorted[0].altitude).toBe(5000);
                expect(sorted[1].altitude).toBe(5000);
            });
        });

        describe('lt comparator', () => {
            it('puts items NOT less than value first when ASC', () => {
                const sortFn = getSortFn([{ field: 'altitude', comparator: 'lt', value: 8000 }]);
                const sorted = [...flights].sort(sortFn);
                // altitude >= 8000 (10000) comes first
                expect(sorted[0].altitude).toBe(10000);
            });
        });

        describe('lte comparator', () => {
            it('puts items greater than value first when ASC', () => {
                const sortFn = getSortFn([{ field: 'altitude', comparator: 'lte', value: 5000 }]);
                const sorted = [...flights].sort(sortFn);
                // altitude > 5000 comes first
                expect(sorted[0].altitude).toBe(10000);
            });
        });

        describe('gt comparator', () => {
            it('puts items NOT greater than value first when ASC', () => {
                const sortFn = getSortFn([{ field: 'altitude', comparator: 'gt', value: 5000 }]);
                const sorted = [...flights].sort(sortFn);
                // altitude <= 5000 comes first
                expect(sorted[0].altitude).toBe(5000);
            });
        });

        describe('gte comparator', () => {
            it('puts items less than value first when ASC', () => {
                const sortFn = getSortFn([{ field: 'altitude', comparator: 'gte', value: 10000 }]);
                const sorted = [...flights].sort(sortFn);
                // altitude < 10000 comes first
                expect(sorted[0].altitude).toBe(5000);
            });
        });

        describe('oneOf comparator', () => {
            it('puts items NOT in array first when ASC', () => {
                const sortFn = getSortFn([{ field: 'id', comparator: 'oneOf', value: ['B', 'C'] }]);
                const sorted = [...flights].sort(sortFn);
                // 'A' is not in ['B', 'C'], so it comes first
                expect(sorted[0].id).toBe('A');
                expect(['B', 'C']).toContain(sorted[1].id);
                expect(['B', 'C']).toContain(sorted[2].id);
            });

            it('handles string value (checks if field is char in string)', () => {
                const sortFn = getSortFn([{ field: 'id', comparator: 'oneOf', value: 'ABC' }]);
                const sorted = [...flights].sort(sortFn);
                // All should match since A, B, C are all in 'ABC'
                expect(sorted.length).toBe(3);
            });

            it('handles undefined value gracefully', () => {
                const sortFn = getSortFn([{ field: 'id', comparator: 'oneOf', value: undefined }]);
                const sorted = [...flights].sort(sortFn);
                // Should not crash, order may be unchanged
                expect(sorted.length).toBe(3);
            });
        });

        describe('containsOneOf comparator', () => {
            it('puts items NOT containing values first when ASC', () => {
                const sortFn = getSortFn([{ field: 'callsign', comparator: 'containsOneOf', value: ['CHAR', 'BRA'] }]);
                const sorted = [...flights].sort(sortFn);
                // ALPHA doesn't contain CHAR or BRA, so it comes first
                expect(sorted[0].id).toBe('A');
                expect(['B', 'C']).toContain(sorted[1].id);
                expect(['B', 'C']).toContain(sorted[2].id);
            });

            it('handles empty value array', () => {
                const sortFn = getSortFn([{ field: 'callsign', comparator: 'containsOneOf', value: [] }]);
                const sorted = [...flights].sort(sortFn);
                expect(sorted.length).toBe(3);
            });
        });

        describe('multi-criteria sorting', () => {
            it('uses secondary criterion when primary is tied', () => {
                const sortFn = getSortFn([
                    { field: 'altitude' },
                    { field: 'distance' }
                ]);
                const sorted = [...flights].sort(sortFn);
                // First by altitude, then by distance
                // altitude 5000: A(dist 10), C(dist 15)
                // altitude 10000: B(dist 5)
                expect(sorted[0].id).toBe('A'); // altitude 5000, distance 10
                expect(sorted[1].id).toBe('C'); // altitude 5000, distance 15
                expect(sorted[2].id).toBe('B'); // altitude 10000
            });

            it('returns 0 when all criteria are equal', () => {
                const items = [
                    { id: 'X', value: 1 },
                    { id: 'Y', value: 1 }
                ];
                const sortFn = getSortFn([{ field: 'value' }]);
                expect(sortFn(items[0], items[1])).toBe(0);
            });
        });

        describe('resolvePlaceholders callback', () => {
            it('calls resolvePlaceholders with criterion value', () => {
                const testFlights = [
                    { id: 'A', distance: 10 },
                    { id: 'B', distance: 5 }
                ];
                const resolvePlaceholders = (v: unknown) => (v === '${maxDist}' ? 8 : v);
                const sortFn = getSortFn(
                    [{ field: 'distance', comparator: 'lt', value: '${maxDist}' }],
                    resolvePlaceholders
                );
                const sorted = [...testFlights].sort(sortFn);
                // ASC with lt comparator: items NOT matching (distance >= 8) come first
                // A has distance 10 (>= 8), B has distance 5 (< 8)
                expect(sorted[0].id).toBe('A');
                expect(sorted[1].id).toBe('B');
            });
        });
    });
});
