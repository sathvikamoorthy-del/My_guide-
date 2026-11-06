// The access token lives in the platform's secure storage (Keychain / Keystore) and nowhere else.
import * as SecureStore from 'expo-secure-store';

export interface SecureKeyValue {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export function createTokenStore(store: SecureKeyValue = SecureStore, key = 'knm.token') {
  return {
    get: () => store.getItemAsync(key),
    set: (token: string) => store.setItemAsync(key, token),
    clear: () => store.deleteItemAsync(key),
  };
}

export type TokenStore = ReturnType<typeof createTokenStore>;
