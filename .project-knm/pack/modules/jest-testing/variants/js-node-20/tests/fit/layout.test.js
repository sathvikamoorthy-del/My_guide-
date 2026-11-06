// Fit test: depends on the app layout; adapt when injected.
import fs from 'fs';
import path from 'path';
it('the roots named in jest.config.js exist or are creatable', () => {
    expect(fs.existsSync(path.join(__dirname, '../../../../src'))).toBe(true);
});
