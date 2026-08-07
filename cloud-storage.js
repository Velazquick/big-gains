(() => {
  'use strict';

  const CONTRACT_VERSION = 1;
  const ENTITY_TYPES = Object.freeze([
    'workouts',
    'routines',
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
      contractVersion: CONTRACT_VERSION,
      owner: normalizeOwner(input.owner),
      entityType: input.entityType,
      entityId: input.entityId,
      mutation: input.mutation,
      version: input.version,
      updatedAt: input.updatedAt,
      payload: input.mutation === 'delete' ? null : input.payload ?? null
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
        acknowledgements.set(idempotencyKey, Object.freeze({
          idempotencyKey,
          remoteVersion: acknowledgement?.remoteVersion ?? operation.version,
          acknowledgedAt: acknowledgement?.acknowledgedAt || new Date().toISOString()
        }));
        return true;
      },
      acknowledgement(idempotencyKey) {
        return acknowledgements.get(idempotencyKey) || null;
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
          const response = await transport.send(operation);
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
    ? 'phase-4b-transport-not-implemented'
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
    resolveConflict,
    createDisabledTransport,
    createLocalFirstCoordinator
  });
})();
