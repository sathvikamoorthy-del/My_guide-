// Fit test: depends on the app's tsconfig; adapt when injected.
import fs from 'fs';
import path from 'path';

it('the app has a tsconfig.json for the build script to use', () => {
  expect(fs.existsSync(path.join(__dirname, '../../../../tsconfig.json'))).toBe(true);
});
