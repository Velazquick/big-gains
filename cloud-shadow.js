(() => {
  'use strict';

  const CONTRACT = 'big-gains.shadow.v1';
  const VERSION = 1;
  const PROFILE_IDS = Object.freeze([...window.bigGainsAccounts.runtime.expectedProfileIds]);
  const TABLES = Object.freeze(['workouts', 'routines', 'bodyweight_entries', 'preferences', 'active_sessions']);
  const PAYLOAD_TABLES = new Set(['workouts', 'routines', 'preferences', 'active_sessions']);
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const preview = () => {
    if (!window.BigGainsMigrationPreview) throw new Error('Cloud shadow checksums require the migration canonicalizer.');
    return window.BigGainsMigrationPreview;
  };
  const keyFor = (table, clientId) => `${table}\u0000${clientId}`;
  const displayProfile = profileId => window.bigGainsAccounts.registry.resolve(profileId)?.displayName || profileId;

  function fail(code, message, details = {}) {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, details);
    throw error;
  }

  async function fingerprint(profileClientId, table, clientId, data, deleted = false) {
    return preview().sha256({ contract: CONTRACT, version: VERSION, profileClientId, table, clientId, deleted, data: deleted ? null : data });
  }

  async function routineClientId(name) {
    return `routine:${await preview().sha256({ name })}`;
  }

  async function localRecords(profileClientId, state) {
    const issues = preview().validateLocalState(state, profileClientId);
    if (issues.length) fail('invalid-local-state', `${displayProfile(profileClientId)} local data cannot be compared.`, { issues });
    const records = [];
    const add = async (table, entityType, clientId, data, extra = {}) => {
      const copied = clone(data);
      records.push(Object.freeze({
        profileClientId, table, entityType, clientId, data: copied,
        fingerprint: await fingerprint(profileClientId, table, clientId, copied),
        ...extra
      }));
    };
    for (const workout of state.workouts) {
      await add('workouts', 'completedWorkout', workout.id, workout, { completedAt: new Date(workout.completedAt).toISOString() });
    }
    for (const [name, exerciseIds] of Object.entries(state.customRoutines || {}).sort(([a], [b]) => a.localeCompare(b))) {
      await add('routines', 'customRoutine', await routineClientId(name), { name, exerciseIds });
    }
    const occurrences = new Map();
    for (const entry of state.weights || []) {
      const measuredAt = new Date(entry.date).toISOString();
      const identityHash = await preview().sha256({ measuredAt, weightValue: entry.weight, unit: 'lb' });
      const occurrence = (occurrences.get(identityHash) || 0) + 1;
      occurrences.set(identityHash, occurrence);
      const clientId = `bodyweight:${identityHash}:${occurrence}`;
      await add('bodyweight_entries', 'bodyweightEntry', clientId,
        { measuredAt, weightValue: Number(entry.weight), unit: 'lb' }, { measuredAt });
    }
    await add('preferences', 'goals', 'goals', state.goals);
    await add('preferences', 'timerPreferences', 'timer', state.timerPreferences);
    for (const [exerciseId, preference] of Object.entries(state.exercisePreferences || {}).sort(([a], [b]) => a.localeCompare(b))) {
      await add('preferences', 'exercisePreference', `exercise:${encodeURIComponent(exerciseId)}`, { exerciseId, preference });
    }
    if (state.activeWorkout) {
      await add('active_sessions', 'activeSession', state.activeWorkout.id,
        { workout: state.activeWorkout, restTimerEndsAt: state.restTimerEndsAt ?? null });
    }
    return records.sort((left, right) => left.table.localeCompare(right.table) || left.clientId.localeCompare(right.clientId));
  }

  async function readLocalProfiles() {
    const profiles = {};
    for (const profileClientId of PROFILE_IDS) {
      const snapshot = window.bigGainsStatePersistence.readProfileSnapshot(profileClientId);
      if (!snapshot.ok) fail('local-profile-unavailable', `${displayProfile(profileClientId)} local data is unavailable.`, { profileClientId, reason: snapshot.reason });
      profiles[profileClientId] = Object.freeze({
        stateVersion: snapshot.value.version,
        records: Object.freeze(await localRecords(profileClientId, snapshot.value))
      });
    }
    return Object.freeze(profiles);
  }

  function payloadData(table, row, profileClientId) {
    if (table === 'bodyweight_entries') {
      return {
        entityType: 'bodyweightEntry',
        data: {
          measuredAt: new Date(row.measured_at).toISOString(),
          weightValue: Number(row.weight_value),
          unit: row.unit
        }
      };
    }
    if (!PAYLOAD_TABLES.has(table) || !isRecord(row.payload)) fail('invalid-cloud-payload', `${table} contains an invalid payload.`);
    const envelope = row.payload;
    if (envelope.contract !== 'big-gains.migration.v1' && envelope.contract !== CONTRACT) {
      fail('unknown-cloud-contract', `${table}/${row.client_id} uses an unsupported payload contract.`);
    }
    if (envelope.profileClientId !== profileClientId || envelope.clientId !== row.client_id || !isRecord(envelope.data)) {
      fail('cloud-identity-mismatch', `${table}/${row.client_id} has a mismatched payload identity.`);
    }
    return { entityType: envelope.entityType, data: clone(envelope.data), contract: envelope.contract };
  }

  function revisionFor(row, tombstone = false) {
    return {
      version: Number(row.version),
      updatedAt: new Date(tombstone ? row.deleted_at : row.updated_at).toISOString(),
      tombstone
    };
  }

  function winner(left, right) {
    if (!left) return right;
    if (!right) return left;
    if (left.version !== right.version) return left.version > right.version ? left : right;
    const leftTime = Date.parse(left.updatedAt);
    const rightTime = Date.parse(right.updatedAt);
    if (leftTime !== rightTime) return leftTime > rightTime ? left : right;
    if (left.tombstone !== right.tombstone) return left.tombstone ? left : right;
    return left;
  }

  async function reconstructCloud({ rowsByTable, tombstones = [], profiles, accountId }) {
    const profileByUuid = Object.fromEntries(PROFILE_IDS.map(id => [profiles[id]?.id, id]));
    const profileResults = Object.fromEntries(PROFILE_IDS.map(id => [id, { records: [], winners: new Map(), tombstones: [] }]));
    const ownershipIssues = [];
    for (const table of TABLES) {
      for (const row of rowsByTable[table] || []) {
        const profileClientId = profileByUuid[row.profile_id];
        if (row.account_id !== accountId || !profileClientId) {
          ownershipIssues.push(`${table}/${row.client_id} has unexpected account or profile ownership.`);
          continue;
        }
        const parsed = payloadData(table, row, profileClientId);
        const revision = revisionFor(row);
        const record = {
          profileClientId, table, entityType: parsed.entityType, clientId: row.client_id,
          data: parsed.data, payloadContract: parsed.contract || 'columns',
          idempotencyKey: row.idempotency_key, ...revision,
          fingerprint: await fingerprint(profileClientId, table, row.client_id, parsed.data)
        };
        const result = profileResults[profileClientId];
        result.records.push(record);
        result.winners.set(keyFor(table, row.client_id), winner(result.winners.get(keyFor(table, row.client_id)), record));
      }
    }
    for (const row of tombstones) {
      const profileClientId = profileByUuid[row.profile_id];
      if (row.account_id !== accountId || !profileClientId || !TABLES.includes(row.entity_type)) {
        ownershipIssues.push(`tombstone/${row.entity_id} has unexpected account, profile, or entity ownership.`);
        continue;
      }
      const revision = revisionFor(row, true);
      const record = {
        profileClientId, table: row.entity_type, entityType: row.entity_type,
        clientId: row.entity_id, data: null, idempotencyKey: row.idempotency_key,
        ...revision,
        fingerprint: await fingerprint(profileClientId, row.entity_type, row.entity_id, null, true)
      };
      const result = profileResults[profileClientId];
      result.tombstones.push(record);
      result.winners.set(keyFor(record.table, record.clientId), winner(result.winners.get(keyFor(record.table, record.clientId)), record));
    }
    for (const profileClientId of PROFILE_IDS) {
      const result = profileResults[profileClientId];
      result.current = [...result.winners.values()].filter(record => !record.tombstone)
        .sort((a, b) => a.table.localeCompare(b.table) || a.clientId.localeCompare(b.clientId));
    }
    return Object.freeze({ profiles: profileResults, ownershipIssues: Object.freeze(ownershipIssues) });
  }

  async function checksumProfile(profileClientId, records) {
    const entities = {};
    for (const table of TABLES) {
      const selected = records.filter(record => record.table === table)
        .map(record => ({ clientId: record.clientId, data: record.data }))
        .sort((a, b) => a.clientId.localeCompare(b.clientId));
      entities[table] = Object.freeze({
        count: selected.length,
        checksum: await preview().sha256({ contract: CONTRACT, version: VERSION, profileClientId, table, records: selected })
      });
    }
    return Object.freeze({
      entities: Object.freeze(entities),
      checksum: await preview().sha256({ contract: CONTRACT, version: VERSION, profileClientId, entities })
    });
  }

  async function compare({ localProfiles, cloud, expectedCatalog = null }) {
    const profiles = {};
    const allReasons = [...cloud.ownershipIssues];
    for (const profileClientId of PROFILE_IDS) {
      const localRecordsValue = localProfiles[profileClientId].records;
      const cloudRecordsValue = cloud.profiles[profileClientId].current;
      const localByKey = new Map(localRecordsValue.map(record => [keyFor(record.table, record.clientId), record]));
      const cloudByKey = new Map(cloudRecordsValue.map(record => [keyFor(record.table, record.clientId), record]));
      const reasons = [];
      const entityResults = {};
      for (const table of TABLES) {
        const entityReasons = [];
        const keys = new Set([
          ...[...localByKey.keys()].filter(key => key.startsWith(`${table}\u0000`)),
          ...[...cloudByKey.keys()].filter(key => key.startsWith(`${table}\u0000`))
        ]);
        for (const key of keys) {
          const local = localByKey.get(key);
          const remote = cloudByKey.get(key);
          const id = local?.clientId || remote?.clientId;
          if (!remote) entityReasons.push(`${table}/${id} is missing from cloud.`);
          else if (!local) entityReasons.push(`${table}/${id} is an unexpected extra cloud row.`);
          else if (local.fingerprint !== remote.fingerprint) entityReasons.push(`${table}/${id} payload does not match local data.`);
          const expected = expectedCatalog?.profiles?.[profileClientId]?.records?.[key];
          const winnerRecord = cloud.profiles[profileClientId].winners.get(key);
          if (expected && winnerRecord) {
            if (winnerRecord.version < expected.version) entityReasons.push(`${table}/${id} has a stale remote version.`);
            else if (winnerRecord.version > expected.version) entityReasons.push(`${table}/${id} has a newer remote version; local remains authoritative.`);
            else if (winnerRecord.fingerprint !== expected.fingerprint) entityReasons.push(`${table}/${id} has the expected version with a mismatched payload.`);
          }
        }
        const localChecksum = await checksumProfile(profileClientId, localRecordsValue.filter(record => record.table === table));
        const cloudChecksum = await checksumProfile(profileClientId, cloudRecordsValue.filter(record => record.table === table));
        entityResults[table] = Object.freeze({
          parity: entityReasons.length === 0,
          localCount: localChecksum.entities[table].count,
          cloudCount: cloudChecksum.entities[table].count,
          localChecksum: localChecksum.entities[table].checksum,
          cloudChecksum: cloudChecksum.entities[table].checksum,
          reasons: Object.freeze(entityReasons)
        });
        reasons.push(...entityReasons);
      }
      const localChecksum = await checksumProfile(profileClientId, localRecordsValue);
      const cloudChecksum = await checksumProfile(profileClientId, cloudRecordsValue);
      profiles[profileClientId] = Object.freeze({
        parity: reasons.length === 0,
        localChecksum: localChecksum.checksum,
        cloudChecksum: cloudChecksum.checksum,
        entities: Object.freeze(entityResults),
        reasons: Object.freeze(reasons)
      });
      allReasons.push(...reasons.map(reason => `${displayProfile(profileClientId)}: ${reason}`));
    }
    return Object.freeze({
      contract: CONTRACT,
      version: VERSION,
      parity: allReasons.length === 0,
      comparedAt: new Date().toISOString(),
      profiles: Object.freeze(profiles),
      reasons: Object.freeze(allReasons)
    });
  }

  function createRepository({ client, accountId }) {
    if (!client || !accountId) throw new TypeError('A signed-in account-scoped shadow repository is required.');
    const payloadColumns = 'id,account_id,profile_id,client_id,idempotency_key,payload,version,created_at,updated_at';
    const bodyweightColumns = 'id,account_id,profile_id,client_id,idempotency_key,measured_at,weight_value,unit,version,created_at,updated_at';
    const throwIfError = result => { if (result.error) throw result.error; return result.data || []; };
    return Object.freeze({
      async readAll() {
        const results = await Promise.all([
          ...TABLES.map(table => client.from(table).select(table === 'bodyweight_entries' ? bodyweightColumns : payloadColumns).eq('account_id', accountId)),
          client.from('tombstones').select('id,account_id,profile_id,entity_type,entity_id,idempotency_key,version,deleted_at,created_at,updated_at').eq('account_id', accountId),
          client.from('sync_metadata').select('id,account_id,profile_id,client_id,metadata,version,created_at,updated_at').eq('account_id', accountId).like('client_id', 'migration:%')
        ]);
        const rowsByTable = Object.fromEntries(TABLES.map((table, index) => [table, throwIfError(results[index])]));
        return { rowsByTable, tombstones: throwIfError(results[TABLES.length]), journals: throwIfError(results[TABLES.length + 1]) };
      }
    });
  }

  function completedMigrationJournal(journals, accountId) {
    return (journals || []).find(journal => journal.account_id === accountId
      && journal.metadata?.format === 'big-gains.migration-journal.v1'
      && journal.metadata?.migrationContract === 'big-gains.migration.v1'
      && journal.metadata?.status === 'complete') || null;
  }

  function catalogFromCloud({ cloud, owner, journal }) {
    const profiles = {};
    for (const profileClientId of PROFILE_IDS) {
      const records = {};
      for (const record of cloud.profiles[profileClientId].winners.values()) {
        records[keyFor(record.table, record.clientId)] = {
          table: record.table,
          entityType: record.entityType,
          clientId: record.clientId,
          version: record.version,
          updatedAt: record.updatedAt,
          fingerprint: record.fingerprint,
          tombstone: record.tombstone === true,
          data: clone(record.data)
        };
      }
      profiles[profileClientId] = { profileId: owner.profiles[profileClientId].id, records };
    }
    return {
      format: 'big-gains.shadow-catalog.v1', version: 1,
      accountId: owner.account.id, authUserId: owner.account.owner_user_id,
      migrationId: journal?.metadata?.migrationId || 'independent-parity',
      adoptedAt: new Date().toISOString(), profiles
    };
  }

  function emptyCatalogFromOwner(owner) {
    return {
      format: 'big-gains.shadow-catalog.v1', version: 1,
      accountId: owner.account.id, authUserId: owner.account.owner_user_id,
      migrationId: 'independent-empty-bootstrap', adoptedAt: new Date().toISOString(),
      profiles: Object.fromEntries(PROFILE_IDS.map(profileClientId => [profileClientId, {
        profileId: owner.profiles[profileClientId].id,
        records: {}
      }]))
    };
  }

  function envelopeFor(record) {
    return {
      contract: CONTRACT, version: VERSION, profileClientId: record.profileClientId,
      entityType: record.entityType, clientId: record.clientId, data: clone(record.data)
    };
  }

  window.BigGainsCloudShadow = Object.freeze({
    contract: CONTRACT,
    version: VERSION,
    tables: TABLES,
    profileIds: PROFILE_IDS,
    keyFor,
    fingerprint,
    routineClientId,
    localRecords,
    readLocalProfiles,
    reconstructCloud,
    checksumProfile,
    compare,
    createRepository,
    completedMigrationJournal,
    catalogFromCloud,
    emptyCatalogFromOwner,
    envelopeFor
  });
})();
