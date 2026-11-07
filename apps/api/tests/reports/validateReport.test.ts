import { MAX_DESCRIPTION, PROBLEM_TYPES, validateReport } from '../../src/reports/validateReport';

const valid = { targetType: 'answer', targetId: 'ans-1', problemType: 'outdated' };
const fieldsOf = (body: unknown) => {
  const r = validateReport(body);
  if (r.ok) throw new Error('expected a validation failure');
  return r.fields;
};

describe('validateReport', () => {
  it('accepts a minimal answer report and a source report, without a description', () => {
    expect(validateReport(valid)).toEqual({ ok: true, value: { targetType: 'answer', targetId: 'ans-1', problemType: 'outdated', description: null } });
    expect(validateReport({ ...valid, targetType: 'source', targetId: 'src_9' })).toMatchObject({ ok: true, value: { targetType: 'source', targetId: 'src_9' } });
  });

  it('accepts every problem type (with a description for "other")', () => {
    for (const problemType of PROBLEM_TYPES) {
      expect(validateReport({ ...valid, problemType, description: 'details' }).ok).toBe(true);
    }
    expect(PROBLEM_TYPES).toEqual(['incorrect', 'outdated', 'missing-details', 'broken-link', 'other']);
  });

  it('rejects a body that is not an object', () => {
    for (const body of [undefined, null, 'x', 3, [valid]]) expect(fieldsOf(body)).toEqual({ body: 'must be a JSON object' });
  });

  it('requires targetType, targetId and problemType, and reports them all at once', () => {
    expect(fieldsOf({})).toEqual({ targetType: 'is required', targetId: 'is required', problemType: 'is required' });
  });

  it('rejects target types other than answer and source', () => {
    for (const targetType of ['answer-section', 'action-plan-item', 'public-article', 'ANSWER', 1]) {
      expect(fieldsOf({ ...valid, targetType })).toHaveProperty('targetType');
    }
  });

  it('rejects unknown problem types', () => {
    for (const problemType of ['wrong', 'Outdated', '', 2]) expect(fieldsOf({ ...valid, problemType })).toHaveProperty('problemType');
  });

  it('validates targetId: string, not blank, at most 200 characters, safe characters only', () => {
    expect(fieldsOf({ ...valid, targetId: 5 })).toEqual({ targetId: 'must be a string' });
    expect(fieldsOf({ ...valid, targetId: '   ' })).toEqual({ targetId: 'is required' });
    expect(fieldsOf({ ...valid, targetId: 'a'.repeat(201) })).toHaveProperty('targetId');
    expect(validateReport({ ...valid, targetId: 'a'.repeat(200) }).ok).toBe(true);
    expect(fieldsOf({ ...valid, targetId: "x' OR 1=1" })).toHaveProperty('targetId');
    expect(validateReport({ ...valid, targetId: '  ans-1  ' })).toMatchObject({ ok: true, value: { targetId: 'ans-1' } });
  });

  it('requires a description only for "other"; blank counts as missing', () => {
    expect(fieldsOf({ ...valid, problemType: 'other' })).toEqual({ description: 'is required when problemType is "other"' });
    expect(fieldsOf({ ...valid, problemType: 'other', description: '   ' })).toHaveProperty('description');
    expect(validateReport({ ...valid, problemType: 'other', description: ' it is wrong ' })).toMatchObject({ ok: true, value: { description: 'it is wrong' } });
    expect(validateReport({ ...valid, description: '   ' })).toMatchObject({ ok: true, value: { description: null } });
    expect(validateReport({ ...valid, description: null })).toMatchObject({ ok: true, value: { description: null } });
  });

  it('limits the description to 1000 characters after trimming', () => {
    expect(validateReport({ ...valid, description: 'x'.repeat(MAX_DESCRIPTION) }).ok).toBe(true);
    expect(validateReport({ ...valid, description: `  ${'x'.repeat(MAX_DESCRIPTION)}  ` }).ok).toBe(true);
    expect(fieldsOf({ ...valid, description: 'x'.repeat(MAX_DESCRIPTION + 1) })).toEqual({ description: 'must be at most 1000 characters' });
    expect(fieldsOf({ ...valid, description: 42 })).toEqual({ description: 'must be a string' });
  });

  it('rejects unknown fields such as a suggested correction', () => {
    expect(fieldsOf({ ...valid, suggestedCorrection: 'x', tenantId: 't2' })).toEqual({ suggestedCorrection: 'unknown field', tenantId: 'unknown field' });
  });

  it('reports several invalid fields together', () => {
    expect(Object.keys(fieldsOf({ targetType: 'x', targetId: 7, problemType: 'other' })).sort()).toEqual(['description', 'targetId', 'targetType']);
    expect(Object.keys(fieldsOf({ targetType: 'x', targetId: 7, problemType: 'nope', description: 1 })).sort()).toEqual(['description', 'problemType', 'targetId', 'targetType']);
  });
});
