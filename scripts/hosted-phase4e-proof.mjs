import { createClient } from '@supabase/supabase-js';

const required = name => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const url = required('SUPABASE_URL');
const key = required('SUPABASE_PUBLISHABLE_KEY');
const owner = createClient(url, key, options);
const friend = createClient(url, key, options);
const runId = `phase4e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
let ownerAccountId = null;
let friendAccountId = null;

try {
  const ownerAuth = await owner.auth.signInWithPassword({
    email: required('PHASE4C_SYNTHETIC_JORGE_EMAIL'),
    password: required('PHASE4C_SYNTHETIC_JORGE_PASSWORD')
  });
  const friendAuth = await friend.auth.signInWithPassword({
    email: required('PHASE4C_SYNTHETIC_FRIEND_EMAIL'),
    password: required('PHASE4C_SYNTHETIC_FRIEND_PASSWORD')
  });
  assert(!ownerAuth.error && ownerAuth.data.user, `Synthetic owner sign-in failed: ${ownerAuth.error?.message}`);
  assert(!friendAuth.error && friendAuth.data.user, `Synthetic friend sign-in failed: ${friendAuth.error?.message}`);

  const ownerAccount = await owner.from('accounts').insert({ owner_user_id: ownerAuth.data.user.id, display_name: `Phase 4E ${runId}` }).select('id').single();
  const friendAccount = await friend.from('accounts').insert({ owner_user_id: friendAuth.data.user.id, display_name: `Phase 4E friend ${runId}` }).select('id').single();
  assert(!ownerAccount.error, `Synthetic owner account failed: ${ownerAccount.error?.message}`);
  assert(!friendAccount.error, `Synthetic friend account failed: ${friendAccount.error?.message}`);
  ownerAccountId = ownerAccount.data.id;
  friendAccountId = friendAccount.data.id;

  const ownerProfiles = await owner.from('profiles').insert([
    { account_id: ownerAccountId, client_id: 'jorge', display_name: 'Synthetic Jorge' },
    { account_id: ownerAccountId, client_id: 'alexa', display_name: 'Synthetic Alexa' }
  ]).select('id,client_id');
  const friendProfile = await friend.from('profiles').insert({ account_id: friendAccountId, client_id: 'friend', display_name: 'Synthetic Friend' }).select('id').single();
  assert(!ownerProfiles.error && ownerProfiles.data.length === 2, `Synthetic owner profiles failed: ${ownerProfiles.error?.message}`);
  assert(!friendProfile.error, `Synthetic friend profile failed: ${friendProfile.error?.message}`);
  const jorgeProfileId = ownerProfiles.data.find(profile => profile.client_id === 'jorge').id;

  const row = {
    account_id: ownerAccountId,
    profile_id: jorgeProfileId,
    client_id: `bodyweight:${runId}:1`,
    idempotency_key: `bg-migration-v1:${runId}`,
    measured_at: '2026-08-07T18:00:00.000Z',
    weight_value: 200,
    unit: 'lb',
    version: 1
  };
  const first = await owner.from('bodyweight_entries').insert(row).select('id,idempotency_key').single();
  assert(!first.error, `Synthetic bodyweight insert failed: ${first.error?.message}`);
  const retry = await owner.from('bodyweight_entries').insert(row);
  assert(retry.error?.code === '23505', `Synthetic retry did not reach the uniqueness boundary: ${retry.error?.message}`);
  const recovered = await owner.from('bodyweight_entries').select('id,idempotency_key')
    .eq('account_id', ownerAccountId).eq('profile_id', jorgeProfileId).eq('client_id', row.client_id);
  assert(!recovered.error && recovered.data.length === 1, 'Synthetic retry recovery did not return exactly one row.');
  assert(recovered.data[0].idempotency_key === row.idempotency_key, 'Synthetic recovered row has a different idempotency key.');

  const crossRead = await friend.from('bodyweight_entries').select('id').eq('account_id', ownerAccountId);
  assert(!crossRead.error && crossRead.data.length === 0, 'Synthetic friend could read owner bodyweight history.');
  const forged = await friend.from('bodyweight_entries').insert({ ...row, profile_id: jorgeProfileId, client_id: `${runId}-forged`, idempotency_key: `${runId}-forged` });
  assert(forged.error, 'Synthetic friend unexpectedly wrote into the owner account.');
  const reassigned = await owner.from('bodyweight_entries').update({ account_id: friendAccountId }).eq('id', first.data.id);
  assert(reassigned.error, 'Synthetic owner unexpectedly reassigned bodyweight ownership.');
  const anon = createClient(url, key, options);
  const anonymousRead = await anon.from('bodyweight_entries').select('id').eq('account_id', ownerAccountId);
  assert(anonymousRead.error, 'Anonymous client unexpectedly received bodyweight table access.');

  console.log(JSON.stringify({
    syntheticOnly: true,
    bodyweightUnit: 'lb',
    retryRows: recovered.data.length,
    idempotencyStable: recovered.data[0].idempotency_key === row.idempotency_key,
    crossAccountReadRows: crossRead.data.length,
    forgedWriteDenied: Boolean(forged.error),
    ownershipReassignmentDenied: Boolean(reassigned.error),
    anonymousDenied: Boolean(anonymousRead.error)
  }));
} finally {
  if (ownerAccountId) await owner.from('accounts').delete().eq('id', ownerAccountId);
  if (friendAccountId) await friend.from('accounts').delete().eq('id', friendAccountId);
  await Promise.allSettled([owner.auth.signOut(), friend.auth.signOut()]);
}
