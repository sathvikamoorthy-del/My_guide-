// Fit test: depends on where the app keeps audit records; adapt when injected.
import { createAuditTrail } from '../../../../src/audit/auditTrail';

it('an app-specific sink can be plugged in', async () => {
  const seen: string[] = [];
  const trail = createAuditTrail({ sink: { append: (e) => { seen.push(e.action); } } });
  await trail.record({ actor: 'u', action: 'a.b' });
  expect(seen).toEqual(['a.b']);
});
