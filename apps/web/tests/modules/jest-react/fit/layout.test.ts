/** @jest-environment node */
// Fit test: depends on the app layout; adapt when injected.
import fs from 'fs';
import path from 'path';

it('the app keeps its sources in src/ and its glue in src/app', () => {
  expect(fs.existsSync(path.join(__dirname, '../../../../src/app'))).toBe(true);
});
