import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { providers as glueProviders } from '../app/providers';
// Renders a component the way the app does: inside the scaffold's providers (first entry = outermost) and a router at `route`.
export function renderApp(ui, { route = '/', providers = glueProviders } = {}) {
    const tree = providers.reduceRight((inner, p) => <p.component>{inner}</p.component>, <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
    return render(tree);
}
