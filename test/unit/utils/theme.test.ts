import { describe, it, expect, afterEach, vi } from 'vitest';
import { isDarkTheme, resolveThemedValue } from '../../../utils/theme';

describe('theme', () => {
    afterEach(() => {
        document.body.classList.remove('dark');
        vi.unstubAllGlobals();
    });

    describe('isDarkTheme', () => {
        it('detects the Home Assistant dark theme via the body class', () => {
            document.body.classList.add('dark');
            expect(isDarkTheme()).toBe(true);
        });

        it('falls back to the OS preference', () => {
            vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
            expect(isDarkTheme()).toBe(true);

            vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
            document.body.classList.remove('dark');
            expect(isDarkTheme()).toBe(false);
        });
    });

    describe('resolveThemedValue', () => {
        it('returns plain values unchanged', () => {
            expect(resolveThemedValue('#ff0000')).toBe('#ff0000');
            expect(resolveThemedValue('var(--accent-color)')).toBe('var(--accent-color)');
        });

        it('picks the light part on light themes', () => {
            expect(resolveThemedValue('#eeeeee|#111111')).toBe('#eeeeee');
        });

        it('picks the dark part on dark themes', () => {
            document.body.classList.add('dark');
            expect(resolveThemedValue('#eeeeee|#111111')).toBe('#111111');
        });

        it('trims both parts', () => {
            expect(resolveThemedValue(' #eeeeee | #111111 ')).toBe('#eeeeee');
            document.body.classList.add('dark');
            expect(resolveThemedValue(' #eeeeee | #111111 ')).toBe('#111111');
        });

        it('uses the light part for both themes when the dark part is empty', () => {
            expect(resolveThemedValue('#eeeeee|')).toBe('#eeeeee');
            document.body.classList.add('dark');
            expect(resolveThemedValue('#eeeeee|')).toBe('#eeeeee');
        });

        it('uses the dark part for both themes when the light part is empty', () => {
            expect(resolveThemedValue('|#111111')).toBe('#111111');
            document.body.classList.add('dark');
            expect(resolveThemedValue('|#111111')).toBe('#111111');
        });

        it('splits on the first pipe only', () => {
            expect(resolveThemedValue('a|b|c')).toBe('a');
            document.body.classList.add('dark');
            expect(resolveThemedValue('a|b|c')).toBe('b|c');
        });
    });
});
