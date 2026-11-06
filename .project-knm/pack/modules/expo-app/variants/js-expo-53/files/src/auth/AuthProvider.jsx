// Session state for the app: loads the stored token, signs in against the API, signs out (also when the API answers 401).
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient, resolveBaseUrl } from '../api/client';
import { createTokenStore } from './tokenStore';
// Adaptation point: the sign-in route of the API and the shape of its answer.
export const LOGIN_PATH = '/api/auth/login';
/** Host part of Expo's hostUri ("192.168.1.5:8081" -> "192.168.1.5"), the machine serving the app in development. */
export const devHostOf = (hostUri) => hostUri?.split(':')[0] || undefined;
const AuthContext = createContext(null);
export function useAuth() {
    const v = useContext(AuthContext);
    if (!v)
        throw new Error('useAuth must be used inside <AuthProvider>');
    return v;
}
export function AuthProvider({ children, tokenStore, baseUrl }) {
    const store = useMemo(() => tokenStore ?? createTokenStore(), [tokenStore]);
    const [status, setStatus] = useState('loading');
    const token = useRef(null);
    const signOut = useCallback(async () => {
        token.current = null;
        await store.clear();
        setStatus('signedOut');
    }, [store]);
    const api = useMemo(() => createApiClient({
        baseUrl: baseUrl ?? resolveBaseUrl(process.env.EXPO_PUBLIC_API_URL, Constants.expoConfig?.extra?.apiUrl, undefined, devHostOf(Constants.expoConfig?.hostUri)),
        getToken: () => token.current,
        onUnauthorized: () => { if (token.current)
            void signOut(); }, // a 401 while signed out (wrong password) is not a session ending
    }), [baseUrl, signOut]);
    useEffect(() => {
        let live = true;
        // a sign-in that finished before the stored token was read wins
        store.get().then((t) => { if (!live || token.current)
            return; token.current = t; setStatus(t ? 'signedIn' : 'signedOut'); }, () => { if (live && !token.current)
            setStatus('signedOut'); });
        return () => { live = false; };
    }, [store]);
    const signIn = useCallback(async (email, password) => {
        const r = await api.post(LOGIN_PATH, { email, password });
        if (!r?.token)
            throw new Error('The server did not return a token');
        token.current = r.token;
        await store.set(r.token);
        setStatus('signedIn');
    }, [api, store]);
    const value = useMemo(() => ({ status, api, signIn, signOut }), [status, api, signIn, signOut]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
