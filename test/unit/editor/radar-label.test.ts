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
});
