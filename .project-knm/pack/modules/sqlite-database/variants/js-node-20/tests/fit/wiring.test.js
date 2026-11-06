// Fit test: depends on where the app keeps its database file; adapt when injected.
import { createDb } from '../../files/src/db/client';
it('the default URL is a file under ./data', () => {
    expect(require('../../files/src/db/client').DEFAULT_DATABASE_URL).toBe('file:./data/app.db');
    expect(typeof createDb).toBe('function');
});
