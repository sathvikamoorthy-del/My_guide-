// Validation of a POST /reports body (REQ-169). Pure: no I/O. Every invalid field is reported, together.
export const TARGET_TYPES = ['answer', 'source'] as const;
export const PROBLEM_TYPES = ['incorrect', 'outdated', 'missing-details', 'broken-link', 'other'] as const;
export const MAX_DESCRIPTION = 1000;
export const MAX_TARGET_ID = 200;

export type TargetType = (typeof TARGET_TYPES)[number];
export type ProblemType = (typeof PROBLEM_TYPES)[number];
export interface ReportInput { targetType: TargetType; targetId: string; problemType: ProblemType; description: string | null }
export type Validation = { ok: true; value: ReportInput } | { ok: false; fields: Record<string, string> };

const KNOWN = new Set(['targetType', 'targetId', 'problemType', 'description']);
const TARGET_ID = /^[A-Za-z0-9_-]+$/;

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

export function validateReport(body: unknown): Validation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, fields: { body: 'must be a JSON object' } };
  const b = body as Record<string, unknown>;
  const fields: Record<string, string> = {};

  for (const key of Object.keys(b)) if (!KNOWN.has(key)) fields[key] = 'unknown field';

  if (b.targetType === undefined) fields.targetType = 'is required';
  else if (!oneOf(TARGET_TYPES, b.targetType)) fields.targetType = `must be one of: ${TARGET_TYPES.join(', ')}`;

  let targetId = '';
  if (b.targetId === undefined) fields.targetId = 'is required';
  else if (typeof b.targetId !== 'string') fields.targetId = 'must be a string';
  else {
    targetId = b.targetId.trim();
    if (!targetId) fields.targetId = 'is required';
    else if (targetId.length > MAX_TARGET_ID) fields.targetId = `must be at most ${MAX_TARGET_ID} characters`;
    else if (!TARGET_ID.test(targetId)) fields.targetId = 'may contain only letters, digits, "_" and "-"';
  }

  if (b.problemType === undefined) fields.problemType = 'is required';
  else if (!oneOf(PROBLEM_TYPES, b.problemType)) fields.problemType = `must be one of: ${PROBLEM_TYPES.join(', ')}`;

  let description: string | null = null;
  if (b.description !== undefined && b.description !== null) {
    if (typeof b.description !== 'string') fields.description = 'must be a string';
    else {
      const d = b.description.trim();
      if (d.length > MAX_DESCRIPTION) fields.description = `must be at most ${MAX_DESCRIPTION} characters`;
      else description = d || null;
    }
  }
  if (b.problemType === 'other' && description === null && !fields.description) fields.description = 'is required when problemType is "other"';

  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { targetType: b.targetType as TargetType, targetId, problemType: b.problemType as ProblemType, description } };
}
