import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
// Mounts the app into #root. Exported so tests (and other entry points) can mount into another element.
export function mount(el = document.getElementById('root')) {
    if (!el)
        return null;
    const root = createRoot(el);
    root.render(<React.StrictMode><App /></React.StrictMode>);
    return root;
}
mount();
