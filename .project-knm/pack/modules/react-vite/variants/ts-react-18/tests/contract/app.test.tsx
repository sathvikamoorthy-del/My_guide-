/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App, ErrorBoundary } from '../../files/src/app/App';

const Wrap = (id: string) => ({ children }: { children?: React.ReactNode }) => <div data-testid={id}>{children}</div>;
const at = (path: string) => ({ children }: { children?: React.ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;

describe('app shell contract', () => {
  it('renders the route for the URL', () => {
    render(<App providers={[]} routes={[{ id: 'home', path: '/', element: <h1>Home</h1> }, { id: 'about', path: '/about', element: <h1>About</h1> }]} Router={at('/about')} />);
    expect(screen.getByRole('heading').textContent).toBe('About');
  });

  it('an unknown URL shows the not-found page', () => {
    render(<App providers={[]} routes={[{ id: 'home', path: '/', element: <h1>Home</h1> }]} Router={at('/nope')} />);
    expect(screen.getByText('Page not found')).toBeTruthy();
  });

  it('providers nest in order: the first entry is the outermost', () => {
    const { container } = render(<App providers={[{ id: 'outer', component: Wrap('outer') }, { id: 'inner', component: Wrap('inner') }]} routes={[{ id: 'home', path: '/', element: <span data-testid="page" /> }]} Router={at('/')} />);
    const outer = screen.getByTestId('outer'); const inner = screen.getByTestId('inner');
    expect(outer.contains(inner)).toBe(true);
    expect(inner.contains(screen.getByTestId('page'))).toBe(true);
    expect(container.firstChild).toBe(outer);
  });

  it('works with the scaffold glue as it is (no modules registered yet: the not-found page)', () => {
    render(<App Router={at('/')} />);
    expect(screen.getByText('Page not found')).toBeTruthy();
  });

  it('a crashing page shows a generic message, never the error, and the shell survives', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const Boom = () => { throw new Error('secret internals'); };
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong');
    expect(screen.queryByText(/secret internals/)).toBeNull();
    spy.mockRestore();
  });
});
