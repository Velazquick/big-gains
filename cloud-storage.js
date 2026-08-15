(() => {
  'use strict';

  const CONTRACT_VERSION = 1;
  const DURABLE_QUEUE_KEY = 'big-gains-cloud-sync-queue-v1';
  const ENTITY_TYPES = Object.freeze([
    'workouts',
    'routines',
    'bodyweight_entries',
    'preferences',
    'active_sessions',
    'sync_metadata',
    'tombstones'
  ]);
  const MUTATIONS = Object.freeze(['upsert', 'delete']);

  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function canonicalize(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
    if (isRecord(value)) {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function stableHash(value) {
    const text = typeof value === 'string' ? value : canonicalize(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function normalizeOwner(owner) {
    if (!isRecord(owner)
      || typeof owner.accountId !== 'string'
      || !owner.accountId
      || typeof owner.profileId !== 'string'
      || !owner.profileId) {
      throw new TypeError('Cloud ownership requires explicit accountId and profileId values.');
    }
    return Object.freeze({ accountId: owner.accountId, profileId: owner.profileId });
  }

  function assertImmutableOwnership(existing, incoming) {
    const current = normalizeOwner(existing);
    const next = normalizeOwner(incoming);
    if (current.accountId !== next.accountId || current.profileId !== next.profileId) {
      throw new Error('Cloud account/profile ownership is immutable.');
    }
    return true;
  }

  function operationIdentity(input) {
    return {
      contract: 'big-gains.sync-op.v1',
      contractVersion: CONTRACT_VERSION,
      owner: normalizeOwner(input.owner),
      entityType: input.entityType,
      entityId: input.entityId,
      mutation: input.mutation,
      version: input.version,
      updatedAt: input.updatedAt,
      payload: input.mutation === 'delete' ? null : input.payload ?? null,
      payloadFingerprint: input.payloadFingerprint || stableHash(input.mutation === 'delete' ? null : input.payload ?? null),
      baseRevision: input.baseRevision == null ? null : {
        version: Number(input.baseRevision.version),
        updatedAt: input.baseRevision.updatedAt,
        fingerprint: input.baseRevision.fingerprint,
        tombstone: input.baseRevision.tombstone === true
      },
      allowRecreation: input.allowRecreation === true,
      synthetic: input.synthetic === true
    };
  }

  function idempotencyKeyFor(identity) {
    const segments = [
      identity.owner.accountId,
      identity.owner.profileId,
      identity.entityType,
      identity.entityId,
      identity.mutation,
      identity.version,
      identity.updatedAt
    ];
    return `bg-sync-v${CONTRACT_VERSION}:${segments.map(value => encodeURIComponent(String(value))).join(':')}`;
  }

  function createOperation(input) {
    if (!isRecord(input) || !ENTITY_TYPES.includes(input.entityType)) throw new TypeError('Unknown cloud entity type.');
    if (typeof input.entityId !== 'string' || !input.entityId) throw new TypeError('A stable entityId is required.');
    if (!MUTATIONS.includes(input.mutation)) throw new TypeError('Mutation must be upsert or delete.');
    const version = Number(input.version);
    if (!Number.isSafeInteger(version) || version < 1) throw new TypeError('Mutation version must be a positive integer.');
    if (typeof input.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.updatedAt))) {
      throw new TypeError('Mutation updatedAt must be an ISO-compatible timestamp.');
    }
    if (input.baseRevision != null) {
      const base = input.baseRevision;
      if (!Number.isSafeInteger(Number(base.version)) || Number(base.version) < 1
        || typeof base.updatedAt !== 'string' || !Number.isFinite(Date.parse(base.updatedAt))
        || typeof base.fingerprint !== 'string' || !base.fingerprint) {
        throw new TypeError('A base revision requires version, updatedAt, and fingerprint values.');
      }
    }
    const identity = operationIdentity({ ...input, version });
    return Object.freeze({
      ...identity,
      idempotencyKey: idempotencyKeyFor(identity),
      attempts: 0,
      queuedAt: input.queuedAt || new Date().toISOString()
    });
  }

  function retryOperation(operation) {
    return Object.freeze({ ...operation, attempts: Number(operation.attempts || 0) + 1 });
  }

  function acknowledgementFor(operation, acknowledgement) {
    return Object.freeze({
      idempotencyKey: operation.idempotencyKey,
      remoteId: acknowledgement?.remoteId || null,
      remoteVersion: acknowledgement?.remoteVersion ?? operation.version,
      acknowledgedAt: acknowledgement?.acknowledgedAt || new Date().toISOString(),
      reason: acknowledgement?.reason || null,
      reconciled: acknowledgement?.reconciled === true
    });
  }

  function createMemoryQueue() {
    const pendingByKey = new Map();
    const acknowledgements = new Map();
    return Object.freeze({
      enqueue(operation) {
        const existing = pendingByKey.get(operation.idempotencyKey);
        if (existing) return existing;
        pendingByKey.set(operation.idempotencyKey, operation);
        return operation;
      },
      pending() {
        return [...pendingByKey.values()];
      },
      markRetried(idempotencyKey) {
        const operation = pendingByKey.get(idempotencyKey);
        if (!operation) return null;
        const retried = retryOperation(operation);
        pendingByKey.set(idempotencyKey, retried);
        return retried;
      },
      acknowledge(idempotencyKey, acknowledgement) {
        const operation = pendingByKey.get(idempotencyKey);
        if (!operation) return false;
        pendingByKey.delete(idempotencyKey);
        acknowledgements.set(idempotencyKey, acknowledgementFor(operation, acknowledgement));
        return true;
      },
      replace(idempotencyKey, replacement, acknowledgement = {}) {
        const operation = pendingByKey.get(idempotencyKey);
        const validReplacement = replacement == null ? null : validPersistedOperation(replacement);
        if (!operation || (replacement != null && !validReplacement)) return false;
        if (validReplacement && (validReplacement.owner.accountId !== operation.owner.accountId
          || validReplacement.owner.profileId !== operation.owner.profileId
          || validReplacement.entityType !== operation.entityType
          || validReplacement.entityId !== operation.entityId)) {
          throw new Error('A queued conflict may only be replaced by the same owned logical entity.');
        }
        if (validReplacement && validReplacement.idempotencyKey !== idempotencyKey
          && pendingByKey.has(validReplacement.idempotencyKey)) return false;
        pendingByKey.delete(idempotencyKey);
        acknowledgements.set(idempotencyKey, acknowledgementFor(operation, acknowledgement));
        if (validReplacement && !acknowledgements.has(validReplacement.idempotencyKey)) {
          pendingByKey.set(validReplacement.idempotencyKey, validReplacement);
        }
        return validReplacement || true;
      },
      acknowledgement(idempotencyKey) {
        return acknowledgements.get(idempotencyKey) || null;
      }
    });
  }

  function validPersistedOperation(value) {
    try {
      const owner = normalizeOwner(value?.owner);
      if (!ENTITY_TYPES.includes(value?.entityType)
        || !MUTATIONS.includes(value?.mutation)
        || typeof value?.entityId !== 'string'
        || typeof value?.idempotencyKey !== 'string') return null;
      const expected = createOperation({ ...value, owner, queuedAt: value.queuedAt });
      if (expected.idempotencyKey !== value.idempotencyKey) return null;
      return Object.freeze({
        ...expected,
        attempts: Number.isSafeInteger(Number(value.attempts)) && Number(value.attempts) >= 0 ? Number(value.attempts) : 0
      });
    } catch {
      return null;
    }
  }

  function createDurableQueue({ storage = window.localStorage, key = DURABLE_QUEUE_KEY, acknowledgementLimit = 250 } = {}) {
    let parsed = null;
    try { parsed = JSON.parse(storage.getItem(key) || 'null'); } catch { parsed = null; }
    const pendingByKey = new Map();
    const acknowledgements = new Map();
    if (parsed?.version === 1 && Array.isArray(parsed.pending)) {
      parsed.pending.forEach(value => {
        const operation = validPersistedOperation(value);
        if (operation) pendingByKey.set(operation.idempotencyKey, operation);
      });
    }
    if (parsed?.version === 1 && Array.isArray(parsed.acknowledgements)) {
      parsed.acknowledgements.forEach(value => {
        if (typeof value?.idempotencyKey === 'string') acknowledgements.set(value.idempotencyKey, Object.freeze({ ...value }));
      });
    }

    function persist(pending = pendingByKey, acknowledged = acknowledgements) {
      storage.setItem(key, JSON.stringify({
        version: 1,
        pending: [...pending.values()],
        acknowledgements: [...acknowledged.values()].slice(-acknowledgementLimit)
      }));
    }

    function commit(candidatePending, candidateAcknowledgements) {
      persist(candidatePending, candidateAcknowledgements);
      pendingByKey.clear();
      candidatePending.forEach((value, operationKey) => pendingByKey.set(operationKey, value));
      acknowledgements.clear();
      candidateAcknowledgements.forEach((value, acknowledgementKey) => acknowledgements.set(acknowledgementKey, value));
    }

    return Object.freeze({
      key,
      enqueue(operation) {
        const valid = validPersistedOperation(operation);
        if (!valid) throw new TypeError('A valid cloud operation is required.');
        const acknowledged = acknowledgements.get(valid.idempotencyKey);
        if (acknowledged) return operation;
        const existing = pendingByKey.get(valid.idempotencyKey);
        if (existing) return existing;
        const candidatePending = new Map(pendingByKey);
        candidatePending.set(valid.idempotencyKey, valid);
        commit(candidatePending, new Map(acknowledgements));
        return valid;
      },
      pending() { return [...pendingByKey.values()]; },
      markRetried(idempotencyKey) {
        const operation = pendingByKey.get(idempotencyKey);
        if (!operation) return null;
        const retried = retryOperation(operation);
        const candidatePending = new Map(pendingByKey);
        candidatePending.set(idempotencyKey, retried);
        commit(candidatePending, new Map(acknowledgements));
        return retried;
      },
      acknowledge(idempotencyKey, acknowledgement) {
        const operation = pendingByKey.get(idempotencyKey);
        if (!operation) return false;
        const candidatePending = new Map(pendingByKey);
        const candidateAcknowledgements = new Map(acknowledgements);
        candidatePending.delete(idempotencyKey);
        candidateAcknowledgements.set(idempotencyKey, acknowledgementFor(operation, acknowledgement));
        while (candidateAcknowledgements.size > acknowledgementLimit) candidateAcknowledgements.delete(candidateAcknowledgements.keys().next().value);
        commit(candidatePending, candidateAcknowledgements);
        return true;
      },
      replace(idempotencyKey, replacement, acknowledgement = {}) {
        const operation = pendingByKey.get(idempotencyKey);
        if (!operation) return false;
        const validReplacement = replacement == null ? null : validPersistedOperation(replacement);
        if (replacement != null && !validReplacement) throw new TypeError('A valid replacement cloud operation is required.');
        if (validReplacement && (validReplacement.owner.accountId !== operation.owner.accountId
          || validReplacement.owner.profileId !== operation.owner.profileId
          || validReplacement.entityType !== operation.entityType
          || validReplacement.entityId !== operation.entityId)) {
          throw new Error('A queued conflict may only be replaced by the same owned logical entity.');
        }
        if (validReplacement && validReplacement.idempotencyKey !== idempotencyKey
          && pendingByKey.has(validReplacement.idempotencyKey)) return false;
        const candidatePending = new Map(pendingByKey);
        const candidateAcknowledgements = new Map(acknowledgements);
        candidatePending.delete(idempotencyKey);
        candidateAcknowledgements.set(idempotencyKey, acknowledgementFor(operation, acknowledgement));
        if (validReplacement && !candidateAcknowledgements.has(validReplacement.idempotencyKey)) {
          candidatePending.set(validReplacement.idempotencyKey, validReplacement);
        }
        while (candidateAcknowledgements.size > acknowledgementLimit) candidateAcknowledgements.delete(candidateAcknowledgements.keys().next().value);
        commit(candidatePending, candidateAcknowledgements);
        return validReplacement || true;
      },
      acknowledgement(idempotencyKey) { return acknowledgements.get(idempotencyKey) || null; },
      snapshot() {
        return clone({ version: 1, pending: [...pendingByKey.values()], acknowledgements: [...acknowledgements.values()] });
      }
    });
  }

  function revision(value) {
    return {
      version: Number.isSafeInteger(Number(value?.version)) ? Number(value.version) : 0,
      updatedAt: Number.isFinite(Date.parse(value?.updatedAt)) ? Date.parse(value.updatedAt) : 0,
      tombstone: value?.tombstone === true || value?.mutation === 'delete'
    };
  }

  function resolveConflict({ local, remote, entityType }) {
    if (!local) return Object.freeze({ winner: 'remote', applyRemote: Boolean(remote), reason: 'local-missing' });
    if (!remote) return Object.freeze({ winner: 'local', applyRemote: false, reason: 'remote-missing' });
    assertImmutableOwnership(local.owner, remote.owner);
    if (local.entityId !== remote.entityId || local.entityType !== remote.entityType || local.entityType !== entityType) {
      throw new Error('Conflicts may only compare the same owned entity.');
    }

    const localRevision = revision(local);
    const remoteRevision = revision(remote);
    if (remoteRevision.version < localRevision.version) {
      return Object.freeze({ winner: 'local', applyRemote: false, reason: 'stale-remote-version' });
    }
    if (remoteRevision.version > localRevision.version) {
      return Object.freeze({ winner: 'remote', applyRemote: true, reason: remoteRevision.tombstone ? 'newer-remote-tombstone' : 'newer-remote-version' });
    }
    if (remoteRevision.updatedAt < localRevision.updatedAt) {
      return Object.freeze({ winner: 'local', applyRemote: false, reason: 'stale-remote-timestamp' });
    }
    if (remoteRevision.updatedAt > localRevision.updatedAt) {
      return Object.freeze({ winner: 'remote', applyRemote: true, reason: remoteRevision.tombstone ? 'newer-remote-tombstone' : 'newer-remote-timestamp' });
    }
    if (localRevision.tombstone !== remoteRevision.tombstone) {
      return Object.freeze({
        winner: localRevision.tombstone ? 'local' : 'remote',
        applyRemote: remoteRevision.tombstone,
        reason: 'tombstone-wins-tie'
      });
    }
    return Object.freeze({ winner: 'local', applyRemote: false, reason: entityType === 'workouts' ? 'append-only-local-tie' : 'equal-revision-local-tie' });
  }

  function createDisabledTransport(reason = 'phase-4b-disabled') {
    return Object.freeze({
      enabled: false,
      reason,
      async send() {
        return Object.freeze({ ok: false, disabled: true, reason });
      }
    });
  }

  function createLocalFirstCoordinator({ owner, persistLocal, queue = createMemoryQueue(), transport = createDisabledTransport() }) {
    const immutableOwner = normalizeOwner(owner);
    if (typeof persistLocal !== 'function') throw new TypeError('A local persistence function is required.');
    return Object.freeze({
      owner: immutableOwner,
      queue,
      transport,
      async mutate(input) {
        const operation = createOperation({ ...input, owner: immutableOwner });
        await persistLocal(clone(input.localValue), operation);
        queue.enqueue(operation);
        return operation;
      },
      async syncQuietly({ online = typeof navigator === 'undefined' ? true : navigator.onLine } = {}) {
        if (!online) return Object.freeze({ ok: false, offline: true, sent: 0 });
        if (!transport.enabled) return Object.freeze({ ok: true, disabled: true, sent: 0, reason: transport.reason });
        let sent = 0;
        for (const operation of queue.pending()) {
          let response;
          try { response = await transport.send(operation); } catch (error) {
            response = { ok: false, error: error?.message || 'transport-failed' };
          }
          if (!response?.ok) {
            queue.markRetried(operation.idempotencyKey);
            continue;
          }
          queue.acknowledge(operation.idempotencyKey, response);
          sent += 1;
        }
        return Object.freeze({ ok: true, sent });
      }
    });
  }

  function readSafeConfig() {
    const source = isRecord(window.__BIG_GAINS_CLOUD_CONFIG__) ? window.__BIG_GAINS_CLOUD_CONFIG__ : {};
    return Object.freeze({
      hasUrl: typeof source.supabaseUrl === 'string' && source.supabaseUrl.length > 0,
      hasPublishableKey: typeof source.supabasePublishableKey === 'string' && source.supabasePublishableKey.length > 0
    });
  }

  const config = readSafeConfig();
  const disabledReason = config.hasUrl && config.hasPublishableKey
    ? 'phase-4c-awaiting-auth'
    : 'supabase-not-configured';

  window.BigGainsCloud = Object.freeze({
    contractVersion: CONTRACT_VERSION,
    entityTypes: ENTITY_TYPES,
    enabled: false,
    config,
    transport: createDisabledTransport(disabledReason),
    status: () => Object.freeze({ enabled: false, configured: config.hasUrl && config.hasPublishableKey, reason: disabledReason }),
    canonicalize,
    stableHash,
    normalizeOwner,
    assertImmutableOwnership,
    createOperation,
    idempotencyKeyFor,
    retryOperation,
    createMemoryQueue,
    createDurableQueue,
    durableQueueKey: DURABLE_QUEUE_KEY,
    resolveConflict,
    createDisabledTransport,
    createLocalFirstCoordinator
  });
})();
