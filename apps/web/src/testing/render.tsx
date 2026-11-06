import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { providers as glueProviders } from '../app/providers';

export interface RenderOptions { route?: string; providers?: { id: string; component: React.ComponentType<{ children?: React.ReactNode }> }[] }

// Renders a component the way the app does: inside the scaffold's providers (first entry = outermost) and a router at `route`.
export function renderApp(ui: React.ReactElement, { route = '/', providers = glueProviders as unknown as NonNullable<RenderOptions['providers']> }: RenderOptions = {}) {
  const tree = providers.reduceRight((inner, p) => <p.component>{inner}</p.component>, <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
  return render(tree);
}
