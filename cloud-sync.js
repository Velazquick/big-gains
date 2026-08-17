(() => {
  'use strict';

  const cloud = window.BigGainsCloud;
  const shadow = window.BigGainsCloudShadow;
  const supabaseBoundary = window.BigGainsSupabase;
  const accountRuntime = window.bigGainsAccounts.runtime;
  const queue = cloud.createDurableQueue({ key: accountRuntime.cloudKeys.queue });
  const CATALOG_KEY = accountRuntime.cloudKeys.catalog;
  const COMPARISON_KEY = accountRuntime.cloudKeys.comparison;
  const AUTO_PAUSE_KEY = `big-gains-automatic-reconciliation-paused-v1-${accountRuntime.storageNamespace}`;
  const OBSERVABILITY_KEY = `big-gains-sync-reconciliation-observability-v1-${accountRuntime.storageNamespace}`;
  const cloudConfig = window.__BIG_GAINS_CLOUD_CONFIG__ || {};
  const runtimeControl = window.BigGainsReconciliationControl?.create({ supabaseBoundary }) || null;
  let initialized = false;
  let authSubscription = null;
  let cloudOwner = null;
  let busy = false;
  let comparing = false;
  let lastResult = null;
  let lastComparison = readJson(COMPARISON_KEY);
  let remoteFastForward = null;
  let sameEntityConflict = null;
  let catalog = readJson(CATALOG_KEY);
  let captureChain = Promise.resolve();
  let capturePending = 0;
  let localMutationGeneration = 0;
  let lifecycleGeneration = 0;
  let reconciliationTimer = null;
  let reconciliationInFlight = null;
  let lastReconciliationTrigger = null;
  let lastAutomaticDecision = Object.freeze({
    enabled: false,
    reason: cloudConfig.automaticReconciliation === true ? 'runtime-unavailable' : 'capability-off',
    detail: cloudConfig.automaticReconciliation === true ? 'not-checked' : 'static-capability-disabled',
    revision: null,
    checkedAt: null
  });

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

  function staticCapabilityEnabled() {
    return cloudConfig.automaticReconciliation === true;
  }

  function automaticReconciliationPaused() {
    try { return localStorage.getItem(AUTO_PAUSE_KEY) === 'true'; } catch { return true; }
  }

  function automaticPrerequisitesEnabled() {
    return staticCapabilityEnabled() && !automaticReconciliationPaused();
  }

  function automaticReconciliationEnabled() {
    return automaticPrerequisitesEnabled() && lastAutomaticDecision.enabled === true;
  }

  function automaticDecision(reason, detail, revision = null) {
    lastAutomaticDecision = Object.freeze({
      enabled: reason === 'runtime-on',
      reason,
      detail,
      revision,
      checkedAt: new Date().toISOString()
    });
    return lastAutomaticDecision;
  }

  function resetAutomaticDecision() {
    if (!staticCapabilityEnabled()) return automaticDecision('capability-off', 'static-capability-disabled');
    if (automaticReconciliationPaused()) return automaticDecision('device-paused', 'device-emergency-pause');
    return automaticDecision('runtime-unavailable', 'not-checked');
  }

  function pageLifecycleCurrent(generation) {
    return generation === lifecycleGeneration
      && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
  }

  function reconciliationObservability() {
    const fallback = {
      format: 'big-gains.sync-reconciliation-observability.v1',
      version: 1,
      counters: { automaticAdoptions: 0, conflictsShown: 0, activeWorkoutDeferrals: 0, verificationRejections: 0 },
      latches: { conflict: false, activeWorkout: false, rejection: false }
    };
    const stored = readJson(OBSERVABILITY_KEY);
    if (stored?.format !== fallback.format || stored.version !== 1) return fallback;
    if (!Object.keys(fallback.counters).every(key => Number.isSafeInteger(stored.counters?.[key]) && stored.counters[key] >= 0)
      || !Object.keys(fallback.latches).every(key => typeof stored.latches?.[key] === 'boolean')) return fallback;
    return stored;
  }

  function updateReconciliationObservability({ automaticAdoption = false, conflict = false, activeWorkout = false, rejection = false } = {}) {
    const current = reconciliationObservability();
    const next = clone(current);
    if (automaticAdoption) next.counters.automaticAdoptions += 1;
    if (conflict && !current.latches.conflict) next.counters.conflictsShown += 1;
    if (activeWorkout && !current.latches.activeWorkout) next.counters.activeWorkoutDeferrals += 1;
    if (rejection && !current.latches.rejection) next.counters.verificationRejections += 1;
    next.latches = { conflict, activeWorkout, rejection };
    try { writeJson(OBSERVABILITY_KEY, next); } catch { return Object.freeze(clone(current)); }
    return Object.freeze(clone(next));
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function validCatalog(value) {
    return value?.format === 'big-gains.shadow-catalog.v1'
      && typeof value.accountId === 'string'
      && shadow.profileIds.length > 0
      && shadow.profileIds.every(profileClientId => value.profiles?.[profileClientId]?.profileId)
      && Object.keys(value.profiles || {}).length === shadow.profileIds.length;
  }

  if (!validCatalog(catalog)) catalog = null;

  function ownerForProfile(profileClientId) {
    if (!catalog?.profiles?.[profileClientId]) return null;
    return { accountId: catalog.accountId, profileId: catalog.profiles[profileClientId].profileId };
  }

  function sameOwnerMapping(owner) {
    const shapeMatches = accountRuntime.kind === 'managed-member'
      ? owner?.accessKind === 'managed-member' && Object.keys(owner?.profiles || {}).length === 1
      : window.bigGainsAccounts.cloudProfileShape(owner?.profiles) === accountRuntime.cloudShape
        || window.bigGainsAccounts.cloudProfileShape(owner?.profiles) === accountRuntime.kind;
    return Boolean(catalog
      && shapeMatches
      && owner?.account?.id === catalog.accountId
      && owner?.authUserId === catalog.authUserId
      && shadow.profileIds.every(profileClientId => owner?.profiles?.[profileClientId]?.id === catalog.profiles[profileClientId].profileId)
      && Object.keys(owner?.profiles || {}).length === shadow.profileIds.length);
  }

  function baseRevision(record) {
    return record ? {
      version: record.version,
      updatedAt: record.updatedAt,
      fingerprint: record.fingerprint,
      tombstone: record.tombstone === true
    } : null;
  }

  function logicalOperationKey(operation) {
    return [operation?.owner?.accountId, operation?.owner?.profileId, operation?.entityType, operation?.entityId]
      .map(value => String(value || '')).join('\u0000');
  }

  function catalogRecordFromRemote(record) {
    return record ? {
      table: record.table,
      entityType: record.entityType,
      clientId: record.clientId,
      version: record.version,
      updatedAt: record.updatedAt,
      fingerprint: record.fingerprint,
      tombstone: record.tombstone === true,
      data: clone(record.data)
    } : null;
  }

  function buildObsoleteReconciliationPlan({ operations, localProfiles, cloudState, owner }) {
    const grouped = new Map();
    for (const operation of operations || []) {
      if (operation?.synthetic || !shadow.tables.includes(operation?.entityType)) continue;
      if (operation.owner?.accountId !== owner?.account?.id) continue;
      const profileClientId = Object.keys(owner.profiles || {})
        .find(id => owner.profiles[id].id === operation.owner.profileId);
      if (!profileClientId || !localProfiles?.[profileClientId] || !cloudState?.profiles?.[profileClientId]) continue;
      const logicalKey = logicalOperationKey(operation);
      if (!grouped.has(logicalKey)) grouped.set(logicalKey, { profileClientId, operationKey: shadow.keyFor(operation.entityType, operation.entityId), operations: [] });
      grouped.get(logicalKey).operations.push(operation);
    }

    const localByProfile = Object.fromEntries(shadow.profileIds.map(profileClientId => [
      profileClientId,
      new Map((localProfiles?.[profileClientId]?.records || []).map(record => [shadow.keyFor(record.table, record.clientId), record]))
    ]));
    const entities = [];
    for (const group of grouped.values()) {
      const localRecord = localByProfile[group.profileClientId].get(group.operationKey) || null;
      const remoteRecord = cloudState.profiles[group.profileClientId].winners.get(group.operationKey) || null;
      const semanticMatch = localRecord
        ? Boolean(remoteRecord && !remoteRecord.tombstone && remoteRecord.fingerprint === localRecord.fingerprint)
        : Boolean(!remoteRecord || remoteRecord.tombstone);
      if (!semanticMatch) continue;
      entities.push(Object.freeze({
        profileClientId: group.profileClientId,
        operationKey: group.operationKey,
        remoteRecord,
        operations: Object.freeze([...group.operations])
      }));
    }
    return Object.freeze({
      entities: Object.freeze(entities),
      operationCount: entities.reduce((total, entity) => total + entity.operations.length, 0)
    });
  }

  async function reconcileObsoleteOperations({ client, owner, operations }) {
    if (!operations?.length) return Object.freeze({ ok: true, reconciled: 0, logicalEntities: 0 });
    const repository = shadow.createRepository({ client, accountId: owner.account.id });
    const remote = await repository.readAll();
    const cloudState = await shadow.reconstructCloud({ ...remote, profiles: owner.profiles, accountId: owner.account.id });
    if (cloudState.ownershipIssues.length) {
      throw Object.assign(new Error('Fresh cloud readback contains unexpected account or profile ownership.'), {
        code: 'queue-reconciliation-ownership-mismatch'
      });
    }
    const localProfiles = await shadow.readLocalProfiles();
    const plan = buildObsoleteReconciliationPlan({ operations, localProfiles, cloudState, owner });
    if (!plan.operationCount) return Object.freeze({ ok: true, reconciled: 0, logicalEntities: 0 });

    for (const entity of plan.entities) {
      const records = catalog.profiles[entity.profileClientId].records;
      const remoteCatalogRecord = catalogRecordFromRemote(entity.remoteRecord);
      if (remoteCatalogRecord) records[entity.operationKey] = remoteCatalogRecord;
      else delete records[entity.operationKey];
    }
    writeJson(CATALOG_KEY, catalog);

    for (const entity of plan.entities) {
      for (const operation of entity.operations) {
        queue.acknowledge(operation.idempotencyKey, {
          remoteId: entity.remoteRecord?.remoteId || null,
          remoteVersion: entity.remoteRecord?.version ?? operation.version,
          reason: 'semantic-state-already-current',
          reconciled: true
        });
      }
    }
    return Object.freeze({ ok: true, reconciled: plan.operationCount, logicalEntities: plan.entities.length });
  }

  function beginLocalMutation() {
    capturePending += 1;
    localMutationGeneration += 1;
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      capturePending = Math.max(0, capturePending - 1);
      if (capturePending === 0) scheduleReconciliation('post-local-parity', 0);
    };
  }

  async function captureLocalSnapshot(profileClientId, { tracked = false } = {}) {
    const finishLocalMutation = tracked ? null : beginLocalMutation();
    captureChain = captureChain.then(async () => {
      if (!validCatalog(catalog) || !shadow.profileIds.includes(profileClientId)) return Object.freeze({ queued: 0, reason: 'baseline-not-adopted' });
      const snapshot = window.bigGainsStatePersistence.readProfileSnapshot(profileClientId);
      if (!snapshot.ok) return Object.freeze({ queued: 0, reason: snapshot.reason });
      const localRecords = await shadow.localRecords(profileClientId, snapshot.value);
      const profileCatalog = catalog.profiles[profileClientId];
      const desiredByKey = new Map(localRecords.map(record => [shadow.keyFor(record.table, record.clientId), record]));
      let queued = 0;
      const now = () => new Date().toISOString();

      for (const [key, record] of desiredByKey) {
        const previous = profileCatalog.records[key] || null;
        if (previous && !previous.tombstone && previous.fingerprint === record.fingerprint) continue;
        const updatedAt = now();
        const version = previous ? Number(previous.version) + 1 : 1;
        const operation = cloud.createOperation({
          owner: ownerForProfile(profileClientId),
          entityType: record.table,
          entityId: record.clientId,
          mutation: 'upsert',
          version,
          updatedAt,
          payload: shadow.envelopeFor(record),
          payloadFingerprint: record.fingerprint,
          baseRevision: baseRevision(previous),
          allowRecreation: previous?.tombstone === true
        });
        queue.enqueue(operation);
        profileCatalog.records[key] = {
          table: record.table, entityType: record.entityType, clientId: record.clientId,
          version, updatedAt, fingerprint: record.fingerprint, tombstone: false, data: clone(record.data)
        };
        queued += 1;
      }

      for (const [key, previous] of Object.entries(profileCatalog.records)) {
        if (previous.tombstone || desiredByKey.has(key)) continue;
        const updatedAt = now();
        const version = Number(previous.version) + 1;
        const deletedFingerprint = await shadow.fingerprint(profileClientId, previous.table, previous.clientId, null, true);
        const operation = cloud.createOperation({
          owner: ownerForProfile(profileClientId),
          entityType: previous.table,
          entityId: previous.clientId,
          mutation: 'delete',
          version,
          updatedAt,
          payloadFingerprint: deletedFingerprint,
          baseRevision: baseRevision(previous)
        });
        queue.enqueue(operation);
        profileCatalog.records[key] = {
          ...previous, version, updatedAt, fingerprint: deletedFingerprint, tombstone: true, data: null
        };
        queued += 1;
      }

      if (queued) {
        writeJson(CATALOG_KEY, catalog);
        lastResult = { ok: true, queued, pending: queue.pending().length };
        render();
      }
      return Object.freeze({ queued, pending: queue.pending().length });
    }).catch(error => {
      lastResult = { ok: false, reason: 'capture-failed', error: error?.message || String(error), pending: queue.pending().length };
      render();
      return Object.freeze({ queued: 0, reason: 'capture-failed' });
    }).finally(() => {
      finishLocalMutation?.();
    });
    return captureChain;
  }

  function createCompletedWorkoutTransport({ client }) {
    return Object.freeze({
      enabled: Boolean(client),
      reason: client ? null : 'supabase-not-ready',
      async send(operation) {
        if (!operation?.synthetic) return Object.freeze({ ok: false, rejected: true, reason: 'synthetic-only' });
        if (operation.entityType !== 'workouts' || operation.mutation !== 'upsert') {
          return Object.freeze({ ok: false, rejected: true, reason: 'completed-workouts-only' });
        }
        if (!client) return Object.freeze({ ok: false, disabled: true, reason: 'supabase-not-ready' });
        const row = {
          account_id: operation.owner.accountId,
          profile_id: operation.owner.profileId,
          client_id: operation.entityId,
          idempotency_key: operation.idempotencyKey,
          completed_at: operation.payload?.completedAt,
          payload: operation.payload || {},
          version: operation.version,
          updated_at: operation.updatedAt
        };
        const inserted = await client.from('workouts').insert(row).select('id,version,idempotency_key').single();
        if (!inserted.error) return Object.freeze({ ok: true, remoteId: inserted.data.id, remoteVersion: inserted.data.version });
        if (inserted.error.code !== '23505') return Object.freeze({ ok: false, reason: 'remote-insert-failed', error: inserted.error.message });
        const existing = await client.from('workouts').select('id,version,idempotency_key')
          .eq('account_id', operation.owner.accountId).eq('profile_id', operation.owner.profileId)
          .eq('client_id', operation.entityId).maybeSingle();
        if (existing.error || !existing.data || existing.data.idempotency_key !== operation.idempotencyKey) {
          return Object.freeze({ ok: false, reason: 'idempotency-conflict', error: existing.error?.message || null });
        }
        return Object.freeze({ ok: true, duplicate: true, remoteId: existing.data.id, remoteVersion: existing.data.version });
      }
    });
  }

  function tableColumns(table) {
    return table === 'bodyweight_entries'
      ? 'id,account_id,profile_id,client_id,idempotency_key,measured_at,weight_value,unit,version,created_at,updated_at'
      : 'id,account_id,profile_id,client_id,idempotency_key,payload,version,created_at,updated_at';
  }

  function createProductionTransport({ client, owner }) {
    async function readRemote(operation) {
      const [entityResult, tombstoneResult] = await Promise.all([
        client.from(operation.entityType).select(tableColumns(operation.entityType))
          .eq('account_id', operation.owner.accountId).eq('profile_id', operation.owner.profileId)
          .eq('client_id', operation.entityId).maybeSingle(),
        client.from('tombstones').select('id,account_id,profile_id,entity_type,entity_id,idempotency_key,version,deleted_at,created_at,updated_at')
          .eq('account_id', operation.owner.accountId).eq('profile_id', operation.owner.profileId)
          .eq('entity_type', operation.entityType).eq('entity_id', operation.entityId).maybeSingle()
      ]);
      if (entityResult.error) throw entityResult.error;
      if (tombstoneResult.error) throw tombstoneResult.error;
      const rowsByTable = Object.fromEntries(shadow.tables.map(table => [table, table === operation.entityType && entityResult.data ? [entityResult.data] : []]));
      const reconstructed = await shadow.reconstructCloud({
        rowsByTable,
        tombstones: tombstoneResult.data ? [tombstoneResult.data] : [],
        profiles: owner.profiles,
        accountId: owner.account.id
      });
      const profileClientId = Object.keys(owner.profiles).find(id => owner.profiles[id].id === operation.owner.profileId);
      if (!profileClientId) throw new Error('The operation profile is not part of the signed-in runtime account.');
      return {
        source: entityResult.data || null,
        tombstone: tombstoneResult.data || null,
        current: reconstructed.profiles[profileClientId].winners.get(shadow.keyFor(operation.entityType, operation.entityId)) || null
      };
    }

    function exactOperation(current, operation) {
      return Boolean(current
        && current.version === operation.version
        && current.updatedAt === new Date(operation.updatedAt).toISOString()
        && current.fingerprint === operation.payloadFingerprint
        && current.tombstone === (operation.mutation === 'delete')
        && current.idempotencyKey === operation.idempotencyKey);
    }

    function exactBase(current, operation) {
      const base = operation.baseRevision;
      return Boolean(base && current
        && current.version === base.version
        && current.updatedAt === new Date(base.updatedAt).toISOString()
        && current.fingerprint === base.fingerprint
        && current.tombstone === base.tombstone);
    }

    function rowFor(operation) {
      const base = {
        account_id: operation.owner.accountId,
        profile_id: operation.owner.profileId,
        client_id: operation.entityId,
        idempotency_key: operation.idempotencyKey,
        version: operation.version,
        updated_at: operation.updatedAt
      };
      if (operation.entityType === 'bodyweight_entries') {
        return { ...base,
          measured_at: operation.payload.data.measuredAt,
          weight_value: operation.payload.data.weightValue,
          unit: operation.payload.data.unit
        };
      }
      if (operation.entityType === 'workouts') base.completed_at = operation.payload.data.completedAt;
      return { ...base, payload: operation.payload };
    }

    async function upsert(operation, remote) {
      const values = rowFor(operation);
      if (remote.source) {
        const result = await client.from(operation.entityType).update(values)
          .eq('account_id', operation.owner.accountId).eq('profile_id', operation.owner.profileId)
          .eq('id', remote.source.id).eq('version', remote.source.version)
          .select(tableColumns(operation.entityType)).single();
        if (result.error) throw result.error;
        return result.data;
      }
      const result = await client.from(operation.entityType).insert(values).select(tableColumns(operation.entityType)).single();
      if (result.error) throw result.error;
      return result.data;
    }

    async function tombstone(operation, remote) {
      const values = {
        account_id: operation.owner.accountId,
        profile_id: operation.owner.profileId,
        entity_type: operation.entityType,
        entity_id: operation.entityId,
        idempotency_key: operation.idempotencyKey,
        version: operation.version,
        deleted_at: operation.updatedAt,
        updated_at: operation.updatedAt
      };
      if (remote.tombstone) {
        const result = await client.from('tombstones').update(values)
          .eq('account_id', operation.owner.accountId).eq('profile_id', operation.owner.profileId)
          .eq('id', remote.tombstone.id).eq('version', remote.tombstone.version)
          .select('id').single();
        if (result.error) throw result.error;
        return result.data;
      }
      const result = await client.from('tombstones').insert(values).select('id').single();
      if (result.error) throw result.error;
      return result.data;
    }

    return Object.freeze({
      enabled: Boolean(client && owner),
      async send(operation) {
        if (operation.synthetic) return createCompletedWorkoutTransport({ client }).send(operation);
        const mapped = Object.values(owner.profiles).some(profile => profile.id === operation.owner.profileId);
        if (operation.owner.accountId !== owner.account.id || !mapped) return Object.freeze({ ok: false, blocked: true, reason: 'owner-mapping-mismatch' });
        let remote;
        try { remote = await readRemote(operation); } catch (error) {
          return Object.freeze({ ok: false, reason: 'remote-read-failed', error: error?.message || String(error) });
        }
        if (exactOperation(remote.current, operation)) {
          return Object.freeze({ ok: true, duplicate: true, remoteId: (remote.tombstone || remote.source)?.id, remoteVersion: operation.version });
        }
        if (operation.baseRevision == null && remote.current) return Object.freeze({ ok: false, blocked: true, reason: 'unexpected-existing-identity' });
        if (operation.baseRevision != null && !exactBase(remote.current, operation)) {
          return Object.freeze({ ok: false, blocked: true, reason: 'remote-revision-conflict' });
        }
        if (operation.mutation === 'upsert' && remote.current?.tombstone && !operation.allowRecreation) {
          return Object.freeze({ ok: false, blocked: true, reason: 'recreation-not-authorized' });
        }
        try {
          if (operation.mutation === 'delete') await tombstone(operation, remote);
          else await upsert(operation, remote);
          const verified = await readRemote(operation);
          if (!exactOperation(verified.current, operation)) return Object.freeze({ ok: false, blocked: true, reason: 'ack-readback-mismatch' });
          return Object.freeze({ ok: true, remoteId: (verified.tombstone || verified.source)?.id, remoteVersion: operation.version });
        } catch (error) {
          return Object.freeze({ ok: false, reason: 'remote-write-failed', error: error?.message || String(error) });
        }
      }
    });
  }

  function createSyncRuntime({ durableQueue, transport, isOnline = online, operations = () => durableQueue.pending() }) {
    return Object.freeze({
      async flush() {
        if (!isOnline()) return Object.freeze({ ok: false, offline: true, sent: 0, pending: durableQueue.pending().length });
        if (!transport.enabled) return Object.freeze({ ok: true, disabled: true, sent: 0, pending: durableQueue.pending().length, reason: transport.reason });
        let sent = 0;
        let failed = 0;
        let blocked = false;
        let deferred = 0;
        const failedEntities = new Set();
        const failures = [];
        for (const operation of operations()) {
          const logicalKey = logicalOperationKey(operation);
          if (failedEntities.has(logicalKey)) {
            deferred += 1;
            continue;
          }
          let response;
          try { response = await transport.send(operation); } catch (error) {
            response = { ok: false, reason: 'transport-threw', error: error?.message || String(error) };
          }
          if (!response?.ok) {
            durableQueue.markRetried(operation.idempotencyKey);
            failed += 1;
            blocked ||= response?.blocked === true;
            failedEntities.add(logicalKey);
            failures.push(Object.freeze({
              idempotencyKey: operation.idempotencyKey,
              entityType: operation.entityType,
              entityId: operation.entityId,
              mutation: operation.mutation,
              version: operation.version,
              reason: response?.reason || 'transport-failed',
              error: response?.error || null,
              blocked: response?.blocked === true
            }));
            continue;
          }
          durableQueue.acknowledge(operation.idempotencyKey, response);
          sent += 1;
        }
        return Object.freeze({
          ok: failed === 0,
          sent,
          failed,
          blocked,
          deferred,
          reason: failures[0]?.reason || null,
          failures: Object.freeze(failures),
          pending: durableQueue.pending().length
        });
      }
    });
  }

  async function enqueueSyntheticCompletedWorkout({ owner, workout, persistLocal }) {
    if (typeof persistLocal !== 'function') throw new TypeError('Synthetic proof requires an explicit local persistence function.');
    if (!workout?.id || !Number.isFinite(Date.parse(workout?.completedAt))) throw new TypeError('A completed synthetic workout is required.');
    const operation = cloud.createOperation({
      owner, entityType: 'workouts', entityId: workout.id, mutation: 'upsert',
      version: Number.isSafeInteger(workout.version) ? workout.version : 1,
      updatedAt: workout.updatedAt || workout.completedAt, payload: workout, synthetic: true
    });
    await persistLocal(clone(workout), operation);
    queue.enqueue(operation);
    render();
    return operation;
  }

  async function compareShadow({ adopt = false } = {}) {
    if (comparing || !cloudOwner) return lastComparison;
    resetAutomaticDecision();
    comparing = true;
    render();
    try {
      const repository = shadow.createRepository({ client: supabaseBoundary.getClient(), accountId: cloudOwner.account.id });
      const remote = await repository.readAll();
      const journal = shadow.completedMigrationJournal(remote.journals, cloudOwner.account.id);
      if (accountRuntime.kind === 'managed-owner' && !journal) {
        throw Object.assign(new Error('The completed Phase 4E baseline journal was not found.'), { code: 'baseline-missing' });
      }
      const cloudState = await shadow.reconstructCloud({ ...remote, profiles: cloudOwner.profiles, accountId: cloudOwner.account.id });
      const localProfiles = await shadow.readLocalProfiles();
      const comparison = await shadow.compare({ localProfiles, cloud: cloudState, expectedCatalog: catalog });
      lastComparison = comparison;
      remoteFastForward = null;
      sameEntityConflict = null;
      writeJson(COMPARISON_KEY, {
        contract: comparison.contract, parity: comparison.parity, comparedAt: comparison.comparedAt,
        profiles: Object.fromEntries(shadow.profileIds.map(id => [id, {
          parity: comparison.profiles[id].parity,
          localChecksum: comparison.profiles[id].localChecksum,
          cloudChecksum: comparison.profiles[id].cloudChecksum,
          reasons: comparison.profiles[id].reasons
        }])),
        reasons: comparison.reasons
      });
      if (comparison.parity) {
        const verifiedCatalog = shadow.catalogFromCloud({ cloud: cloudState, owner: cloudOwner, journal });
        if (catalog?.migrationId) verifiedCatalog.migrationId = catalog.migrationId;
        catalog = verifiedCatalog;
        writeJson(CATALOG_KEY, catalog);
      } else if (accountRuntime.kind === 'independent' && !catalog
        && shadow.profileIds.every(profileClientId => cloudState.profiles[profileClientId].current.length === 0)) {
        catalog = shadow.emptyCatalogFromOwner(cloudOwner);
        writeJson(CATALOG_KEY, catalog);
        await Promise.all(shadow.profileIds.map(profileClientId => captureLocalSnapshot(profileClientId)));
      } else if (catalog && queue.pending().length) {
        const session = await supabaseBoundary.session();
        sameEntityConflict = window.BigGainsManagedProfileRecovery.inspectSameEntityConflict({
          owner: cloudOwner, session, localProfiles, cloud: cloudState, catalog, operations: queue.pending()
        });
        remoteFastForward = Object.freeze({
          eligible: false,
          conflict: sameEntityConflict.eligible === true,
          reason: sameEntityConflict.eligible ? 'remote-revision-conflict' : sameEntityConflict.reason,
          reasons: sameEntityConflict.reasons
        });
      } else if (catalog && window.BigGainsManagedProfileRecovery?.inspectRemoteFastForward) {
        const session = await supabaseBoundary.session();
        remoteFastForward = window.BigGainsManagedProfileRecovery.inspectRemoteFastForward({
          owner: cloudOwner,
          session,
          localProfiles,
          cloud: cloudState,
          catalog,
          localMutationPending: capturePending > 0
        });
      }
      return comparison;
    } catch (error) {
      remoteFastForward = null;
      sameEntityConflict = null;
      lastComparison = { parity: false, comparedAt: new Date().toISOString(), reasons: [error?.message || String(error)], errorCode: error?.code || 'comparison-failed' };
      return lastComparison;
    } finally {
      comparing = false;
      render();
    }
  }

  async function verifiedOwnerForSession() {
    const session = await supabaseBoundary.session();
    if (!session?.user?.id) return null;
    const verifiedUser = await supabaseBoundary.verifiedUser(session.user.id);
    let owner;
    try {
      owner = await supabaseBoundary.readCloudAccount(verifiedUser.id);
    } catch (error) {
      if (error?.code === 'unexpected') await supabaseBoundary.signOut({ scope: 'local' }).catch(() => {});
      throw error;
    }
    if (!window.bigGainsAccounts.matchesCloudOwner(owner, verifiedUser.id)) {
      await supabaseBoundary.signOut({ scope: 'local' }).catch(() => {});
      throw new Error('Signed-in account access does not match this device runtime. Reload after account verification.');
    }
    if (catalog && !sameOwnerMapping(owner)) throw new Error('Signed-in cloud account/profile mapping does not match this queue.');
    return owner;
  }

  async function flush() {
    if (busy) return Object.freeze({ ok: false, busy: true, sent: 0, pending: queue.pending().length });
    if (!online()) { lastResult = { ok: false, offline: true, pending: queue.pending().length }; render(); return lastResult; }
    busy = true;
    render();
    try {
      cloudOwner = await verifiedOwnerForSession();
      if (!cloudOwner) return (lastResult = Object.freeze({ ok: false, signedOut: true, sent: 0, pending: queue.pending().length }));
      if (!catalog) await compareShadow({ adopt: true });
      if (!catalog || !sameOwnerMapping(cloudOwner)) return (lastResult = Object.freeze({ ok: false, blocked: true, reason: 'baseline-or-owner-unverified', pending: queue.pending().length }));
      const ownedOperations = () => queue.pending().filter(operation => operation.owner.accountId === catalog.accountId
        && Object.values(catalog.profiles).some(profile => profile.profileId === operation.owner.profileId));
      if (ownedOperations().length !== queue.pending().length) return (lastResult = Object.freeze({ ok: false, blocked: true, reason: 'queue-owner-mismatch', pending: queue.pending().length }));
      const client = supabaseBoundary.getClient();
      let reconciliation = Object.freeze({ ok: true, reconciled: 0, logicalEntities: 0 });
      try {
        reconciliation = await reconcileObsoleteOperations({ client, owner: cloudOwner, operations: ownedOperations() });
      } catch (error) {
        reconciliation = Object.freeze({
          ok: false,
          reconciled: 0,
          logicalEntities: 0,
          reason: error?.code || 'queue-reconciliation-read-failed',
          error: error?.message || String(error)
        });
      }
      const transport = createProductionTransport({ client, owner: cloudOwner });
      const syncResult = await createSyncRuntime({ durableQueue: queue, transport, operations: ownedOperations }).flush();
      lastResult = Object.freeze({
        ...syncResult,
        reconciled: reconciliation.reconciled,
        reconciledEntities: reconciliation.logicalEntities,
        reconciliationFailure: reconciliation.ok ? null : Object.freeze({ reason: reconciliation.reason, error: reconciliation.error })
      });
      await compareShadow();
      return lastResult;
    } catch (error) {
      lastResult = Object.freeze({ ok: false, blocked: true, reason: 'session-verification-failed', pending: queue.pending().length, error: error?.message || String(error) });
      return lastResult;
    } finally {
      busy = false;
      render();
    }
  }

  async function applyRemoteFastForward({ automatic = false, generation = lifecycleGeneration } = {}) {
    if (busy || comparing) return Object.freeze({ ok: false, busy: true, pending: queue.pending().length });
    if (automatic && !automaticPrerequisitesEnabled()) {
      const decision = resetAutomaticDecision();
      return Object.freeze({ ok: false, disabled: true, reason: decision.reason, pending: queue.pending().length });
    }
    if (automatic && (!pageLifecycleCurrent(generation) || capturePending > 0)) {
      return Object.freeze({ ok: false, deferred: true, reason: 'local-or-lifecycle-work-in-flight', pending: queue.pending().length });
    }
    const expectedMutationGeneration = localMutationGeneration;
    busy = true;
    render();
    try {
      if (queue.pending().length) {
        remoteFastForward = Object.freeze({
          eligible: false,
          conflict: true,
          reason: 'local-queue-not-empty',
          reasons: Object.freeze(['Local outbound changes appeared before this device could update.'])
        });
        return (lastResult = Object.freeze({ ok: false, blocked: true, conflict: true, reason: 'local-queue-not-empty', pending: queue.pending().length }));
      }
      const owner = await verifiedOwnerForSession();
      if (!owner || !catalog || !sameOwnerMapping(owner)) {
        return (lastResult = Object.freeze({ ok: false, blocked: true, reason: 'baseline-or-owner-unverified', pending: queue.pending().length }));
      }
      const session = await supabaseBoundary.session();
      const repository = shadow.createRepository({ client: supabaseBoundary.getClient(), accountId: owner.account.id });
      const remote = await repository.readAll();
      const journal = shadow.completedMigrationJournal(remote.journals, owner.account.id);
      if (accountRuntime.kind === 'managed-owner' && !journal) {
        return (lastResult = Object.freeze({ ok: false, blocked: true, reason: 'baseline-missing', pending: 0 }));
      }
      const cloudState = await shadow.reconstructCloud({ ...remote, profiles: owner.profiles, accountId: owner.account.id });
      const localProfiles = await shadow.readLocalProfiles();
      const recovery = window.BigGainsManagedProfileRecovery;
      remoteFastForward = recovery.inspectRemoteFastForward({
        owner, session, localProfiles, cloud: cloudState, catalog,
        localMutationPending: capturePending > 0
      });
      if (!remoteFastForward.eligible) {
        if (automatic) automaticDecision('guard-blocked', remoteFastForward.reason || 'remote-fast-forward-ineligible');
        return (lastResult = Object.freeze({
          ok: false,
          blocked: true,
          deferred: remoteFastForward.deferred === true,
          reason: remoteFastForward.reason,
          conflict: remoteFastForward.conflict,
          pending: 0
        }));
      }
      let runtimeDecision = null;
      if (automatic) {
        runtimeDecision = await runtimeControl?.check?.() || Object.freeze({
          enabled: false, reason: 'runtime-unavailable', detail: 'control-port-unavailable', revision: null
        });
        lastAutomaticDecision = runtimeDecision;
        if (!runtimeDecision.enabled) {
          return (lastResult = Object.freeze({
            ok: false,
            disabled: true,
            reason: runtimeDecision.reason,
            detail: runtimeDecision.detail,
            pending: queue.pending().length
          }));
        }
        if (!pageLifecycleCurrent(generation) || capturePending > 0 || localMutationGeneration !== expectedMutationGeneration) {
          automaticDecision('guard-blocked', 'local-or-lifecycle-work-in-flight', runtimeDecision.revision);
          return (lastResult = Object.freeze({
            ok: false, deferred: true, reason: 'local-or-lifecycle-work-in-flight', pending: queue.pending().length
          }));
        }
      }
      const adopted = await recovery.adoptRemoteFastForward({
        owner,
        session,
        localProfiles,
        cloud: cloudState,
        catalog,
        journal,
        localMutationPending: capturePending > 0,
        refreshCloud: async () => {
          const freshOwner = await verifiedOwnerForSession();
          if (!freshOwner || !sameOwnerMapping(freshOwner)) {
            throw Object.assign(new Error('The account/profile mapping changed during the final cloud read.'), { code: 'automatic-adoption-owner-changed' });
          }
          const freshRemote = await shadow.createRepository({
            client: supabaseBoundary.getClient(), accountId: freshOwner.account.id
          }).readAll();
          const freshJournal = shadow.completedMigrationJournal(freshRemote.journals, freshOwner.account.id);
          if (accountRuntime.kind === 'managed-owner' && !freshJournal) {
            throw Object.assign(new Error('The completed Phase 4E baseline journal was not found.'), { code: 'baseline-missing' });
          }
          return {
            cloud: await shadow.reconstructCloud({ ...freshRemote, profiles: freshOwner.profiles, accountId: freshOwner.account.id }),
            journal: freshJournal
          };
        },
        canCommit: () => pageLifecycleCurrent(generation)
          && (!automatic || (automaticPrerequisitesEnabled() && runtimeDecision?.enabled === true))
          && capturePending === 0
          && localMutationGeneration === expectedMutationGeneration
          && queue.pending().length === 0
      });
      if (!adopted.ok) {
        if (automatic) automaticDecision('guard-blocked', adopted.reason || 'automatic-adoption-rejected', runtimeDecision?.revision || null);
        remoteFastForward = Object.freeze({
          eligible: false,
          conflict: adopted.conflict === true,
          reason: adopted.reason,
          reasons: Object.freeze([...(adopted.details || []), adopted.message].filter(Boolean))
        });
        return (lastResult = Object.freeze({
          ok: false,
          blocked: true,
          reason: adopted.reason,
          conflict: adopted.conflict === true,
          pending: queue.pending().length,
          error: adopted.message
        }));
      }
      catalog = adopted.catalog;
      lastComparison = adopted.comparison;
      remoteFastForward = null;
      updateReconciliationObservability({ automaticAdoption: automatic });
      lastResult = Object.freeze({
        ok: true,
        fastForwarded: true,
        automatic,
        advancedRevisions: adopted.advancedRevisions,
        pending: queue.pending().length
      });
      await compareShadow();
      window.setTimeout(() => location.reload(), 0);
      return lastResult;
    } catch (error) {
      lastResult = Object.freeze({
        ok: false,
        blocked: true,
        reason: error?.code || 'remote-fast-forward-failed',
        pending: queue.pending().length,
        error: error?.message || String(error)
      });
      return lastResult;
    } finally {
      busy = false;
      render();
    }
  }

  async function resolveSameEntityConflict(choice) {
    if (busy || comparing) return Object.freeze({ ok: false, busy: true, pending: queue.pending().length });
    const selected = sameEntityConflict;
    if (!selected?.eligible || !['cloud', 'device'].includes(choice)) {
      return Object.freeze({ ok: false, blocked: true, reason: 'same-entity-conflict-unavailable', pending: queue.pending().length });
    }
    busy = true;
    render();
    try {
      const owner = await verifiedOwnerForSession();
      if (!owner || !catalog || !sameOwnerMapping(owner)) {
        return (lastResult = Object.freeze({ ok: false, blocked: true, reason: 'baseline-or-owner-unverified', pending: queue.pending().length }));
      }
      const repository = shadow.createRepository({ client: supabaseBoundary.getClient(), accountId: owner.account.id });
      const remote = await repository.readAll();
      const journal = shadow.completedMigrationJournal(remote.journals, owner.account.id);
      if (accountRuntime.kind === 'managed-owner' && !journal) {
        return (lastResult = Object.freeze({ ok: false, blocked: true, reason: 'baseline-missing', pending: queue.pending().length }));
      }
      const cloudState = await shadow.reconstructCloud({ ...remote, profiles: owner.profiles, accountId: owner.account.id });
      const session = await supabaseBoundary.session();
      const localProfiles = await shadow.readLocalProfiles();
      const recovery = window.BigGainsManagedProfileRecovery;
      const fresh = recovery.inspectSameEntityConflict({
        owner, session, localProfiles, cloud: cloudState, catalog, operations: queue.pending()
      });
      const sameConflict = fresh.eligible
        && fresh.idempotencyKey === selected.idempotencyKey
        && fresh.entityType === selected.entityType
        && fresh.entityId === selected.entityId
        && fresh.remoteRevision === selected.remoteRevision
        && fresh.remoteUpdatedAt === selected.remoteUpdatedAt
        && fresh.remoteFingerprint === selected.remoteFingerprint
        && fresh.remoteTombstone === selected.remoteTombstone;
      if (!sameConflict) {
        sameEntityConflict = fresh.eligible ? fresh : null;
        return (lastResult = Object.freeze({
          ok: false,
          blocked: true,
          conflict: true,
          reason: 'conflict-changed-before-resolution',
          pending: queue.pending().length,
          error: 'Cloud or local data changed after this choice was shown. Review the refreshed conflict before choosing again.'
        }));
      }
      const adopted = await recovery.resolveSameEntityConflict({
        choice, owner, session, localProfiles, cloud: cloudState, catalog,
        operations: queue.pending(), queue, createOperation: cloud.createOperation, journal
      });
      if (!adopted.ok) {
        return (lastResult = Object.freeze({
          ok: false,
          blocked: true,
          conflict: true,
          reason: adopted.reason,
          pending: queue.pending().length,
          error: adopted.message
        }));
      }
      catalog = adopted.catalog;
      lastComparison = adopted.comparison;
      sameEntityConflict = null;
      remoteFastForward = null;
      let syncResult = Object.freeze({ ok: true, sent: 0, pending: queue.pending().length });
      if (choice === 'device') {
        const ownedOperations = () => queue.pending().filter(operation => operation.owner.accountId === catalog.accountId
          && Object.values(catalog.profiles).some(profile => profile.profileId === operation.owner.profileId));
        if (ownedOperations().length !== queue.pending().length) {
          syncResult = Object.freeze({ ok: false, blocked: true, reason: 'queue-owner-mismatch', pending: queue.pending().length });
        } else {
          syncResult = await createSyncRuntime({
            durableQueue: queue,
            transport: createProductionTransport({ client: supabaseBoundary.getClient(), owner }),
            operations: ownedOperations
          }).flush();
        }
      }
      lastResult = Object.freeze({
        ...syncResult,
        conflictResolved: syncResult.ok,
        choice,
        entityType: adopted.entityType,
        entityId: adopted.entityId,
        remoteVersion: adopted.remoteVersion,
        rebasedVersion: adopted.rebasedVersion,
        unrelatedAdvancements: adopted.unrelatedAdvancements,
        pending: queue.pending().length
      });
      await compareShadow();
      const verified = syncResult.ok && queue.pending().length === 0 && lastComparison?.parity === true;
      lastResult = Object.freeze({
        ...lastResult,
        ok: verified,
        conflictResolved: verified,
        pending: queue.pending().length,
        ...(!verified ? { blocked: true, reason: syncResult.reason || 'conflict-resolution-readback-mismatch' } : {})
      });
      window.setTimeout(() => location.reload(), 0);
      return lastResult;
    } catch (error) {
      lastResult = Object.freeze({ ok: false, blocked: true, reason: error?.code || 'conflict-resolution-failed', error: error?.message || String(error), pending: queue.pending().length });
      return lastResult;
    } finally {
      busy = false;
      render();
    }
  }

  function cardMarkup() {
    if (!supabaseBoundary.configured) {
      return '<span class="label">Cloud shadow</span><h3>Not configured</h3><p>Training stays local on this device.</p>';
    }
    return `<span class="label">Cloud shadow</span><h3 id="cloudShadowHeading">Checking quietly…</h3>
      <p id="cloudAuthDetail">Training stays local while the cloud copy is checked.</p>
      <div id="cloudShadowProfiles" class="cloud-shadow-profiles" hidden></div>
      <section id="cloudConflictResolution" class="cloud-conflict-resolution" hidden>
        <span class="label">Needs your choice</span><h4 id="cloudConflictTitle"></h4><p id="cloudConflictSummary"></p>
        <div class="cloud-conflict-choices">
          <article><strong>This device</strong><span id="cloudConflictLocalSummary"></span></article>
          <article><strong>Cloud version</strong><span id="cloudConflictRemoteSummary"></span></article>
        </div>
        <div class="data-actions cloud-conflict-actions"><button id="cloudKeepDevice" class="primary" type="button">Keep this device version</button><button id="cloudKeepCloud" class="secondary" type="button">Keep cloud version</button></div>
        <details><summary>Technical details</summary><pre id="cloudConflictTechnical"></pre></details>
      </section>
      <details id="cloudShadowDrift" class="cloud-shadow-drift" hidden><summary>What needs attention</summary><ul id="cloudShadowDriftList"></ul></details>
      <form id="cloudAuthForm" class="cloud-auth-form" hidden>
        <label><span>Email</span><input id="cloudAuthEmail" type="email" autocomplete="email" required></label>
        <label><span>Password</span><input id="cloudAuthPassword" type="password" autocomplete="current-password" required></label>
        <button class="secondary" type="submit">Sign in</button>
        <button id="cloudPasswordReset" class="ghost" type="button">Set or reset password</button>
        ${supabaseBoundary.isStandalone() ? '' : '<button id="cloudMagicLink" class="ghost" type="button">Use Magic Link in this browser</button>'}
      </form>
      <div class="data-actions"><button id="cloudRemoteFastForward" class="primary" type="button" hidden>Update this device</button><button id="cloudSyncNow" class="secondary" type="button" hidden>Check now</button><button id="cloudSignOut" class="ghost" type="button" hidden>Sign out</button></div>
      <small id="cloudQueueStatus"></small>`;
  }

  function ensureCard() {
    const panel = document.getElementById('settingsPanel');
    if (!panel || document.getElementById('cloudFoundationCard')) return;
    const card = document.createElement('section');
    card.id = 'cloudFoundationCard';
    card.className = 'cloud-foundation-card cloud-shadow-card';
    card.innerHTML = cardMarkup();
    panel.insertAdjacentElement('afterend', card);
  }

  async function render() {
    ensureCard();
    const heading = document.getElementById('cloudShadowHeading');
    if (!heading) return;
    const detail = document.getElementById('cloudAuthDetail');
    const form = document.getElementById('cloudAuthForm');
    const syncButton = document.getElementById('cloudSyncNow');
    const fastForwardButton = document.getElementById('cloudRemoteFastForward');
    const signOutButton = document.getElementById('cloudSignOut');
    const queueStatus = document.getElementById('cloudQueueStatus');
    const profileBox = document.getElementById('cloudShadowProfiles');
    const conflictBox = document.getElementById('cloudConflictResolution');
    const drift = document.getElementById('cloudShadowDrift');
    const driftList = document.getElementById('cloudShadowDriftList');
    let session = null;
    try { session = await supabaseBoundary.session(); } catch {}
    const pending = queue.pending().length;
    const conflict = sameEntityConflict?.eligible === true ? sameEntityConflict : null;
    const fastForwardAvailable = remoteFastForward?.eligible === true;
    const automaticFastForward = fastForwardAvailable && automaticReconciliationEnabled();
    const activeWorkoutDeferral = remoteFastForward?.deferred === true
      && remoteFastForward.reason === 'active-workout-in-progress';
    const automaticVerificationRejected = Boolean(remoteFastForward
      && !remoteFastForward.eligible
      && !remoteFastForward.deferred
      && !remoteFastForward.conflict
      && remoteFastForward.reason !== 'no-newer-remote-revisions');
    const realConflict = Boolean(conflict)
      || remoteFastForward?.reason === 'concurrent-local-edit'
      || lastResult?.conflict === true
      || lastResult?.reason === 'remote-revision-conflict'
      || lastResult?.failures?.some(failure => failure.reason === 'remote-revision-conflict');
    let state = 'CHECKING';
    if (!session) state = online() ? 'SIGNED OUT' : 'OFFLINE';
    else if (automaticFastForward || (reconciliationInFlight && automaticReconciliationEnabled())) state = 'UPDATING';
    else if (activeWorkoutDeferral) state = 'UPDATES WAITING';
    else if (fastForwardAvailable) state = 'REMOTE CHANGES AVAILABLE';
    else if (realConflict) state = 'SYNC CONFLICT';
    else if (automaticVerificationRejected) state = 'RETRY NEEDED';
    else if (lastResult?.blocked || (!pending && lastComparison?.parity === false)) state = 'DRIFT DETECTED';
    else if (pending && lastResult?.ok === false) state = 'CLOUD BEHIND / RETRYING';
    else if (pending) state = 'LOCAL CHANGES PENDING';
    else if (lastComparison?.parity === true) state = 'IN SYNC';
    heading.textContent = state === 'IN SYNC' ? 'In sync'
      : state === 'UPDATING' ? 'Updating this device'
        : state === 'UPDATES WAITING' ? 'Updates waiting until the workout ends'
          : state === 'RETRY NEEDED' ? 'Retry needed'
      : state === 'REMOTE CHANGES AVAILABLE' ? 'Changes from another device'
        : state;
    const profileNames = shadow.profileIds.map(id => window.bigGainsAccounts.registry.resolve(id)?.displayName || id);
    const blockedReason = lastResult?.failures?.[0]?.reason || lastResult?.reason || null;
    detail.textContent = state === 'IN SYNC' ? `${profileNames.join(' and ')} ${profileNames.length === 1 ? 'matches' : 'match'} the private cloud shadow.`
      : state === 'LOCAL CHANGES PENDING' ? `${pending} change${pending === 1 ? '' : 's'} waiting for connection.`
        : state === 'CLOUD BEHIND / RETRYING' ? 'Cloud is catching up. Training stays local.'
          : state === 'REMOTE CHANGES AVAILABLE' ? 'Verified newer training changes are ready to update this device.'
            : state === 'UPDATING' ? 'Verified newer training changes are being applied safely.'
              : state === 'UPDATES WAITING' ? 'Training stays local. Cloud updates will retry after the active workout and its saved changes reach parity.'
                : state === 'RETRY NEEDED' ? 'Verified cloud changes could not be applied automatically. Local data is unchanged.'
            : state === 'SYNC CONFLICT' && conflict ? 'One saved item was edited on two devices. Choose which version to keep.'
              : state === 'SYNC CONFLICT' ? 'Local and remote training both changed. Nothing was overwritten.'
          : state === 'DRIFT DETECTED' ? `${blockedReason ? `Queue blocked: ${blockedReason}. ` : 'Drift detected — '}Local data is unchanged.`
            : state === 'OFFLINE' ? 'Offline. Training stays local.'
              : state === 'SIGNED OUT' ? 'Signed-out training stays local. Sign in to compare the cloud shadow.'
                : 'Checking the private cloud copy.';
    form.hidden = Boolean(session);
    syncButton.hidden = !session;
    syncButton.disabled = busy || comparing;
    fastForwardButton.hidden = !session || !fastForwardAvailable || automaticFastForward;
    fastForwardButton.disabled = busy || comparing;
    signOutButton.hidden = !session;
    conflictBox.hidden = state !== 'SYNC CONFLICT' || !conflict;
    if (conflict) {
      const occurredAt = conflict.localSummary?.completedAt || conflict.cloudSummary?.completedAt;
      const date = occurredAt && Number.isFinite(Date.parse(occurredAt))
        ? new Date(occurredAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : 'Saved item';
      document.getElementById('cloudConflictTitle').textContent = `${conflict.localSummary?.type || conflict.cloudSummary?.type || 'Workout'} · ${date}`;
      document.getElementById('cloudConflictSummary').textContent = `This ${conflict.entityType === 'workouts' ? 'workout' : 'item'} changed here and on another device. ${conflict.unrelatedAdvancements ? `${conflict.unrelatedAdvancements} unrelated cloud change${conflict.unrelatedAdvancements === 1 ? '' : 's'} will also be preserved. ` : ''}Nothing changes until your choice is verified.`;
      const choiceText = (value, revision) => value?.deleted
        ? `Revision ${revision} · Deleted`
        : `Revision ${revision}${Number.isFinite(value?.exercises) ? ` · ${value.exercises} exercise${value.exercises === 1 ? '' : 's'} · ${value.workingSets} working set${value.workingSets === 1 ? '' : 's'}` : ''}`;
      document.getElementById('cloudConflictLocalSummary').textContent = choiceText(conflict.localSummary, conflict.localRevision);
      document.getElementById('cloudConflictRemoteSummary').textContent = choiceText(conflict.cloudSummary, conflict.remoteRevision);
      document.getElementById('cloudConflictTechnical').textContent = `${conflict.entityType}/${conflict.entityId}\nPending device revision: v${conflict.localRevision}\nVerified cloud revision: v${conflict.remoteRevision}\nRemote updated: ${conflict.remoteUpdatedAt}`;
      document.getElementById('cloudKeepCloud').disabled = busy || comparing;
      document.getElementById('cloudKeepDevice').disabled = busy || comparing;
    }
    queueStatus.textContent = `${pending} outbound change${pending === 1 ? '' : 's'} pending${lastResult?.reconciled ? ` · Reconciled ${lastResult.reconciled} obsolete queued change${lastResult.reconciled === 1 ? '' : 's'} after verified readback` : ''}${lastComparison?.comparedAt ? ` · Last checked ${new Date(lastComparison.comparedAt).toLocaleString()}` : ''}.`;
    const profileResults = lastComparison?.profiles;
    profileBox.hidden = !profileResults;
    if (profileResults) profileBox.innerHTML = shadow.profileIds.map(id => `<span><strong>${window.bigGainsAccounts.registry.resolve(id)?.displayName || id}</strong>${profileResults[id]?.parity ? 'In sync' : 'Needs attention'}</span>`).join('');
    const reasons = [...(lastComparison?.reasons || [])];
    if (realConflict) reasons.push(...(remoteFastForward?.reasons || ['Local and remote training both changed after the last verified revision.']));
    for (const failure of lastResult?.failures || []) {
      reasons.push(`${failure.reason} — ${failure.entityType}/${failure.entityId} v${failure.version} ${failure.mutation}${failure.error ? ` (${failure.error})` : ''}`);
    }
    if (lastResult?.blocked && !lastResult?.failures?.length && lastResult.reason) {
      reasons.push(`${lastResult.reason}${lastResult.error ? ` — ${lastResult.error}` : ''}`);
    }
    if (lastResult?.reconciliationFailure) {
      reasons.push(`${lastResult.reconciliationFailure.reason}${lastResult.reconciliationFailure.error ? ` — ${lastResult.reconciliationFailure.error}` : ''}`);
    }
    const uniqueReasons = [...new Set(reasons)];
    drift.hidden = !['DRIFT DETECTED', 'SYNC CONFLICT', 'RETRY NEEDED'].includes(state) || uniqueReasons.length === 0;
    driftList.innerHTML = uniqueReasons.map(reason => `<li>${String(reason).replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character])}</li>`).join('');
  }

  async function runReconciliation(trigger, generation) {
    if (reconciliationInFlight) {
      await reconciliationInFlight;
      if (pageLifecycleCurrent(generation)) return runReconciliation(trigger, generation);
      return Object.freeze({ ok: false, superseded: true, reason: 'reconciliation-generation-superseded' });
    }
    reconciliationInFlight = (async () => {
      lastReconciliationTrigger = trigger;
      resetAutomaticDecision();
      if (!pageLifecycleCurrent(generation)) {
        return Object.freeze({ ok: false, deferred: true, reason: 'page-lifecycle-not-current' });
      }
      const recovery = window.BigGainsManagedProfileRecovery;
      const adoptionRecovery = recovery?.adoptionRecoveryStatus?.();
      if (adoptionRecovery?.ok === false) {
        return (lastResult = Object.freeze({
          ok: false, blocked: true, reason: adoptionRecovery.reason,
          error: adoptionRecovery.message, pending: queue.pending().length
        }));
      }
      cloudOwner = await verifiedOwnerForSession();
      if (!cloudOwner) return (lastResult = Object.freeze({ ok: false, signedOut: true, pending: queue.pending().length }));
      if (!catalog && (recovery?.needsRecoveryForCurrentRuntime()
        || (accountRuntime.kind === 'managed-member' && !recovery?.completedForCurrentRuntime()))) {
        return (lastResult = Object.freeze({ ok: false, blocked: true, reason: 'awaiting-fresh-device-recovery', pending: queue.pending().length }));
      }
      if (capturePending > 0) {
        return (lastResult = Object.freeze({ ok: false, deferred: true, reason: 'local-mutation-in-flight', pending: queue.pending().length }));
      }
      if (queue.pending().length || !catalog) await flush();
      else await compareShadow();
      if (!pageLifecycleCurrent(generation)) {
        return Object.freeze({ ok: false, deferred: true, reason: 'reconciliation-generation-superseded' });
      }
      if (sameEntityConflict?.eligible) {
        if (automaticPrerequisitesEnabled()) automaticDecision('guard-blocked', 'same-entity-conflict');
        updateReconciliationObservability({ conflict: true });
        return Object.freeze({ ok: false, conflict: true, reason: 'same-entity-conflict', pending: queue.pending().length });
      }
      if (remoteFastForward?.deferred) {
        if (automaticPrerequisitesEnabled()) automaticDecision('guard-blocked', remoteFastForward.reason || 'remote-fast-forward-deferred');
        updateReconciliationObservability({ activeWorkout: remoteFastForward.reason === 'active-workout-in-progress' });
      } else if (remoteFastForward && !remoteFastForward.eligible && remoteFastForward.reason !== 'no-newer-remote-revisions') {
        if (automaticPrerequisitesEnabled()) automaticDecision('guard-blocked', remoteFastForward.reason || 'remote-fast-forward-rejected');
        updateReconciliationObservability({ rejection: true });
      } else updateReconciliationObservability();
      if (remoteFastForward?.eligible && automaticPrerequisitesEnabled()) {
        return applyRemoteFastForward({ automatic: true, generation });
      }
      if (remoteFastForward?.deferred) {
        lastResult = Object.freeze({
          ok: false,
          deferred: true,
          reason: remoteFastForward.reason,
          pending: queue.pending().length
        });
      }
      return Object.freeze({
        ok: lastComparison?.parity === true,
        pending: queue.pending().length,
        automaticEligible: remoteFastForward?.eligible === true,
        reason: remoteFastForward?.reason || null
      });
    })().catch(error => {
      lastResult = Object.freeze({ ok: false, blocked: true, reason: error?.code || 'reconciliation-failed', error: error?.message || String(error), pending: queue.pending().length });
      return lastResult;
    }).finally(() => {
      reconciliationInFlight = null;
      render();
    });
    return reconciliationInFlight;
  }

  function scheduleReconciliation(trigger, delay = 100) {
    lifecycleGeneration += 1;
    const generation = lifecycleGeneration;
    if (reconciliationTimer !== null) window.clearTimeout(reconciliationTimer);
    reconciliationTimer = window.setTimeout(() => {
      reconciliationTimer = null;
      runReconciliation(trigger, generation);
    }, delay);
    return generation;
  }

  function invalidateReconciliation() {
    lifecycleGeneration += 1;
    if (reconciliationTimer !== null) window.clearTimeout(reconciliationTimer);
    reconciliationTimer = null;
  }

  function setAutomaticReconciliationPaused(paused) {
    if (paused) {
      localStorage.setItem(AUTO_PAUSE_KEY, 'true');
      invalidateReconciliation();
    } else localStorage.removeItem(AUTO_PAUSE_KEY);
    resetAutomaticDecision();
    if (!paused) scheduleReconciliation('automatic-reconciliation-resumed', 0);
    render();
    return paused === true;
  }

  async function handleSignedIn() {
    try {
      const generation = scheduleReconciliation('signed-in', 0);
      if (reconciliationTimer !== null) window.clearTimeout(reconciliationTimer);
      reconciliationTimer = null;
      await runReconciliation('signed-in', generation);
    } catch (error) {
      lastResult = { ok: false, blocked: true, reason: 'session-verification-failed', error: error?.message || String(error), pending: queue.pending().length };
    }
    render();
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    ensureCard();
    if (!supabaseBoundary.configured) return true;
    document.getElementById('cloudAuthForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        await supabaseBoundary.signInWithPassword(
          document.getElementById('cloudAuthEmail').value,
          document.getElementById('cloudAuthPassword').value
        );
        document.getElementById('cloudAuthDetail').textContent = 'Signed in. Verifying private account access…';
        await handleSignedIn();
      } catch (error) {
        document.getElementById('cloudAuthDetail').textContent = error?.message || 'Email or password could not be verified.';
      }
    });
    document.getElementById('cloudPasswordReset')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      try {
        const result = await supabaseBoundary.requestPasswordReset(document.getElementById('cloudAuthEmail').value);
        document.getElementById('cloudAuthDetail').textContent = 'If this invited account exists, password setup instructions are on the way.';
        button.disabled = true;
        window.setTimeout(() => { if (button?.isConnected) button.disabled = false; }, result.cooldownSeconds * 1000);
      } catch (error) {
        document.getElementById('cloudAuthDetail').textContent = error?.message || 'Enter the invited email address and try again.';
      }
    });
    document.getElementById('cloudMagicLink')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      try {
        const result = await supabaseBoundary.requestMagicLink(document.getElementById('cloudAuthEmail').value);
        document.getElementById('cloudAuthDetail').textContent = 'Check your email for the browser sign-in link.';
        button.disabled = true;
        window.setTimeout(() => { if (button?.isConnected) button.disabled = false; }, result.cooldownSeconds * 1000);
      } catch (error) {
        document.getElementById('cloudAuthDetail').textContent = error?.message || 'Browser sign-in link could not be sent.';
      }
    });
    document.getElementById('cloudSyncNow')?.addEventListener('click', () => scheduleReconciliation('manual-recheck', 0));
    document.getElementById('cloudRemoteFastForward')?.addEventListener('click', () => applyRemoteFastForward({ automatic: false }));
    document.getElementById('cloudKeepCloud')?.addEventListener('click', () => resolveSameEntityConflict('cloud'));
    document.getElementById('cloudKeepDevice')?.addEventListener('click', () => resolveSameEntityConflict('device'));
    document.getElementById('cloudSignOut')?.addEventListener('click', async () => {
      invalidateReconciliation();
      try { await supabaseBoundary.signOut(); } catch {}
      cloudOwner = null;
      render();
    });
    authSubscription = supabaseBoundary.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) window.setTimeout(handleSignedIn, 0);
      if (event === 'SIGNED_OUT') { invalidateReconciliation(); cloudOwner = null; render(); }
    });
    window.addEventListener('online', () => scheduleReconciliation('online', 0));
    window.addEventListener('pageshow', () => scheduleReconciliation('pageshow', 0));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleReconciliation('visible', 0);
      else invalidateReconciliation();
    });
    render().then(async () => { if (await supabaseBoundary.session()) await handleSignedIn(); });
    return true;
  }

  window.BigGainsCloudSync = Object.freeze({
    initialize,
    queue,
    flush,
    applyRemoteFastForward,
    scheduleReconciliation,
    setAutomaticReconciliationPaused,
    resolveSameEntityConflict,
    compareShadow,
    captureLocalSnapshot,
    beginLocalMutation,
    enqueueSyntheticCompletedWorkout,
    createCompletedWorkoutTransport,
    createProductionTransport,
    createSyncRuntime,
    buildObsoleteReconciliationPlan,
    catalogKey: CATALOG_KEY,
    comparisonKey: COMPARISON_KEY,
    observabilityKey: OBSERVABILITY_KEY,
    status: () => Object.freeze({
      configured: supabaseBoundary.configured,
      initialized,
      syntheticOnly: false,
      pending: queue.pending().length,
      ownerReady: Boolean(cloudOwner),
      baselineAdopted: Boolean(catalog),
      busy,
      capturePending,
      localMutationGeneration,
      lifecycleGeneration,
      reconciliationInFlight: Boolean(reconciliationInFlight),
      lastReconciliationTrigger,
      automaticCapabilityEnabled: staticCapabilityEnabled(),
      automaticReconciliationEnabled: automaticReconciliationEnabled(),
      automaticReconciliationPaused: automaticReconciliationPaused(),
      automaticDecision: lastAutomaticDecision,
      observability: reconciliationObservability(),
      lastResult,
      lastComparison,
      remoteFastForward,
      sameEntityConflict
    })
  });
})();
