// The access token lives in the platform's secure storage (Keychain / Keystore) and nowhere else.
import * as SecureStore from 'expo-secure-store';
export function createTokenStore(store = SecureStore, key = 'knm.token') {
    return {
        get: () => store.getItemAsync(key),
        set: (token) => store.setItemAsync(key, token),
        clear: () => store.deleteItemAsync(key),
    };
}
