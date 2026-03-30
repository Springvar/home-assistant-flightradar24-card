import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compileTemplate, parseTemplate, resolvePlaceholders } from '../../../utils/template';
import { createMockFlight } from '../../fixtures/flights';

describe('template', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleDebugSpy.mockRestore();
    });

    describe('compileTemplate', () => {
        it('returns template string for simple template', () => {
            const templates = { greeting: 'Hello World' };
            expect(compileTemplate(templates, 'greeting')).toBe('Hello World');
        });

        it('caches compiled templates', () => {
            const templates: Record<string, string> = { greeting: 'Hello World' };
            compileTemplate(templates, 'greeting');

            expect(templates['compiled_greeting']).toBe('Hello World');
            expect(compileTemplate(templates, 'greeting')).toBe('Hello World');
        });

        it('returns empty string for missing template', () => {
            const templates = {};
            expect(compileTemplate(templates, 'missing')).toBe('');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Missing template reference: missing');
        });

        it('detects circular dependencies', () => {
            const templates = {
                a: 'tpl.b',
                b: 'tpl.a'
            };
            compileTemplate(templates, 'a');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('compiles nested template references', () => {
            const templates = {
                outer: 'Start tpl.inner End',
                inner: 'INNER'
            };
            const result = compileTemplate(templates, 'outer');
            expect(result).toContain('INNER');
        });

        it('handles multiple template references', () => {
            const templates = {
                main: 'tpl.first and tpl.second',
                first: 'FIRST',
                second: 'SECOND'
            };
            const result = compileTemplate(templates, 'main');
            expect(result).toContain('FIRST');
            expect(result).toContain('SECOND');
        });

        it('uses default empty object for templates', () => {
            expect(compileTemplate(undefined, 'test')).toBe('');
        });
    });

    describe('parseTemplate', () => {
        it('parses simple template with flight data', () => {
            const cardState = {
                templates: { simple: '${flight.callsign}' }
            };
            const flight = createMockFlight({ callsign: 'TEST123' });

            const result = parseTemplate(cardState, 'simple', flight);
            expect(result).toBe('TEST123');
        });

        it('parses template with flightsContext', () => {
            const cardState = {
                templates: { status: 'Showing ${flights.shown} of ${flights.total}' },
                flightsContext: { shown: 5, total: 10 }
            };

            const result = parseTemplate(cardState, 'status', null);
            expect(result).toBe('Showing 5 of 10');
        });

        it('parses template with units', () => {
            const cardState = {
                templates: { unit: 'Distance unit: ${units.distance}' },
                units: { distance: 'km' as const, altitude: 'ft' as const, speed: 'kts' as const }
            };

            const result = parseTemplate(cardState, 'unit', null);
            expect(result).toBe('Distance unit: km');
        });

        it('parses template with radar_range', () => {
            const cardState = {
                templates: { range: 'Range: ${radar_range}' },
                radar: { range: 35 }
            };

            const result = parseTemplate(cardState, 'range', null);
            expect(result).toBe('Range: 35');
        });

        it('rounds radar_range to integer', () => {
            const cardState = {
                templates: { range: 'Range: ${radar_range}' },
                radar: { range: 35.7 }
            };

            const result = parseTemplate(cardState, 'range', null);
            expect(result).toBe('Range: 36');
        });

        it('uses joinList function', () => {
            const cardState = {
                templates: { joined: '${joinList(", ")("a", "b", "c")}' }
            };
            const joinList = (sep: string) => (...els: (string | undefined)[]) => els.filter(Boolean).join(sep);

            const result = parseTemplate(cardState, 'joined', null, joinList);
            expect(result).toBe('a, b, c');
        });

        it('returns empty string for undefined result', () => {
            const cardState = {
                templates: { undef: '${undefined}' }
            };

            const result = parseTemplate(cardState, 'undef', null);
            expect(result).toBe('');
        });

        it('handles template compilation errors gracefully', () => {
            const cardState = {
                templates: { bad: '${throw new Error()}' }
            };

            const result = parseTemplate(cardState, 'bad', null);
            expect(result).toBe('');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('uses default values when cardState is empty', () => {
            const result = parseTemplate({}, 'missing', null);
            expect(result).toBe('');
        });

        it('uses default radar range of 35', () => {
            const cardState = {
                templates: { range: '${radar_range}' }
            };

            const result = parseTemplate(cardState, 'range', null);
            expect(result).toBe('35');
        });
    });

    describe('resolvePlaceholders', () => {
        it('returns non-placeholder values unchanged', () => {
            expect(resolvePlaceholders({}, 'plain string')).toBe('plain string');
            expect(resolvePlaceholders({}, 123)).toBe(123);
            expect(resolvePlaceholders({}, null)).toBe(null);
            expect(resolvePlaceholders({}, undefined)).toBe(undefined);
        });

        it('resolves selectedFlights placeholder', () => {
            const cardState = {
                selectedFlights: ['flight1', 'flight2']
            };
            const result = resolvePlaceholders(cardState, '${selectedFlights}');
            expect(result).toEqual(['flight1', 'flight2']);
        });

        it('resolves radar_range placeholder', () => {
            const cardState = {
                radar: { range: 50 }
            };
            const result = resolvePlaceholders(cardState, '${radar_range}');
            expect(result).toBe(50);
        });

        it('calls renderDynamicOnRangeChangeSetter for radar_range', () => {
            const cardState = {
                radar: { range: 50 }
            };
            const setter = vi.fn();
            resolvePlaceholders(cardState, '${radar_range}', undefined, setter);
            expect(setter).toHaveBeenCalledWith(true);
        });

        it('resolves defines placeholder', () => {
            const cardState = {
                defines: { myValue: 42 }
            };
            const result = resolvePlaceholders(cardState, '${myValue}');
            expect(result).toBe(42);
        });

        it('resolves toggle default value', () => {
            const cardState = {
                config: {
                    toggles: {
                        showLabels: { label: 'Show Labels', default: true }
                    }
                }
            };
            const result = resolvePlaceholders(cardState, '${showLabels}');
            expect(result).toBe(true);
        });

        it('uses defaultValue when placeholder not found', () => {
            const cardState = {
                defines: {}
            };
            const result = resolvePlaceholders(cardState, '${unknown}', 'default');
            expect(result).toBe('default');
        });

        it('logs error for unresolved placeholder without default', () => {
            const cardState = {
                defines: {}
            };
            resolvePlaceholders(cardState, '${unknown}');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Unresolved placeholder: unknown');
        });

        it('returns value if not a placeholder string', () => {
            expect(resolvePlaceholders({}, 'not a ${placeholder')).toBe('not a ${placeholder');
            expect(resolvePlaceholders({}, '${incomplete')).toBe('${incomplete');
        });

        it('uses default empty arrays and objects', () => {
            const result = resolvePlaceholders({}, '${selectedFlights}');
            expect(result).toEqual([]);
        });

        it('uses default radar range', () => {
            const result = resolvePlaceholders({}, '${radar_range}');
            expect(result).toBe(35);
        });
    });
});
