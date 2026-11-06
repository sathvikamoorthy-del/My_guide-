/** @jest-environment jsdom */
import React from 'react';
import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderApp } from '../../files/src/testing/render';
const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const Wrap = (id) => ({ children }) => <div data-testid={id}>{children}</div>;
describe('renderApp contract', () => {
    it('renders inside a router at the given route', () => {
        renderApp(<Routes><Route path="/a/:id" element={<Where />}/></Routes>, { route: '/a/7', providers: [] });
        expect(screen.getByTestId('where').textContent).toBe('/a/7');
    });
    it('wraps the component in the providers, first entry outermost, and the router is inside them', () => {
        renderApp(<Where />, { providers: [{ id: 'outer', component: Wrap('outer') }, { id: 'inner', component: Wrap('inner') }] });
        expect(screen.getByTestId('outer').contains(screen.getByTestId('inner'))).toBe(true);
        expect(screen.getByTestId('inner').contains(screen.getByTestId('where'))).toBe(true);
    });
    it('defaults to the scaffold glue providers and the root route', () => {
        renderApp(<Where />);
        expect(screen.getByTestId('where').textContent).toBe('/');
    });
});
