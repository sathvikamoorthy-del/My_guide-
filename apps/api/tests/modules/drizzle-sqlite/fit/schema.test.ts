// Fit test: the app replaces the starter schema; adapt when injected.
import { settings } from '../../../../src/db/schema';

it('the starter schema has the settings table', () => {
  expect(Object.keys(settings)).toEqual(expect.arrayContaining(['key', 'value', 'updatedAt']));
});
