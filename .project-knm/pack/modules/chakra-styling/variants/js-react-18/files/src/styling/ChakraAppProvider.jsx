import React from 'react';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { theme as glueTheme } from '../app/theme';
// Merges every token set registered in the theme glue, in order, onto Chakra's default theme.
export function buildTheme(entries) {
    return extendTheme(...entries.map((e) => e.tokens));
}
// Registered in the providers glue (outermost).
export function ChakraAppProvider({ children, entries = glueTheme }) {
    const theme = React.useMemo(() => buildTheme(entries), [entries]);
    return <ChakraProvider theme={theme}>{children}</ChakraProvider>;
}
