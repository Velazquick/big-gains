import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { createProgramDomainWriteHandler } from './core.js';

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function publishableKey(): string {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) return legacy;
  const configured = JSON.parse(requireEnvironment('SUPABASE_PUBLISHABLE_KEYS'));
  if (typeof configured?.default !== 'string' || !configured.default) {
    throw new Error('Missing default Supabase publishable key');
  }
  return configured.default;
}

const authClient = createClient(requireEnvironment('SUPABASE_URL'), publishableKey(), {
  auth: { autoRefreshToken: false, persistSession: false }
});
const database = postgres(requireEnvironment('SUPABASE_DB_URL'), {
  connect_timeout: 10,
  idle_timeout: 10,
  max: 1,
  prepare: false
});

const handler = createProgramDomainWriteHandler({
  async verifyUser(token: string) {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user?.id) return null;
    return { id: data.user.id };
  },
  async writeProgramDomain(callerUserId: string, input: Record<string, unknown>) {
    const rows = await database`
      select private.put_program_domain_guarded(
        ${callerUserId}::uuid,
        ${input.target_profile_id}::uuid,
        ${input.expected_version}::bigint,
        ${input.expected_updated_at}::timestamptz,
        ${input.expected_fingerprint}::text,
        ${input.expected_definitions_revision}::bigint,
        ${input.expected_definitions_fingerprint}::text,
        ${input.expected_heads_revision}::bigint,
        ${input.expected_heads_fingerprint}::text,
        ${input.expected_sequence_revision}::bigint,
        ${input.expected_sequence_fingerprint}::text,
        ${input.next_version}::bigint,
        ${input.next_updated_at}::timestamptz,
        ${database.json(input.next_payload)}::jsonb,
        ${input.next_fingerprint}::text,
        ${input.next_definitions_revision}::bigint,
        ${input.next_definitions_fingerprint}::text,
        ${input.next_heads_revision}::bigint,
        ${input.next_heads_fingerprint}::text,
        ${input.next_sequence_revision}::bigint,
        ${input.next_sequence_fingerprint}::text,
        ${input.operation_idempotency_key}::text
      ) as result
    `;
    return rows[0]?.result ?? null;
  }
});

Deno.serve(handler);
