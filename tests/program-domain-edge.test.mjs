import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProgramDomainWriteHandler,
  mapWriteError,
  requestFields,
  validateRequestBody
} from '../supabase/functions/program-domain-write/core.js';

const callerId = '11111111-1111-4111-8111-111111111111';
const profileId = '22222222-2222-4222-8222-222222222222';
const acceptedId = '33333333-3333-4333-8333-333333333333';

function validBody() {
  return {
    target_profile_id: profileId,
    expected_version: null,
    expected_updated_at: null,
    expected_fingerprint: null,
    expected_definitions_revision: null,
    expected_definitions_fingerprint: null,
    expected_heads_revision: null,
    expected_heads_fingerprint: null,
    expected_sequence_revision: null,
    expected_sequence_fingerprint: null,
    next_version: 1,
    next_updated_at: '2026-08-28T20:00:00.000Z',
    next_payload: {},
    next_fingerprint: 'a'.repeat(64),
    next_definitions_revision: 0,
    next_definitions_fingerprint: 'b'.repeat(64),
    next_heads_revision: 0,
    next_heads_fingerprint: 'c'.repeat(64),
    next_sequence_revision: 0,
    next_sequence_fingerprint: 'd'.repeat(64),
    operation_idempotency_key: 'program-domain:test-operation'
  };
}

function request(body = validBody(), token = 'verified-user-jwt') {
  return new Request('https://example.test/functions/v1/program-domain-write', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

async function json(response) {
  return { status: response.status, body: await response.json() };
}

test('1 request contract contains exactly the frozen Program operation fields', () => {
  assert.equal(requestFields.length, 21);
  assert.equal(validateRequestBody(validBody()), true);
  assert.equal(Object.hasOwn(validBody(), 'caller_user_id'), false);
});

test('2 missing JWT is rejected before verification or database access', async () => {
  let verified = 0;
  let written = 0;
  const handler = createProgramDomainWriteHandler({
    verifyUser: async () => { verified += 1; },
    writeProgramDomain: async () => { written += 1; }
  });
  const response = await handler(new Request('https://example.test/functions/v1/program-domain-write', {
    method: 'POST', body: JSON.stringify(validBody())
  }));
  assert.deepEqual(await json(response), { status: 401, body: { error: 'authentication-required' } });
  assert.deepEqual({ verified, written }, { verified: 0, written: 0 });
});

test('3 anonymous or invalid JWT identity is rejected', async () => {
  const handler = createProgramDomainWriteHandler({
    verifyUser: async () => null,
    writeProgramDomain: async () => assert.fail('database must not be called')
  });
  assert.deepEqual(await json(await handler(request())), {
    status: 401,
    body: { error: 'authentication-required' }
  });
});

test('4 malformed or identity-bearing request bodies are rejected exactly', async () => {
  let written = 0;
  const handler = createProgramDomainWriteHandler({
    verifyUser: async () => ({ id: callerId }),
    writeProgramDomain: async () => { written += 1; }
  });
  const body = { ...validBody(), caller_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  assert.deepEqual(await json(await handler(request(body))), {
    status: 400,
    body: { error: 'invalid-request' }
  });
  assert.equal(written, 0);
});

test('5 caller identity comes only from the verified JWT result', async () => {
  let observed = null;
  const body = validBody();
  const handler = createProgramDomainWriteHandler({
    verifyUser: async token => {
      assert.equal(token, 'verified-user-jwt');
      return { id: callerId };
    },
    writeProgramDomain: async (verifiedCaller, operation) => {
      observed = { verifiedCaller, operation };
      return { accepted_id: acceptedId, accepted_version: '1', already_applied: false };
    }
  });
  assert.deepEqual(await json(await handler(request(body))), {
    status: 200,
    body: { ok: true, disposition: 'applied-or-already-applied', version: 1 }
  });
  assert.equal(observed.verifiedCaller, callerId);
  assert.deepEqual(observed.operation, body);
});

test('6 independent cross-profile denial maps to a stable non-sensitive response', async () => {
  const handler = createProgramDomainWriteHandler({
    verifyUser: async () => ({ id: callerId }),
    writeProgramDomain: async () => { throw Object.assign(new Error('sensitive database detail'), { code: '42501' }); }
  });
  const response = await json(await handler(request()));
  assert.deepEqual(response, { status: 403, body: { error: 'profile-access-denied' } });
  assert.doesNotMatch(JSON.stringify(response), /sensitive database detail/);
});

test('7 stale, guard, and unexpected database failures have stable classifications', () => {
  assert.deepEqual(mapWriteError({ code: 'P0001' }), { status: 409, error: 'stale-base' });
  assert.deepEqual(mapWriteError({ code: '23514' }), { status: 409, error: 'guard-rejected' });
  assert.deepEqual(mapWriteError({ code: 'XX000' }), { status: 503, error: 'gateway-unavailable' });
});

test('8 invalid revision, timestamp, payload, fingerprint, and idempotency shapes fail closed', () => {
  const mutations = [
    body => { body.next_version = '1'; },
    body => { body.next_updated_at = '2026-08-28'; },
    body => { body.next_payload = []; },
    body => { body.next_fingerprint = 'A'.repeat(64); },
    body => { body.operation_idempotency_key = ' padded '; }
  ];
  for (const mutate of mutations) {
    const body = validBody();
    mutate(body);
    assert.equal(validateRequestBody(body), false);
  }
});
