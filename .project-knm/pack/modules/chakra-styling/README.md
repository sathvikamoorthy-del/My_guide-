# chakra-styling

Styling module (STORY-053b). `ChakraAppProvider` (providers glue, outermost) wraps the app in Chakra UI with a theme built from every token set registered in the theme glue (`{ id, tokens }`, merged in order, later wins). `tokens.ts` is the starter set (brand scale, fonts, light color mode); other modules can register more tokens in the theme glue. Requires a UI framework (react-vite).
