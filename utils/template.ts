import type { Flight } from '../types/flight';
import type { ToggleConfig } from '../types/config';
import type { CardState, PartialCardState } from '../types/cardState';

type JoinListFn = (separator: string) => (...elements: (string | undefined)[]) => string;
type RenderDynamicOnRangeChangeSetter = (value: boolean) => void;

/**
 * Recursively compiles a template string with possible sub-template references.
 */
export function compileTemplate(
    templates: Record<string, string> = {},
    templateId: string,
    trace: string[] = []
): string {
    if (trace.includes(templateId)) {
        console.error('Circular template dependencies detected. ' + trace.join(' -> ') + ' -> ' + templateId);
        return '';
    }
    if (templates['compiled_' + templateId]) {
        return templates['compiled_' + templateId];
    }
    let template = templates[templateId];
    if (template === undefined) {
        console.error('Missing template reference: ' + templateId);
        return '';
    }
    const tplRegex = /tpl\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let tplMatch;
    const compiledTemplates: Record<string, string> = {};
    while ((tplMatch = tplRegex.exec(template)) !== null) {
        const innerTemplateId = tplMatch[1];
        if (!compiledTemplates[innerTemplateId]) {
            compiledTemplates[innerTemplateId] = compileTemplate(templates, innerTemplateId, [...trace, templateId]);
        }
        template = template.replace(`tpl.${innerTemplateId}`, '(`' + compiledTemplates[innerTemplateId] + '`).replace(/^undefined$/, "")');
    }
    templates['compiled_' + templateId] = template;
    return template;
}

/**
 * Safely parses and interpolates a template string with provided context.
 * Accepts an optional joinList helper.
 */
export function parseTemplate(
    cardState: PartialCardState,
    templateId: string,
    flight: Flight | null,
    joinList?: JoinListFn
): string {
    const templates = cardState.templates || {};
    const flightsContext = cardState.flightsContext || {};
    const units = cardState.units || { distance: 'km', altitude: 'ft', speed: 'kts' };
    const radar = cardState.radar || { range: 35 };
    const compiledTemplate = compileTemplate(templates, templateId);
    try {
        const parsedTemplate = new Function(
            'flights',
            'flight',
            'tpl',
            'units',
            'radar_range',
            'joinList',
            `return \`${compiledTemplate.replace(/\${(.*?)}/g, (_, expr) => `\${${expr}}`)}\``
        )(flightsContext, flight, {}, units, Math.round(radar.range), joinList);
        return parsedTemplate !== 'undefined' ? parsedTemplate : '';
    } catch (e) {
        console.error('Error when rendering: ' + compiledTemplate, e);
        return '';
    }
}

/**
 * Substitute placeholders in a string with values from context objects.
 */
export function resolvePlaceholders(
    cardState: PartialCardState,
    value: unknown,
    defaultValue?: unknown,
    renderDynamicOnRangeChangeSetter?: RenderDynamicOnRangeChangeSetter
): unknown {
    const { defines = {}, config = {}, radar = { range: 35 }, selectedFlights = [] } = cardState;
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const key = value.slice(2, -1);
        if (key === 'selectedFlights') return selectedFlights;
        else if (key === 'radar_range') {
            if (renderDynamicOnRangeChangeSetter) renderDynamicOnRangeChangeSetter(true);
            return radar.range;
        } else if (key in defines) return defines[key];
        else if (config.toggles && key in config.toggles) return (config.toggles[key] as ToggleConfig).default;
        else if (defaultValue !== undefined) return defaultValue;
        else {
            console.error('Unresolved placeholder: ' + key);
            console.debug('Defines', defines);
        }
    }
    return value;
}

interface UrlContext {
    map_lat?: number;
    map_lon?: number;
    zoom?: number;
    radar_range?: number;
    click_lat?: number;
    click_lon?: number;
    flight?: Flight | null;
    entity?: { state?: string };
}

export function renderUrlPath(urlPath: string, ctx: UrlContext): string {
    if (!urlPath) return '';
    try {
        const fn = new Function(
            'map_lat', 'map_lon', 'zoom', 'radar_range',
            'click_lat', 'click_lon', 'flight', 'entity',
            'return `' + urlPath.replace(/\${(.*?)}/g, '${$1}') + '`'
        );
        const result = fn(
            ctx.map_lat, ctx.map_lon, ctx.zoom, ctx.radar_range,
            ctx.click_lat, ctx.click_lon, ctx.flight ?? null, ctx.entity ?? null
        );
        return result !== 'undefined' ? result : '';
    } catch (e) {
        console.error('Error rendering URL path:', urlPath, e);
        return urlPath;
    }
}
