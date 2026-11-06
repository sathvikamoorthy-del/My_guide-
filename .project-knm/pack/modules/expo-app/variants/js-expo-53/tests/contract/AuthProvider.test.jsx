import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { AuthProvider, LOGIN_PATH, devHostOf, useAuth } from '../../files/src/auth/AuthProvider';
import { createTokenStore } from '../../files/src/auth/tokenStore';
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
const memory = (initial = null) => {
    let v = initial;
    return createTokenStore({ getItemAsync: async () => v, setItemAsync: async (_k, t) => { v = t; }, deleteItemAsync: async () => { v = null; } });
};
let auth;
const Probe = () => { auth = useAuth(); return <Text testID="status">{auth.status}</Text>; };
const mount = (store = memory()) => render(<AuthProvider tokenStore={store} baseUrl="http://x"><Probe /></AuthProvider>);
const respond = (status, body) => { global.fetch = jest.fn(async () => ({ ok: status < 300, status, text: async () => JSON.stringify(body) })); };
describe('auth provider contract', () => {
    it('starts loading, then signed out without a stored token', async () => {
        mount();
        expect(screen.getByTestId('status').props.children).toBe('loading');
        await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedOut'));
    });
    it('is signed in when a token is stored', async () => {
        mount(memory('stored'));
        await waitFor(() => expect(screen.getByTestId('status').props.children).toBe('signedIn'));
    });
    it('signs in through the login route, keeps the token in the store and sends it on later calls', async () => {
        const store = memory();
        mount(store);
        await waitFor(() => expect(auth.status).toBe('signedOut'));
        respond(200, { token: 'jwt-1' });
        await act(async () => { await auth.signIn('a@b.c', 'pw'); });
        expect(global.fetch.mock.calls[0][0]).toBe(`http://x${LOGIN_PATH}`);
        expect(auth.status).toBe('signedIn');
        expect(await store.get()).toBe('jwt-1');
        respond(200, {});
        await auth.api.get('/api/me');
        expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-1');
    });
    it('a wrong password leaves the user signed out and stores nothing', async () => {
        const store = memory();
        mount(store);
        await waitFor(() => expect(auth.status).toBe('signedOut'));
        respond(401, { error: 'unauthorized' });
        await expect(act(async () => { await auth.signIn('a@b.c', 'bad'); })).rejects.toMatchObject({ status: 401 });
        expect(auth.status).toBe('signedOut');
        expect(await store.get()).toBeNull();
    });
    it('signs out when the API answers 401 on a later call', async () => {
        const store = memory('old');
        mount(store);
        await waitFor(() => expect(auth.status).toBe('signedIn'));
        respond(401, { error: 'unauthorized' });
        await act(async () => { await auth.api.get('/api/me').catch(() => undefined); });
        await waitFor(() => expect(auth.status).toBe('signedOut'));
        expect(await store.get()).toBeNull();
    });
    it('a wrong password (401 while signed out) does not sign out or clear anything', async () => {
        const store = memory();
        mount(store);
        await waitFor(() => expect(auth.status).toBe('signedOut'));
        respond(401, { error: 'bad credentials' });
        await act(async () => { await auth.signIn('a@b.c', 'bad').catch(() => undefined); });
        expect(auth.status).toBe('signedOut');
        respond(200, { token: 'jwt-2' });
        await act(async () => { await auth.signIn('a@b.c', 'good'); });
        expect(auth.status).toBe('signedIn');
    });
    it('a sign-in that finishes before the slow stored-token read is not undone by it', async () => {
        let release = () => undefined;
        const slow = createTokenStore({ getItemAsync: () => new Promise((r) => { release = r; }), setItemAsync: async () => undefined, deleteItemAsync: async () => undefined });
        mount(slow);
        respond(200, { token: 'jwt-3' });
        await act(async () => { await auth.signIn('a@b.c', 'pw'); });
        expect(auth.status).toBe('signedIn');
        await act(async () => { release(null); });
        expect(auth.status).toBe('signedIn');
    });
});
describe('dev host', () => {
    it('takes the host out of Expo hostUri', () => {
        expect(devHostOf('192.168.1.5:8081')).toBe('192.168.1.5');
        expect(devHostOf(undefined)).toBeUndefined();
        expect(devHostOf('')).toBeUndefined();
    });
});
