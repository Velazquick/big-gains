const corsHeaders = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
});

const responseHeaders = Object.freeze({
  ...corsHeaders,
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Content-Type': 'application/json',
  'Expires': '0',
  'Pragma': 'no-cache',
  'Vary': 'Authorization'
});

export const requestFields = Object.freeze([
  'target_profile_id',
  'expected_version',
  'expected_updated_at',
  'expected_fingerprint',
  'expected_definitions_revision',
  'expected_definitions_fingerprint',
  'expected_heads_revision',
  'expected_heads_fingerprint',
  'expected_sequence_revision',
  'expected_sequence_fingerprint',
  'next_version',
  'next_updated_at',
  'next_payload',
  'next_fingerprint',
  'next_definitions_revision',
  'next_definitions_fingerprint',
  'next_heads_revision',
  'next_heads_fingerprint',
  'next_sequence_revision',
  'next_sequence_fingerprint',
  'operation_idempotency_key'
]);

const expectedRevisionFields = Object.freeze([
  'expected_version',
  'expected_definitions_revision',
  'expected_heads_revision',
  'expected_sequence_revision'
]);
const expectedFingerprintFields = Object.freeze([
  'expected_fingerprint',
  'expected_definitions_fingerprint',
  'expected_heads_fingerprint',
  'expected_sequence_fingerprint'
]);
const nextRevisionFields = Object.freeze([
  'next_definitions_revision',
  'next_heads_revision',
  'next_sequence_revision'
]);
const nextFingerprintFields = Object.freeze([
  'next_fingerprint',
  'next_definitions_fingerprint',
  'next_heads_fingerprint',
  'next_sequence_fingerprint'
]);

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isUuid = value => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isFingerprint = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const isRevision = value => Number.isSafeInteger(value) && value >= 0;
const isPositiveRevision = value => Number.isSafeInteger(value) && value > 0;
const isInstant = value => typeof value === 'string'
  && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value;
const isNonempty = value => typeof value === 'string'
  && value.trim() === value
  && value.length > 0
  && value.length <= 512;

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function validateRequestBody(value) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  const expectedKeys = [...requestFields].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) return false;
  if (!isUuid(value.target_profile_id)
    || !isPositiveRevision(value.next_version)
    || !isInstant(value.next_updated_at)
    || !isRecord(value.next_payload)
    || !isNonempty(value.operation_idempotency_key)) return false;
  if (!nextRevisionFields.every(field => isRevision(value[field]))) return false;
  if (!nextFingerprintFields.every(field => isFingerprint(value[field]))) return false;
  if (!expectedRevisionFields.every(field => value[field] === null || isRevision(value[field]))) return false;
  if (!expectedFingerprintFields.every(field => value[field] === null || isFingerprint(value[field]))) return false;
  if (!(value.expected_updated_at === null || isInstant(value.expected_updated_at))) return false;
  return true;
}

export function mapWriteError(error) {
  const code = String(error?.code || '').toUpperCase();
  if (code === '42501') return { status: 403, error: 'profile-access-denied' };
  if (code === 'P0001') return { status: 409, error: 'stale-base' };
  if (code === '23514' || code === '23505' || code.startsWith('22')) {
    return { status: 409, error: 'guard-rejected' };
  }
  return { status: 503, error: 'gateway-unavailable' };
}

export function createProgramDomainWriteHandler({ verifyUser, writeProgramDomain }) {
  if (typeof verifyUser !== 'function' || typeof writeProgramDomain !== 'function') {
    throw new TypeError('Program write gateway dependencies are required.');
  }
  return async request => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: responseHeaders });
    }
    if (request.method !== 'POST') return json(405, { error: 'method-not-allowed' });

    const authorization = request.headers.get('Authorization') || '';
    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!match) return json(401, { error: 'authentication-required' });

    let user;
    try {
      user = await verifyUser(match[1]);
    } catch {
      return json(401, { error: 'authentication-required' });
    }
    if (!isUuid(user?.id)) return json(401, { error: 'authentication-required' });

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'invalid-request' });
    }
    if (!validateRequestBody(body)) return json(400, { error: 'invalid-request' });

    try {
      const accepted = await writeProgramDomain(user.id, body);
      if (!isRecord(accepted)
        || !isUuid(accepted.accepted_id)
        || !isPositiveRevision(Number(accepted.accepted_version))
        || typeof accepted.already_applied !== 'boolean') {
        return json(503, { error: 'gateway-unavailable' });
      }
      return json(200, {
        ok: true,
        disposition: accepted.already_applied ? 'already-applied' : 'applied-or-already-applied',
        version: Number(accepted.accepted_version)
      });
    } catch (error) {
      const mapped = mapWriteError(error);
      return json(mapped.status, { error: mapped.error });
    }
  };
}
