import { createClient } from '@supabase/supabase-js';

const required = name => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const url = required('SUPABASE_URL');
const publishableKey = required('SUPABASE_PUBLISHABLE_KEY');
const jorgeEmail = required('PHASE4C_SYNTHETIC_JORGE_EMAIL');
const jorgePassword = required('PHASE4C_SYNTHETIC_JORGE_PASSWORD');
const friendEmail = required('PHASE4C_SYNTHETIC_FRIEND_EMAIL');
const friendPassword = required('PHASE4C_SYNTHETIC_FRIEND_PASSWORD');
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const jorge = createClient(url, publishableKey, clientOptions);
const friend = createClient(url, publishableKey, clientOptions);

const jorgeAuth = await jorge.auth.signInWithPassword({ email: jorgeEmail, password: jorgePassword });
const friendAuth = await friend.auth.signInWithPassword({ email: friendEmail, password: friendPassword });
assert(!jorgeAuth.error && jorgeAuth.data.user, `Synthetic Jorge sign-in failed: ${jorgeAuth.error?.message}`);
assert(!friendAuth.error && friendAuth.data.user, `Synthetic friend sign-in failed: ${friendAuth.error?.message}`);

const jorgeAccountResult = await jorge.from('accounts').insert({
  owner_user_id: jorgeAuth.data.user.id,
  display_name: 'Phase 4C synthetic Jorge account'
}).select('id').single();
const friendAccountResult = await friend.from('accounts').insert({
  owner_user_id: friendAuth.data.user.id,
  display_name: 'Phase 4C synthetic friend account'
}).select('id').single();
assert(!jorgeAccountResult.error, `Synthetic Jorge account failed: ${jorgeAccountResult.error?.message}`);
assert(!friendAccountResult.error, `Synthetic friend account failed: ${friendAccountResult.error?.message}`);

const jorgeAccountId = jorgeAccountResult.data.id;
const friendAccountId = friendAccountResult.data.id;
const jorgeProfilesResult = await jorge.from('profiles').insert([
  { account_id: jorgeAccountId, client_id: 'jorge', display_name: 'Synthetic Jorge' },
  { account_id: jorgeAccountId, client_id: 'alexa', display_name: 'Synthetic Alexa' }
]).select('id,client_id');
const friendProfileResult = await friend.from('profiles').insert({
  account_id: friendAccountId,
  client_id: 'friend',
  display_name: 'Synthetic friend'
}).select('id,client_id').single();
assert(!jorgeProfilesResult.error && jorgeProfilesResult.data.length === 2, `Synthetic Jorge profiles failed: ${jorgeProfilesResult.error?.message}`);
assert(!friendProfileResult.error, `Synthetic friend profile failed: ${friendProfileResult.error?.message}`);

const jorgeProfileId = jorgeProfilesResult.data.find(profile => profile.client_id === 'jorge').id;
const friendProfileId = friendProfileResult.data.id;
const jorgeReadsFriend = await jorge.from('profiles').select('id').eq('account_id', friendAccountId);
const friendReadsJorge = await friend.from('profiles').select('id').eq('account_id', jorgeAccountId);
assert(!jorgeReadsFriend.error && jorgeReadsFriend.data.length === 0, 'Synthetic Jorge could read the friend profile.');
assert(!friendReadsJorge.error && friendReadsJorge.data.length === 0, 'Synthetic friend could read a Jorge-owned profile.');

const forgedWrite = await friend.from('workouts').insert({
  account_id: jorgeAccountId,
  profile_id: jorgeProfileId,
  client_id: 'phase4c-friend-forgery',
  idempotency_key: 'phase4c-friend-forgery-key',
  completed_at: '2026-08-07T18:00:00.000Z',
  payload: { synthetic: true }
});
assert(forgedWrite.error, 'Synthetic friend unexpectedly wrote to the Jorge account.');

const entityId = 'phase4c-synthetic-completed-workout';
const updatedAt = '2026-08-07T18:00:00.000Z';
const idempotencyKey = `bg-sync-v1:${[
  jorgeAccountId, jorgeProfileId, 'workouts', entityId, 'upsert', 1, updatedAt
].map(value => encodeURIComponent(String(value))).join(':')}`;
const row = {
  account_id: jorgeAccountId,
  profile_id: jorgeProfileId,
  client_id: entityId,
  idempotency_key: idempotencyKey,
  completed_at: updatedAt,
  updated_at: updatedAt,
  version: 1,
  payload: { id: entityId, completedAt: updatedAt, synthetic: true }
};
const firstInsert = await jorge.from('workouts').insert(row).select('id,version').single();
assert(!firstInsert.error, `First synthetic workout upload failed: ${firstInsert.error?.message}`);

// Simulate a lost acknowledgement: retry the exact operation and recover the existing row.
const retryInsert = await jorge.from('workouts').insert(row);
assert(retryInsert.error?.code === '23505', `Retry did not hit the exact-once constraint: ${retryInsert.error?.message}`);
const recovered = await jorge.from('workouts')
  .select('id,version,idempotency_key')
  .eq('account_id', jorgeAccountId)
  .eq('profile_id', jorgeProfileId)
  .eq('client_id', entityId);
assert(!recovered.error && recovered.data.length === 1, 'Retry recovery did not find exactly one remote row.');
assert(recovered.data[0].idempotency_key === idempotencyKey, 'Recovered row has a different idempotency key.');

await Promise.all([jorge.auth.signOut(), friend.auth.signOut()]);
console.log(JSON.stringify({
  auth: 'two synthetic users signed in with the publishable key',
  topology: 'synthetic Jorge owns Jorge + Alexa profiles; synthetic friend owns one profile',
  isolation: 'cross-account reads returned zero and cross-account write failed',
  retry: 'duplicate retry recovered the original row',
  remoteRows: recovered.data.length,
  remoteVersion: recovered.data[0].version,
  idempotencyStable: recovered.data[0].idempotency_key === idempotencyKey
}));
