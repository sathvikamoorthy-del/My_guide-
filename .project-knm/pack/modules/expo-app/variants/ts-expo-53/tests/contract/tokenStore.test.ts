import { createTokenStore } from '../../files/src/auth/tokenStore';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

const fake = () => {
  const m = new Map<string, string>();
  return { m, getItemAsync: async (k: string) => m.get(k) ?? null, setItemAsync: async (k: string, v: string) => { m.set(k, v); }, deleteItemAsync: async (k: string) => { m.delete(k); } };
};

describe('token store contract', () => {
  it('stores, reads and clears the token under one key in the secure store', async () => {
    const s = fake();
    const t = createTokenStore(s, 'k');
    expect(await t.get()).toBeNull();
    await t.set('abc');
    expect([...s.m.entries()]).toEqual([['k', 'abc']]);
    expect(await t.get()).toBe('abc');
    await t.clear();
    expect(await t.get()).toBeNull();
  });
});
