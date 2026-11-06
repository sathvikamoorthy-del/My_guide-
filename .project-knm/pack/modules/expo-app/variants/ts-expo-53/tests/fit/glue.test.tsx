// Fit test: depends on the scaffold's glue files; adapt when injected.
import { providers } from '../../files/src/app/providers';
import { config } from '../../files/src/app/config';

it('the glue files export arrays the root layout can consume', () => {
  expect(Array.isArray(providers)).toBe(true);
  expect(Array.isArray(config)).toBe(true);
});

it('the auth provider is registered in the providers glue', () => {
  expect(providers.some((p: { id: string }) => p.id === 'expo-app')).toBe(true);
});
