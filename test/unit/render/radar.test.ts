import { describe, it, expect } from 'vitest';
import { renderRadar } from '../../../render/radar';
import { renderStyle } from '../../../render/style';
import { parseTemplate } from '../../../utils/template';
import { templateConfig } from '../../../config/templateConfig';
import { createMockCardState } from '../../fixtures/cardState';
import { createMockFlight } from '../../fixtures/flights';
import type { CardState } from '../../../types/cardState';
import type { RadarConfig } from '../../../types/config';

function renderRadarLabel(templates?: Record<string, string>): string {
    const planesContainer = document.createElement('div');
    const flight = createMockFlight({
        callsign: 'KLM1412',
        aircraft_registration: 'PH-BGA',
        aircraft_code: 'B738',
        distance_to_tracker: 10,
        heading_from_tracker: 90
    });
    const state = {
        ...createMockCardState({ flights: [flight], ...(templates !== undefined ? { templates } : {}) }),
        dom: { planesContainer }
    } as unknown as CardState;
    renderRadar(state);
    return planesContainer.querySelector('.callsign-label')?.innerHTML ?? '';
}

function renderCardStyle(radar: Partial<RadarConfig>): string {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const state = createMockCardState({ radar }) as unknown as CardState;
    renderStyle(state, shadowRoot);
    return shadowRoot.querySelector('style')?.textContent ?? '';
}

describe('renderRadar label', () => {
    it('renders the label from the radar_label template when configured', () => {
        const label = renderRadarLabel({
            radar_label: '${flight.callsign} · ${flight.aircraft_code}'
        });
        expect(label).toBe('KLM1412 · B738');
    });

    it('falls back to callsign when no templates are present in state', () => {
        expect(renderRadarLabel()).toBe('KLM1412');
    });

    it('falls back to registration when callsign is missing', () => {
        const label = renderRadarLabel({
            radar_label: '${flight.callsign ?? flight.aircraft_registration ?? "n/a"}'
        });
        expect(label).toBe('KLM1412');

        const planesContainer = document.createElement('div');
        const flight = createMockFlight({
            callsign: undefined,
            aircraft_registration: 'PH-BGA',
            distance_to_tracker: 10,
            heading_from_tracker: 90
        });
        const state = {
            ...createMockCardState({ flights: [flight], templates: { radar_label: templateConfig.radar_label } }),
            dom: { planesContainer }
        } as unknown as CardState;
        renderRadar(state);
        expect(planesContainer.querySelector('.callsign-label')?.textContent).toBe('PH-BGA');
    });

    it('default radar_label template preserves the legacy label behavior', () => {
        const templates = { ...templateConfig };
        const withCallsign = parseTemplate({ templates }, 'radar_label', createMockFlight({ callsign: 'ABC123' }));
        expect(withCallsign).toBe('ABC123');

        const registrationOnly = parseTemplate(
            { templates: { ...templateConfig } },
            'radar_label',
            createMockFlight({ aircraft_registration: 'LN001' })
        );
        expect(registrationOnly).toBe('LN001');

        const neither = parseTemplate({ templates: { ...templateConfig } }, 'radar_label', createMockFlight());
        expect(neither).toBe('n/a');
    });
});

describe('renderStyle callsign label font size', () => {
    it('defaults to 9px', () => {
        const style = renderCardStyle({});
        expect(style).toContain('--radar-callsign-label-font-size: 9px');
    });

    it('uses the configured font size', () => {
        const style = renderCardStyle({ 'callsign-label-font-size': '12px' });
        expect(style).toContain('--radar-callsign-label-font-size: 12px');
        expect(style).toContain('font-size: var(--radar-callsign-label-font-size)');
    });

    it('supports em/rem/pt units', () => {
        expect(renderCardStyle({ 'callsign-label-font-size': '0.9em' })).toContain(
            '--radar-callsign-label-font-size: 0.9em'
        );
        expect(renderCardStyle({ 'callsign-label-font-size': '11pt' })).toContain(
            '--radar-callsign-label-font-size: 11pt'
        );
    });

    it('falls back to 9px on invalid values', () => {
        expect(renderCardStyle({ 'callsign-label-font-size': 'banana' })).toContain(
            '--radar-callsign-label-font-size: 9px'
        );
        expect(renderCardStyle({ 'callsign-label-font-size': '12' })).toContain(
            '--radar-callsign-label-font-size: 9px'
        );
    });

    it('resolves light|dark dual color values per theme', () => {
        const light = 'rgba(255,255,255,0.8)';
        const dark = 'rgba(0,0,0,0.8)';
        expect(renderCardStyle({ 'callsign-label-color': `${light}|${dark}` })).toContain(
            `--radar-callsign-label-color: ${light}`
        );

        document.body.classList.add('dark');
        try {
            expect(renderCardStyle({ 'callsign-label-color': `${light}|${dark}` })).toContain(
                `--radar-callsign-label-color: ${dark}`
            );
        } finally {
            document.body.classList.remove('dark');
        }
    });

    it('resolves light|dark dual font size values per theme', () => {
        document.body.classList.add('dark');
        try {
            const style = renderCardStyle({ 'callsign-label-font-size': '10px|14px' });
            expect(style).toContain('--radar-callsign-label-font-size: 14px');
        } finally {
            document.body.classList.remove('dark');
        }
        expect(renderCardStyle({ 'callsign-label-font-size': '10px|14px' })).toContain(
            '--radar-callsign-label-font-size: 10px'
        );
    });
});
