import { describe, it, expect, vi } from 'vitest';
import { applyFilter, applyConditions, applyCondition } from '../../../utils/filter';
import { createMockFlight } from '../../fixtures/flights';
import type { Condition } from '../../../types/config';
import type { PartialCardState } from '../../../types/cardState';

describe('filter', () => {
    describe('applyFilter', () => {
        it('returns all flights when filter matches all', () => {
            const flights = [
                createMockFlight({ id: '1', altitude: 35000 }),
                createMockFlight({ id: '2', altitude: 30000 })
            ];
            const cardState: PartialCardState = { flights };
            const filter: Condition[] = [{ field: 'altitude', comparator: 'gt', value: 20000 }];

            const result = applyFilter(cardState, filter);
            expect(result).toHaveLength(2);
        });

        it('filters out flights that do not match', () => {
            const flights = [
                createMockFlight({ id: '1', altitude: 35000 }),
                createMockFlight({ id: '2', altitude: 15000 })
            ];
            const cardState: PartialCardState = { flights };
            const filter: Condition[] = [{ field: 'altitude', comparator: 'gt', value: 20000 }];

            const result = applyFilter(cardState, filter);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });

        it('returns empty array when no flights match', () => {
            const flights = [
                createMockFlight({ id: '1', altitude: 10000 }),
                createMockFlight({ id: '2', altitude: 15000 })
            ];
            const cardState: PartialCardState = { flights };
            const filter: Condition[] = [{ field: 'altitude', comparator: 'gt', value: 40000 }];

            const result = applyFilter(cardState, filter);
            expect(result).toHaveLength(0);
        });
    });

    describe('applyConditions', () => {
        it('handles array of conditions (AND logic)', () => {
            const flight = createMockFlight({ altitude: 35000, ground_speed: 450 });
            const cardState: PartialCardState = { flights: [flight] };
            const conditions: Condition[] = [
                { field: 'altitude', comparator: 'gt', value: 30000 },
                { field: 'ground_speed', comparator: 'gt', value: 400 }
            ];

            expect(applyConditions(cardState, flight, conditions)).toBe(true);
        });

        it('returns false if any condition in array fails', () => {
            const flight = createMockFlight({ altitude: 35000, ground_speed: 350 });
            const cardState: PartialCardState = { flights: [flight] };
            const conditions: Condition[] = [
                { field: 'altitude', comparator: 'gt', value: 30000 },
                { field: 'ground_speed', comparator: 'gt', value: 400 }
            ];

            expect(applyConditions(cardState, flight, conditions)).toBe(false);
        });

        it('handles single condition', () => {
            const flight = createMockFlight({ altitude: 35000 });
            const cardState: PartialCardState = { flights: [flight] };
            const condition: Condition = { field: 'altitude', comparator: 'gt', value: 30000 };

            expect(applyConditions(cardState, flight, condition)).toBe(true);
        });
    });

    describe('applyCondition', () => {
        describe('eq comparator', () => {
            it('returns true when values are equal', () => {
                const flight = createMockFlight({ callsign: 'TEST123' });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'callsign', comparator: 'eq', value: 'TEST123' };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('returns false when values are not equal', () => {
                const flight = createMockFlight({ callsign: 'TEST123' });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'callsign', comparator: 'eq', value: 'OTHER456' };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });
        });

        describe('lt comparator', () => {
            it('returns true when field is less than value', () => {
                const flight = createMockFlight({ altitude: 25000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'altitude', comparator: 'lt', value: 30000 };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('returns false when field is equal to value', () => {
                const flight = createMockFlight({ altitude: 30000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'altitude', comparator: 'lt', value: 30000 };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });
        });

        describe('lte comparator', () => {
            it('returns true when field is less than or equal to value', () => {
                const flight = createMockFlight({ altitude: 30000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'altitude', comparator: 'lte', value: 30000 };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });
        });

        describe('gt comparator', () => {
            it('returns true when field is greater than value', () => {
                const flight = createMockFlight({ altitude: 35000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'altitude', comparator: 'gt', value: 30000 };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('returns false when field is equal to value', () => {
                const flight = createMockFlight({ altitude: 30000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'altitude', comparator: 'gt', value: 30000 };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });
        });

        describe('gte comparator', () => {
            it('returns true when field is greater than or equal to value', () => {
                const flight = createMockFlight({ altitude: 30000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'altitude', comparator: 'gte', value: 30000 };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });
        });

        describe('oneOf comparator', () => {
            it('returns true when field value is in array', () => {
                const flight = createMockFlight({ airline_iata: 'UA' });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'airline_iata', comparator: 'oneOf', value: ['UA', 'AA', 'DL'] };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('returns false when field value is not in array', () => {
                const flight = createMockFlight({ airline_iata: 'BA' });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'airline_iata', comparator: 'oneOf', value: ['UA', 'AA', 'DL'] };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });

            it('handles comma-separated string value', () => {
                const flight = createMockFlight({ airline_iata: 'UA' });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'airline_iata', comparator: 'oneOf', value: 'UA, AA, DL' };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('handles non-array, non-string value', () => {
                const flight = createMockFlight({ airline_iata: 'UA' });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'airline_iata', comparator: 'oneOf', value: 123 };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });
        });

        describe('containsOneOf comparator', () => {
            it('returns true when field contains one of the values', () => {
                const flight = createMockFlight({ callsign: 'UAL1234' });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'callsign', comparator: 'containsOneOf', value: ['UAL', 'AAL'] };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('returns false when field does not contain any values', () => {
                const flight = createMockFlight({ callsign: 'BAW456' });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'callsign', comparator: 'containsOneOf', value: ['UAL', 'AAL'] };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });

            it('handles comma-separated string value', () => {
                const flight = createMockFlight({ callsign: 'UAL1234' });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'callsign', comparator: 'containsOneOf', value: 'UAL, AAL' };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('returns false when comparand is falsy', () => {
                const flight = createMockFlight({ callsign: undefined });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'callsign', comparator: 'containsOneOf', value: ['UAL'] };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });
        });

        describe('default comparator', () => {
            it('returns false for unknown comparator', () => {
                const flight = createMockFlight({ altitude: 35000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'altitude', comparator: 'unknown', value: 30000 };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });
        });

        describe('AND condition type', () => {
            it('returns true when all nested conditions are true', () => {
                const flight = createMockFlight({ altitude: 35000, ground_speed: 450 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = {
                    type: 'AND' as const,
                    conditions: [
                        { field: 'altitude', comparator: 'gt' as const, value: 30000 },
                        { field: 'ground_speed', comparator: 'gt' as const, value: 400 }
                    ]
                };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('returns false when any nested condition is false', () => {
                const flight = createMockFlight({ altitude: 35000, ground_speed: 350 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = {
                    type: 'AND' as const,
                    conditions: [
                        { field: 'altitude', comparator: 'gt' as const, value: 30000 },
                        { field: 'ground_speed', comparator: 'gt' as const, value: 400 }
                    ]
                };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });
        });

        describe('OR condition type', () => {
            it('returns true when at least one nested condition is true', () => {
                const flight = createMockFlight({ altitude: 35000, ground_speed: 350 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = {
                    type: 'OR' as const,
                    conditions: [
                        { field: 'altitude', comparator: 'gt' as const, value: 30000 },
                        { field: 'ground_speed', comparator: 'gt' as const, value: 400 }
                    ]
                };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('returns false when all nested conditions are false', () => {
                const flight = createMockFlight({ altitude: 25000, ground_speed: 350 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = {
                    type: 'OR' as const,
                    conditions: [
                        { field: 'altitude', comparator: 'gt' as const, value: 30000 },
                        { field: 'ground_speed', comparator: 'gt' as const, value: 400 }
                    ]
                };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });
        });

        describe('NOT condition type', () => {
            it('returns true when nested condition is false', () => {
                const flight = createMockFlight({ altitude: 25000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = {
                    type: 'NOT' as const,
                    condition: { field: 'altitude', comparator: 'gt' as const, value: 30000 }
                };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('returns false when nested condition is true', () => {
                const flight = createMockFlight({ altitude: 35000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = {
                    type: 'NOT' as const,
                    condition: { field: 'altitude', comparator: 'gt' as const, value: 30000 }
                };

                expect(applyCondition(cardState, flight, condition)).toBe(false);
            });
        });

        describe('defined placeholder', () => {
            it('uses defined value for comparison', () => {
                const flight = createMockFlight({ altitude: 35000 });
                const cardState: PartialCardState = {
                    flights: [flight],
                    defines: { minAltitude: 30000 }
                };
                const condition = { field: 'altitude', comparator: 'gt', value: '${minAltitude}' };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('uses defined field for comparand', () => {
                const flight = createMockFlight({});
                const cardState: PartialCardState = {
                    flights: [flight],
                    defines: { showApproaching: true }
                };
                const condition = { defined: 'showApproaching', comparator: 'eq', value: true };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });

            it('uses defaultValue when defined is not found', () => {
                const flight = createMockFlight({});
                const cardState: PartialCardState = {
                    flights: [flight],
                    defines: {}
                };
                const condition = { defined: 'missingKey', comparator: 'eq', value: true, defaultValue: true };

                expect(applyCondition(cardState, flight, condition)).toBe(true);
            });
        });

        describe('debugIf', () => {
            it('logs when debugIf matches result', () => {
                const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
                const flight = createMockFlight({ altitude: 35000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'altitude', comparator: 'gt', value: 30000, debugIf: true };

                applyCondition(cardState, flight, condition);

                expect(consoleSpy).toHaveBeenCalled();
                consoleSpy.mockRestore();
            });

            it('does not log when debugIf does not match result', () => {
                const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
                const flight = createMockFlight({ altitude: 35000 });
                const cardState: PartialCardState = { flights: [flight] };
                const condition = { field: 'altitude', comparator: 'gt', value: 30000, debugIf: false };

                applyCondition(cardState, flight, condition);

                expect(consoleSpy).not.toHaveBeenCalled();
                consoleSpy.mockRestore();
            });
        });
    });
});
