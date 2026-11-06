// Session state for the app: loads the stored token, signs in against the API, signs out (also when the API answers 401).
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient, resolveBaseUrl, type ApiClient } from '../api/client';
import type { AuthStatus } from './authGate';
import { createTokenStore, type TokenStore } from './tokenStore';

// Adaptation point: the sign-in route of the API and the shape of its answer.
export const LOGIN_PATH = '/api/auth/login';

export interface AuthValue {
  status: AuthStatus;
  api: ApiClient;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

/** Host part of Expo's hostUri ("192.168.1.5:8081" -> "192.168.1.5"), the machine serving the app in development. */
export const devHostOf = (hostUri?: string | null): string | undefined => hostUri?.split(':')[0] || undefined;

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

export function AuthProvider({ children, tokenStore, baseUrl }: { children?: React.ReactNode; tokenStore?: TokenStore; baseUrl?: string }) {
  const store = useMemo(() => tokenStore ?? createTokenStore(), [tokenStore]);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const token = useRef<string | null>(null);

  const signOut = useCallback(async () => {
    token.current = null;
    await store.clear();
    setStatus('signedOut');
  }, [store]);

  const api = useMemo(
    () => createApiClient({
      baseUrl: baseUrl ?? resolveBaseUrl(process.env.EXPO_PUBLIC_API_URL, (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl, undefined, devHostOf(Constants.expoConfig?.hostUri)),
      getToken: () => token.current,
      onUnauthorized: () => { if (token.current) void signOut(); },   // a 401 while signed out (wrong password) is not a session ending
    }),
    [baseUrl, signOut],
  );

  useEffect(() => {
    let live = true;
    // a sign-in that finished before the stored token was read wins
    store.get().then(
      (t) => { if (!live || token.current) return; token.current = t; setStatus(t ? 'signedIn' : 'signedOut'); },
      () => { if (live && !token.current) setStatus('signedOut'); },
    );
    return () => { live = false; };
  }, [store]);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ token: string }>(LOGIN_PATH, { email, password });
    if (!r?.token) throw new Error('The server did not return a token');
    token.current = r.token;
    await store.set(r.token);
    setStatus('signedIn');
  }, [api, store]);

  const value = useMemo(() => ({ status, api, signIn, signOut }), [status, api, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
