(() => {
  'use strict';

  const MIGRATION_FORMAT = 'big-gains.migration.v1';
  const MIGRATION_VERSION = 1;
  const JOURNAL_FORMAT = 'big-gains.migration-journal.v1';
  const POST_AUDIT_FORMAT = 'big-gains.migration-audit.v1';
  const PREVIEW_FORMAT = 'big-gains.migration-preview.v1';
  const SOURCE_SCHEMA_VERSION = 5;
  const SUPPORTED_AUDIT_RELEASES = Object.freeze(['v47.1-phase4d-legacy-source-preview']);
  const PROFILE_IDS = Object.freeze(['jorge', 'alexa']);
  const ENTITY_ORDER = Object.freeze([
    'completedWorkouts', 'customRoutines', 'bodyweightEntries', 'goals',
    'timerPreferences', 'exercisePreferences', 'activeSession'
  ]);
  const PREVIEW_REMOTE_TABLES = Object.freeze([
    'workouts', 'routines', 'preferences', 'active_sessions', 'sync_metadata', 'tombstones'
  ]);
  const TARGET_TABLES = Object.freeze([
    'workouts', 'routines', 'bodyweight_entries', 'preferences', 'active_sessions'
  ]);
  const PAYLOAD_TABLES = new Set(['workouts', 'routines', 'preferences', 'active_sessions']);

  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const nonempty = value => typeof value === 'string' && value.trim().length > 0;
  const checksum = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const uuidLike = value => nonempty(value) && value.length <= 128;
  const nowIso = () => new Date().toISOString();
  const previewApi = () => {
    if (!window.BigGainsMigrationPreview) throw new Error('Phase 4D preview is unavailable.');
    return window.BigGainsMigrationPreview;
  };

  class MigrationError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'MigrationError';
      this.code = code;
    }
  }

  function fail(code, message) {
    throw new MigrationError(code, message);
  }

  function assertKeys(value, allowed, path) {
    if (!isRecord(value)) fail('invalid-audit', `${path} must be an object.`);
    const extras = Object.keys(value).filter(key => !allowed.includes(key));
    if (extras.length) fail('raw-or-unknown-audit-field', `${path} contains unsupported field ${extras[0]}.`);
    const missing = allowed.filter(key => !(key in value));
    if (missing.length) fail('invalid-audit', `${path} is missing ${missing[0]}.`);
  }

  function validateCountMap(value, keys, path) {
    assertKeys(value, keys, path);
    keys.forEach(key => {
      if (!Number.isSafeInteger(value[key]) || value[key] < 0) fail('invalid-audit', `${path}.${key} must be a non-negative integer.`);
    });
  }

  function validateChecksumMap(value, keys, path) {
    assertKeys(value, keys, path);
    keys.forEach(key => {
      if (!checksum(value[key])) fail('invalid-audit', `${path}.${key} must be a SHA-256 checksum.`);
    });
  }

  function validateApprovedAudit(input) {
    let audit;
    try { audit = typeof input === 'string' ? JSON.parse(input) : clone(input); } catch {
      fail('invalid-json', 'The selected file is not valid JSON.');
    }
    assertKeys(audit, [
      'format', 'version', 'generatedAt', 'source', 'account', 'mappings', 'profiles',
      'combinedChecksum', 'remoteCounts', 'status', 'ready', 'blockingReasons'
    ], '$');
    if (audit.format !== PREVIEW_FORMAT || audit.version !== 1) fail('unsupported-audit', 'Select a big-gains.migration-preview.v1 audit.');
    if (!Number.isFinite(Date.parse(audit.generatedAt))) fail('invalid-audit', 'The audit timestamp is invalid.');
    assertKeys(audit.source, ['schemaVersion', 'appRelease'], '$.source');
    if (audit.source.schemaVersion !== SOURCE_SCHEMA_VERSION) fail('unsupported-source', 'The approved audit must use source schema contract 5.');
    if (!SUPPORTED_AUDIT_RELEASES.includes(audit.source.appRelease)) fail('unsupported-release', 'The approved audit app release is not supported by this migration.');
    assertKeys(audit.account, ['id', 'ownerUserId'], '$.account');
    if (!uuidLike(audit.account.id) || !uuidLike(audit.account.ownerUserId)) fail('invalid-audit', 'The approved account mapping is invalid.');
    assertKeys(audit.mappings, PROFILE_IDS, '$.mappings');
    assertKeys(audit.profiles, PROFILE_IDS, '$.profiles');
    PROFILE_IDS.forEach(profileId => {
      const mapping = audit.mappings[profileId];
      assertKeys(mapping, ['localProfileId', 'cloudProfileId', 'cloudAccountId', 'cloudClientId'], `$.mappings.${profileId}`);
      if (mapping.localProfileId !== profileId || mapping.cloudClientId !== profileId
        || mapping.cloudAccountId !== audit.account.id || !uuidLike(mapping.cloudProfileId)) {
        fail('invalid-audit', `The ${profileId} mapping is invalid.`);
      }
      const profile = audit.profiles[profileId];
      assertKeys(profile, ['storedSchemaVersion', 'counts', 'entityChecksums', 'profileChecksum', 'valid'], `$.profiles.${profileId}`);
      if (![2, 3, 4, 5].includes(profile.storedSchemaVersion) || profile.valid !== true) fail('invalid-audit', `The ${profileId} source profile was not valid.`);
      validateCountMap(profile.counts, ENTITY_ORDER, `$.profiles.${profileId}.counts`);
      validateChecksumMap(profile.entityChecksums, ENTITY_ORDER, `$.profiles.${profileId}.entityChecksums`);
      if (!checksum(profile.profileChecksum)) fail('invalid-audit', `The ${profileId} profile checksum is invalid.`);
    });
    if (!checksum(audit.combinedChecksum)) fail('invalid-audit', 'The combined checksum is invalid.');
    validateCountMap(audit.remoteCounts, PREVIEW_REMOTE_TABLES, '$.remoteCounts');
    if (Object.values(audit.remoteCounts).some(value => value !== 0)) fail('destination-not-empty', 'The approved audit did not verify an empty destination.');
    if (audit.status !== 'READY FOR MIGRATION' || audit.ready !== true
      || !Array.isArray(audit.blockingReasons) || audit.blockingReasons.length !== 0) {
      fail('audit-not-ready', 'The selected audit was not approved as READY FOR MIGRATION.');
    }
    return audit;
  }

  function compareAuditToPreview(audit, preview, { requireReady = true } = {}) {
    const blockers = [];
    if (!preview) return ['The current Phase 4D preview is unavailable.'];
    if (requireReady && preview.ready !== true) blockers.push(...(preview.blockingReasons || ['The current preview is blocked.']));
    if (preview.source?.schemaVersion !== audit.source.schemaVersion) blockers.push('The source schema contract changed after approval.');
    if (preview.combinedChecksum !== audit.combinedChecksum) blockers.push('The current local account checksum does not match the approved audit.');
    if (preview.account?.id !== audit.account.id || preview.account?.ownerUserId !== audit.account.ownerUserId) blockers.push('The signed-in cloud account does not match the approved audit.');
    PROFILE_IDS.forEach(profileId => {
      const currentMapping = preview.mappings?.[profileId];
      const approvedMapping = audit.mappings[profileId];
      if (!currentMapping || currentMapping.cloudProfileId !== approvedMapping.cloudProfileId
        || currentMapping.cloudAccountId !== approvedMapping.cloudAccountId
        || currentMapping.cloudClientId !== approvedMapping.cloudClientId) {
        blockers.push(`${profileId === 'jorge' ? 'Jorge' : 'Alexa'} cloud mapping does not match the approved audit.`);
      }
      const current = preview.profiles?.[profileId];
      const approved = audit.profiles[profileId];
      if (!current || current.checksum !== approved.profileChecksum) blockers.push(`${profileId === 'jorge' ? 'Jorge' : 'Alexa'} profile checksum changed after approval.`);
      if (current?.storedSchemaVersion !== approved.storedSchemaVersion) blockers.push(`${profileId === 'jorge' ? 'Jorge' : 'Alexa'} stored schema marker changed after approval.`);
      ENTITY_ORDER.forEach(entity => {
        if (current?.entities?.[entity]?.count !== approved.counts[entity]) blockers.push(`${profileId === 'jorge' ? 'Jorge' : 'Alexa'} ${entity} count changed after approval.`);
        if (current?.entities?.[entity]?.checksum !== approved.entityChecksums[entity]) blockers.push(`${profileId === 'jorge' ? 'Jorge' : 'Alexa'} ${entity} checksum changed after approval.`);
      });
    });
    return [...new Set(blockers)];
  }

  async function stableId(prefix, value) {
    return `${prefix}:${await previewApi().sha256(value)}`;
  }

  async function idempotencyKey(migrationId, profileClientId, table, clientId, canonical) {
    return `bg-migration-v1:${await previewApi().sha256({ migrationId, profileClientId, table, clientId, canonical })}`;
  }

  function payloadCanonical(profileClientId, entityType, clientId, data) {
    return {
      contract: MIGRATION_FORMAT,
      version: MIGRATION_VERSION,
      profileClientId,
      entityType,
      clientId,
      data: clone(data)
    };
  }

  async function summarizeCanonicals(records, migrationId) {
    const profiles = {};
    const tableCounts = Object.fromEntries(TARGET_TABLES.map(table => [table, 0]));
    for (const profileId of PROFILE_IDS) {
      const tables = {};
      for (const table of TARGET_TABLES) {
        const selected = records.filter(record => record.profileClientId === profileId && record.table === table)
          .map(record => record.canonical).sort((left, right) => left.clientId.localeCompare(right.clientId));
        tables[table] = {
          count: selected.length,
          checksum: await previewApi().sha256({ contract: MIGRATION_FORMAT, migrationId, profileClientId: profileId, table, records: selected })
        };
        tableCounts[table] += selected.length;
      }
      profiles[profileId] = { tables };
    }
    const applicationRows = Object.values(tableCounts).reduce((sum, count) => sum + count, 0);
    const combinedChecksum = await previewApi().sha256({ contract: MIGRATION_FORMAT, migrationId, profiles });
    return { profiles, tableCounts, applicationRows, journalRows: 1, totalDatabaseRows: applicationRows + 1, combinedChecksum };
  }

  async function buildMigrationPlan({ audit, preview, localSnapshots }) {
    const approved = validateApprovedAudit(audit);
    const blockers = compareAuditToPreview(approved, preview, { requireReady: false });
    if (blockers.length) fail('audit-mismatch', blockers[0]);
    const migrationId = `bgm-v1-${approved.combinedChecksum}`;
    const records = [];
    for (const profileClientId of PROFILE_IDS) {
      const snapshot = localSnapshots?.[profileClientId];
      if (!snapshot?.ok || !isRecord(snapshot.value)) fail('source-unavailable', `${profileClientId} local source is unavailable.`);
      const source = snapshot.value;
      const mapping = approved.mappings[profileClientId];
      const owner = { account_id: approved.account.id, profile_id: mapping.cloudProfileId };
      const addPayload = async (table, entityType, clientId, data, extra = {}) => {
        const canonical = payloadCanonical(profileClientId, entityType, clientId, data);
        const key = await idempotencyKey(migrationId, profileClientId, table, clientId, canonical);
        records.push({ table, profileClientId, profileId: owner.profile_id, clientId, idempotencyKey: key, canonical,
          row: { ...owner, client_id: clientId, idempotency_key: key, payload: canonical, version: 1, ...extra } });
      };
      for (const workout of source.workouts) {
        await addPayload('workouts', 'completedWorkout', workout.id, workout, { completed_at: new Date(workout.completedAt).toISOString() });
      }
      for (const [name, exerciseIds] of Object.entries(source.customRoutines).sort(([a], [b]) => a.localeCompare(b))) {
        const clientId = await stableId('routine', { name });
        await addPayload('routines', 'customRoutine', clientId, { name, exerciseIds });
      }
      const occurrences = new Map();
      for (const entry of source.weights) {
        const measuredAt = new Date(entry.date).toISOString();
        const identityHash = await previewApi().sha256({ measuredAt, weightValue: entry.weight, unit: 'lb' });
        const occurrence = (occurrences.get(identityHash) || 0) + 1;
        occurrences.set(identityHash, occurrence);
        const clientId = `bodyweight:${identityHash}:${occurrence}`;
        const canonical = { contract: MIGRATION_FORMAT, version: 1, profileClientId, entityType: 'bodyweightEntry', clientId,
          measuredAt, weightValue: entry.weight, unit: 'lb' };
        const key = await idempotencyKey(migrationId, profileClientId, 'bodyweight_entries', clientId, canonical);
        records.push({ table: 'bodyweight_entries', profileClientId, profileId: owner.profile_id, clientId, idempotencyKey: key, canonical,
          row: { ...owner, client_id: clientId, idempotency_key: key, measured_at: measuredAt, weight_value: entry.weight, unit: 'lb', version: 1 } });
      }
      await addPayload('preferences', 'goals', 'goals', source.goals);
      await addPayload('preferences', 'timerPreferences', 'timer', source.timerPreferences);
      for (const [exerciseId, preference] of Object.entries(source.exercisePreferences || {}).sort(([a], [b]) => a.localeCompare(b))) {
        await addPayload('preferences', 'exercisePreference', `exercise:${encodeURIComponent(exerciseId)}`, { exerciseId, preference });
      }
      if (source.activeWorkout) {
        await addPayload('active_sessions', 'activeSession', source.activeWorkout.id,
          { workout: source.activeWorkout, restTimerEndsAt: source.restTimerEndsAt ?? null });
      }
    }
    const target = await summarizeCanonicals(records, migrationId);
    return {
      format: MIGRATION_FORMAT,
      version: MIGRATION_VERSION,
      migrationId,
      account: clone(approved.account),
      mappings: clone(approved.mappings),
      source: {
        previewFormat: approved.format,
        combinedChecksum: approved.combinedChecksum,
        profiles: Object.fromEntries(PROFILE_IDS.map(profileId => [profileId, {
          storedSchemaVersion: approved.profiles[profileId].storedSchemaVersion,
          counts: clone(approved.profiles[profileId].counts),
          entityChecksums: clone(approved.profiles[profileId].entityChecksums),
          profileChecksum: approved.profiles[profileId].profileChecksum
        }]))
      },
      target,
      records
    };
  }

  function canonicalFromRemoteRow(table, row, profileClientId) {
    if (PAYLOAD_TABLES.has(table)) {
      if (!isRecord(row?.payload)) fail('readback-invalid', `A ${table} payload is invalid.`);
      return clone(row.payload);
    }
    if (table === 'bodyweight_entries') {
      return {
        contract: MIGRATION_FORMAT,
        version: Number(row.version),
        profileClientId,
        entityType: 'bodyweightEntry',
        clientId: row.client_id,
        measuredAt: new Date(row.measured_at).toISOString(),
        weightValue: Number(row.weight_value),
        unit: row.unit
      };
    }
    fail('readback-invalid', `Unsupported target table ${table}.`);
  }

  function sameCanonical(left, right) {
    return previewApi().canonicalize(left) === previewApi().canonicalize(right);
  }

  function createSupabaseRepository({ client, accountId }) {
    if (!client || !accountId) throw new TypeError('A signed-in Supabase repository is required.');
    const throwIfError = result => { if (result.error) throw result.error; return result.data; };
    const columnsFor = table => table === 'bodyweight_entries'
      ? 'id,account_id,profile_id,client_id,idempotency_key,measured_at,weight_value,unit,version,created_at,updated_at'
      : 'id,account_id,profile_id,client_id,idempotency_key,payload,version,created_at,updated_at';
    return Object.freeze({
      async readJournals() {
        const result = await client.from('sync_metadata')
          .select('id,account_id,profile_id,client_id,last_acknowledged_version,metadata,version,created_at,updated_at')
          .eq('account_id', accountId).like('client_id', 'migration:%');
        return throwIfError(result) || [];
      },
      async findJournal(clientId) {
        const result = await client.from('sync_metadata')
          .select('id,account_id,profile_id,client_id,last_acknowledged_version,metadata,version,created_at,updated_at')
          .eq('account_id', accountId).eq('client_id', clientId).maybeSingle();
        return throwIfError(result) || null;
      },
      async insertJournal(row) {
        return throwIfError(await client.from('sync_metadata').insert(row)
          .select('id,account_id,profile_id,client_id,last_acknowledged_version,metadata,version,created_at,updated_at').single());
      },
      async updateJournal(id, values) {
        return throwIfError(await client.from('sync_metadata').update(values)
          .eq('account_id', accountId).eq('id', id)
          .select('id,account_id,profile_id,client_id,last_acknowledged_version,metadata,version,created_at,updated_at').single());
      },
      async insertRow(table, row) {
        return throwIfError(await client.from(table).insert(row).select(columnsFor(table)).single());
      },
      async findRow(table, profileId, clientId) {
        const result = await client.from(table).select(columnsFor(table))
          .eq('account_id', accountId).eq('profile_id', profileId).eq('client_id', clientId).maybeSingle();
        return throwIfError(result) || null;
      },
      async readAll(table) {
        return throwIfError(await client.from(table).select(columnsFor(table)).eq('account_id', accountId)) || [];
      }
    });
  }

  function journalMetadata(plan, status, timestamps, extra = {}) {
    return {
      format: JOURNAL_FORMAT,
      migrationContract: plan.format,
      migrationVersion: plan.version,
      migrationId: plan.migrationId,
      account: clone(plan.account),
      mappings: clone(plan.mappings),
      source: clone(plan.source),
      target: clone(plan.target),
      status,
      timestamps: clone(timestamps),
      ...clone(extra)
    };
  }

  function validateJournal(plan, journal) {
    const metadata = journal?.metadata;
    if (!isRecord(metadata) || metadata.format !== JOURNAL_FORMAT || metadata.migrationId !== plan.migrationId
      || metadata.source?.combinedChecksum !== plan.source.combinedChecksum
      || metadata.target?.combinedChecksum !== plan.target.combinedChecksum) {
      fail('journal-conflict', 'The existing migration journal does not match this approved source and target plan.');
    }
    return metadata;
  }

  async function insertOrVerify(repository, record) {
    let inserted = null;
    let insertError = null;
    try { inserted = await repository.insertRow(record.table, record.row); } catch (error) { insertError = error; }
    const candidate = inserted || await repository.findRow(record.table, record.profileId, record.clientId);
    if (!candidate) {
      if (insertError) throw insertError;
      fail('write-missing', `A ${record.table} row could not be created or recovered.`);
    }
    const remoteCanonical = canonicalFromRemoteRow(record.table, candidate, record.profileClientId);
    if (candidate.account_id !== record.row.account_id || candidate.profile_id !== record.profileId
      || candidate.client_id !== record.clientId || candidate.idempotency_key !== record.idempotencyKey
      || !sameCanonical(remoteCanonical, record.canonical)) {
      fail('row-conflict', `An existing ${record.table} row has a different migration identity or payload.`);
    }
    return candidate;
  }

  async function verifyReadback(plan, repository) {
    const remoteRecords = [];
    const profileByUuid = Object.fromEntries(PROFILE_IDS.map(profileId => [plan.mappings[profileId].cloudProfileId, profileId]));
    for (const table of TARGET_TABLES) {
      const rows = await repository.readAll(table);
      if (rows.length !== plan.target.tableCounts[table]) fail('readback-count-mismatch', `${table} readback count does not match the migration plan.`);
      for (const row of rows) {
        const profileClientId = profileByUuid[row.profile_id];
        if (!profileClientId || row.account_id !== plan.account.id) fail('readback-ownership-mismatch', `${table} readback ownership does not match the migration plan.`);
        const expected = plan.records.find(record => record.table === table && record.profileId === row.profile_id && record.clientId === row.client_id);
        if (!expected || row.idempotency_key !== expected.idempotencyKey) fail('readback-extra-row', `${table} contains an unexpected row.`);
        const canonical = canonicalFromRemoteRow(table, row, profileClientId);
        if (!sameCanonical(canonical, expected.canonical)) fail('readback-checksum-mismatch', `${table} readback payload differs from the migration plan.`);
        remoteRecords.push({ table, profileClientId, canonical });
      }
    }
    const target = await summarizeCanonicals(remoteRecords, plan.migrationId);
    if (target.combinedChecksum !== plan.target.combinedChecksum) fail('readback-checksum-mismatch', 'The target readback checksum does not match the migration plan.');
    return { verified: true, verifiedAt: nowIso(), targetCombinedChecksum: target.combinedChecksum };
  }

  function postMigrationAudit(plan, journalMetadataValue, verification) {
    return {
      format: POST_AUDIT_FORMAT,
      version: 1,
      migration: { contract: plan.format, version: plan.version, id: plan.migrationId, status: journalMetadataValue.status },
      source: clone(plan.source),
      target: clone(plan.target),
      account: clone(plan.account),
      mappings: clone(plan.mappings),
      timestamps: clone(journalMetadataValue.timestamps),
      verification: clone(verification)
    };
  }

  async function executeMigration({ plan, repository, existingJournal = null, verifySource, onProgress = () => {} }) {
    if (!plan || !repository || typeof verifySource !== 'function') throw new TypeError('A plan, repository, and source verifier are required.');
    const journalClientId = `migration:${plan.migrationId}`;
    let journal = existingJournal;
    let timestamps = { createdAt: journal?.metadata?.timestamps?.createdAt || nowIso(), startedAt: journal?.metadata?.timestamps?.startedAt || nowIso(), updatedAt: nowIso(), completedAt: null };
    if (journal) validateJournal(plan, journal);
    if (!journal) {
      const metadata = journalMetadata(plan, 'pending', timestamps);
      try {
        journal = await repository.insertJournal({
          account_id: plan.account.id,
          profile_id: plan.mappings.jorge.cloudProfileId,
          client_id: journalClientId,
          last_acknowledged_version: 0,
          version: 1,
          metadata
        });
      } catch (error) {
        journal = await repository.findJournal(journalClientId);
        if (!journal) throw error;
        validateJournal(plan, journal);
      }
    }
    try {
      let completed = 0;
      for (const record of plan.records) {
        await insertOrVerify(repository, record);
        completed += 1;
        onProgress({ stage: 'uploading', completed, total: plan.records.length });
      }
      timestamps = { ...timestamps, updatedAt: nowIso() };
      let metadata = journalMetadata(plan, 'verifying', timestamps);
      journal = await repository.updateJournal(journal.id, { metadata, last_acknowledged_version: 1, version: Number(journal.version || 1) + 1, updated_at: timestamps.updatedAt });
      onProgress({ stage: 'verifying', completed, total: plan.records.length });
      const verification = await verifyReadback(plan, repository);
      const sourceResult = await verifySource();
      if (sourceResult?.combinedChecksum !== plan.source.combinedChecksum) fail('source-changed-during-migration', 'Local data changed during migration; completion is blocked.');
      verification.sourceStillMatches = true;
      timestamps = { ...timestamps, updatedAt: nowIso(), completedAt: nowIso() };
      metadata = journalMetadata(plan, 'complete', timestamps, { verification });
      journal = await repository.updateJournal(journal.id, { metadata, last_acknowledged_version: 2, version: Number(journal.version || 1) + 1, updated_at: timestamps.updatedAt });
      const audit = postMigrationAudit(plan, journal.metadata, verification);
      onProgress({ stage: 'complete', completed, total: plan.records.length });
      return { ok: true, journal, audit, verification };
    } catch (error) {
      timestamps = { ...timestamps, updatedAt: nowIso() };
      const metadata = journalMetadata(plan, 'failed', timestamps, { failure: { code: error?.code || 'migration-interrupted' } });
      try {
        journal = await repository.updateJournal(journal.id, { metadata, last_acknowledged_version: 0, version: Number(journal.version || 1) + 1, updated_at: timestamps.updatedAt });
      } catch {}
      throw error;
    }
  }

  window.BigGainsMigrationEngine = Object.freeze({
    format: MIGRATION_FORMAT,
    version: MIGRATION_VERSION,
    journalFormat: JOURNAL_FORMAT,
    postAuditFormat: POST_AUDIT_FORMAT,
    supportedAuditReleases: SUPPORTED_AUDIT_RELEASES,
    profileIds: PROFILE_IDS,
    entityOrder: ENTITY_ORDER,
    targetTables: TARGET_TABLES,
    MigrationError,
    validateApprovedAudit,
    compareAuditToPreview,
    buildMigrationPlan,
    createSupabaseRepository,
    canonicalFromRemoteRow,
    validateJournal,
    insertOrVerify,
    verifyReadback,
    executeMigration,
    postMigrationAudit
  });
})();
