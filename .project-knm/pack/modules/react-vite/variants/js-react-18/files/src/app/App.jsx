// The application shell, assembled from the scaffold glue: providers wrap everything (first entry = outermost) and the router
// entries become routes. Modules register in src/app/providers.jsx and src/app/router.jsx, never here.
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { providers as glueProviders } from './providers';
import { router as glueRoutes } from './router';
export class ErrorBoundary extends React.Component {
    constructor() {
        super(...arguments);
        this.state = { failed: false };
    }
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error) { console.error(error); } // details go to the console, never to the page
    render() { return this.state.failed ? <p role="alert">Something went wrong. Reload the page to try again.</p> : this.props.children; }
}
export function App({ providers = glueProviders, routes = glueRoutes, Router = BrowserRouter }) {
    const content = (<Router>
      <Routes>
        {routes.map((r) => <Route key={r.id} path={r.path} element={r.element}/>)}
        <Route path="*" element={<p>Page not found</p>}/>
      </Routes>
    </Router>);
    return <ErrorBoundary>{providers.reduceRight((inner, p) => <p.component>{inner}</p.component>, content)}</ErrorBoundary>;
}
