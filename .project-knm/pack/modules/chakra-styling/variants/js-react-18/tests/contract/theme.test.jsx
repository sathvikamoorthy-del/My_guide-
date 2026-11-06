/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { useTheme } from '@chakra-ui/react';
import { ChakraAppProvider, buildTheme } from '../../files/src/styling/ChakraAppProvider';
import { chakraTokens } from '../../files/src/styling/tokens';
beforeAll(() => {
    if (!window.matchMedia)
        window.matchMedia = (q) => ({ matches: false, media: q, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { }, dispatchEvent: () => false });
});
const Probe = () => { const t = useTheme(); return <p data-testid="probe">{t.colors.brand?.[500] ?? 'no-brand'}|{t.fonts.body}|{t.colors.accent?.[500] ?? 'no-accent'}</p>; };
describe('styling contract', () => {
    it('the tokens define a brand scale and fonts', () => {
        expect(Object.keys(chakraTokens.colors.brand)).toHaveLength(10);
        expect(chakraTokens.config.initialColorMode).toBe('light');
    });
    it('buildTheme merges token sets in order (later wins) on top of the default theme', () => {
        const theme = buildTheme([{ id: 'a', tokens: { colors: { brand: { 500: '#111111' }, accent: { 500: '#222222' } } } }, { id: 'b', tokens: { colors: { brand: { 500: '#333333' } } } }]);
        expect(theme.colors.brand[500]).toBe('#333333');
        expect(theme.colors.accent[500]).toBe('#222222');
        expect(theme.colors.gray[500]).toBeTruthy(); // Chakra's own scales are still there
    });
    it('no entries gives the default theme', () => {
        expect(buildTheme([]).colors.blue[500]).toBeTruthy();
    });
    it('the provider renders its children inside the merged theme', () => {
        render(<ChakraAppProvider entries={[{ id: 'x', tokens: chakraTokens }]}><Probe /></ChakraAppProvider>);
        expect(screen.getByTestId('probe').textContent).toBe('#2d79ff|system-ui, sans-serif|no-accent');
    });
});
