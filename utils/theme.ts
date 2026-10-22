/** Best-effort dark theme detection (Home Assistant parent theme, else OS preference). */
export function isDarkTheme(): boolean {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    let haDark = false;
    try {
        haDark = !!(window.parent && window.parent.document && window.parent.document.body.classList.contains('dark'));
    } catch (_e) {
        // Cross-origin access may fail, ignore
    }
    return haDark || prefersDark;
}

/**
 * Resolves an optional themed dual value of the form "light|dark".
 * The first part is used with light themes, the second with dark themes
 * (see isDarkTheme). Plain values without a pipe are returned unchanged.
 * An empty part falls back to the other part.
 */
export function resolveThemedValue(value: string): string {
    if (!value.includes('|')) return value;
    const separatorIndex = value.indexOf('|');
    const light = value.slice(0, separatorIndex).trim();
    const dark = value.slice(separatorIndex + 1).trim();
    return (isDarkTheme() ? dark : light) || light || dark;
}
