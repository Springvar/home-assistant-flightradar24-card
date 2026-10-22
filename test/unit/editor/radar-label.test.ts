import { describe, it, expect } from 'vitest';
import { Flightradar24CardEditor } from '../../../flightradar24-card-editor';
import type { CardConfig } from '../../../types/config';

function renderEditor(config: CardConfig) {
    const editor = new Flightradar24CardEditor();
    editor.hass = { states: {} };
    document.body.appendChild(editor);
    editor.setConfig(config);
    return { editor, root: editor.shadowRoot! };
}

describe('editor radar marker & label settings', () => {
    it('renders the label settings under Aircraft Marker & Label', () => {
        const { root } = renderEditor({ radar: {} });
        expect(root.textContent).toContain('Aircraft Marker & Label');
        expect(root.getElementById('radar-callsign-label-color')).not.toBeNull();
        expect(root.getElementById('radar-callsign-label-font-size')).not.toBeNull();
    });

    it('shows the light part of a dual label color in the color picker', () => {
        const { root } = renderEditor({ radar: { 'callsign-label-color': '#eeeeee|#111111' } });
        const input = root.getElementById('radar-callsign-label-color') as HTMLInputElement;
        expect(input.value).toBe('#eeeeee');
    });

    it('shows the configured label font size, including dual values', () => {
        const { root } = renderEditor({ radar: { 'callsign-label-font-size': '10px|12px' } });
        const input = root.getElementById('radar-callsign-label-font-size') as HTMLInputElement;
        expect(input.value).toBe('10px|12px');
    });

    it('writes the label font size to config on input, and removes it when cleared', () => {
        const { editor, root } = renderEditor({ radar: {} });
        const input = root.getElementById('radar-callsign-label-font-size') as HTMLInputElement;

        const configs: CardConfig[] = [];
        editor.addEventListener('config-changed', (e) => {
            configs.push((e as CustomEvent<{ config: CardConfig }>).detail.config);
        });

        input.value = '12px';
        input.dispatchEvent(new Event('input'));
        expect(configs[configs.length - 1]?.radar?.['callsign-label-font-size']).toBe('12px');

        input.value = '  ';
        input.dispatchEvent(new Event('input'));
        expect(configs[configs.length - 1]?.radar?.['callsign-label-font-size']).toBeUndefined();
    });

    it('preserves the dark part of a dual label color when picking a new light color', () => {
        const { editor, root } = renderEditor({ radar: { 'callsign-label-color': '#eeeeee|#111111' } });
        const input = root.getElementById('radar-callsign-label-color') as HTMLInputElement;

        const configs: CardConfig[] = [];
        editor.addEventListener('config-changed', (e) => {
            configs.push((e as CustomEvent<{ config: CardConfig }>).detail.config);
        });

        input.value = '#222222';
        input.dispatchEvent(new Event('input'));
        expect(configs[configs.length - 1]?.radar?.['callsign-label-color']).toBe('#222222|#111111');
    });

    it('renders a configurable label text color defaulting to the theme text color', () => {
        const { root } = renderEditor({ radar: {} });
        const input = root.getElementById('radar-callsign-label-text-color') as HTMLInputElement;
        expect(input).not.toBeNull();
        expect(input.value).toBe('#000000');
    });

    it('shows light and dark pickers for a dual label text color', () => {
        const { root } = renderEditor({ radar: { 'callsign-label-text-color': '#111111|#f5f5f5' } });
        const light = root.getElementById('radar-callsign-label-text-color') as HTMLInputElement;
        const dark = root.getElementById('radar-callsign-label-text-color-dark') as HTMLInputElement;
        const toggle = root.getElementById('radar-callsign-label-text-color-dark-enabled') as HTMLInputElement;

        expect(light.value).toBe('#111111');
        expect(dark.value).toBe('#f5f5f5');
        expect(toggle.checked).toBe(true);
        expect(dark.disabled).toBe(false);
    });

    it('disables the dark picker when no dark value is configured', () => {
        const { root } = renderEditor({ radar: { 'callsign-label-text-color': '#111111' } });
        const dark = root.getElementById('radar-callsign-label-text-color-dark') as HTMLInputElement;
        const toggle = root.getElementById('radar-callsign-label-text-color-dark-enabled') as HTMLInputElement;

        expect(toggle.checked).toBe(false);
        expect(dark.disabled).toBe(true);
        expect(dark.value).toBe('#111111');
    });

    it('writes light|dark values from the two pickers and drops the dark part when unchecked', () => {
        const { editor, root } = renderEditor({ radar: { 'callsign-label-text-color': '#111111' } });
        const light = root.getElementById('radar-callsign-label-text-color') as HTMLInputElement;
        const dark = root.getElementById('radar-callsign-label-text-color-dark') as HTMLInputElement;
        const toggle = root.getElementById('radar-callsign-label-text-color-dark-enabled') as HTMLInputElement;

        const configs: CardConfig[] = [];
        editor.addEventListener('config-changed', (e) => {
            configs.push((e as CustomEvent<{ config: CardConfig }>).detail.config);
        });
        const latest = () => configs[configs.length - 1]?.radar?.['callsign-label-text-color'];

        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
        expect(dark.disabled).toBe(false);
        expect(latest()).toBe('#111111|#111111');

        dark.value = '#eeeeee';
        dark.dispatchEvent(new Event('input'));
        expect(latest()).toBe('#111111|#eeeeee');

        light.value = '#000000';
        light.dispatchEvent(new Event('input'));
        expect(latest()).toBe('#000000|#eeeeee');

        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
        expect(dark.disabled).toBe(true);
        expect(latest()).toBe('#000000');
    });

    it('offers the dark picker on every radar color row', () => {
        const { root } = renderEditor({ radar: {} });
        for (const id of [
            'radar-background-color',
            'radar-aircraft-color',
            'radar-aircraft-selected-color',
            'radar-grid-color',
            'radar-local-features-color',
            'radar-callsign-label-color',
            'radar-custom-marker-overlay',
        ]) {
            expect(root.getElementById(id), id).not.toBeNull();
            expect(root.getElementById(`${id}-dark`), `${id} dark`).not.toBeNull();
            expect(root.getElementById(`${id}-dark-enabled`), `${id} toggle`).not.toBeNull();
        }
    });
});
