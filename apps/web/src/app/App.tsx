// The application shell, assembled from the scaffold glue: providers wrap everything (first entry = outermost) and the router
// entries become routes. Modules register in src/app/providers.tsx and src/app/router.tsx, never here.
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { providers as glueProviders } from './providers';
import { router as glueRoutes } from './router';

export interface ProviderEntry { id: string; component: React.ComponentType<{ children?: React.ReactNode }> }
export interface RouteEntry { id: string; path: string; element: React.ReactNode }

export class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(error); }                    // details go to the console, never to the page
  render() { return this.state.failed ? <p role="alert">Something went wrong. Reload the page to try again.</p> : this.props.children; }
}

export interface AppProps {
  providers?: ProviderEntry[];
  routes?: RouteEntry[];
  Router?: React.ComponentType<{ children?: React.ReactNode }>;
}

export function App({ providers = glueProviders as ProviderEntry[], routes = glueRoutes as unknown as RouteEntry[], Router = BrowserRouter }: AppProps) {
  const content = (
    <Router>
      <Routes>
        {routes.map((r) => <Route key={r.id} path={r.path} element={r.element} />)}
        <Route path="*" element={<p>Page not found</p>} />
      </Routes>
    </Router>
  );
  return <ErrorBoundary>{providers.reduceRight((inner, p) => <p.component>{inner}</p.component>, content)}</ErrorBoundary>;
}
