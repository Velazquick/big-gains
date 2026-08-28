((scope) => {
  'use strict';

  const ENTITY_TYPE = 'program_domains';
  const CLIENT_ID = 'program-domain';
  const RPC_NAME = 'put_program_domain_guarded';
  const ROW_COLUMNS = [
    'id', 'account_id', 'profile_id', 'client_id', 'contract', 'contract_version',
    'payload', 'version', 'fingerprint', 'definitions_revision', 'definitions_fingerprint',
    'heads_revision', 'heads_fingerprint', 'sequence_revision', 'sequence_fingerprint',
    'idempotency_key', 'base_version', 'base_updated_at', 'base_fingerprint',
    'base_definitions_revision', 'base_definitions_fingerprint', 'base_heads_revision',
    'base_heads_fingerprint', 'base_sequence_revision', 'base_sequence_fingerprint',
    'created_at', 'updated_at'
  ].join(',');

  const REASON_CODES = Object.freeze({
    UNSUPPORTED: 'PROGRAM_DOMAIN_UNSUPPORTED',
    SERIALIZATION_FAILED: 'PROGRAM_DOMAIN_SERIALIZATION_FAILED',
    STALE_BASE: 'PROGRAM_DOMAIN_STALE_BASE',
    GUARD_REJECTED: 'PROGRAM_DOMAIN_GUARD_REJECTED',
    READBACK_MISSING: 'PROGRAM_DOMAIN_READBACK_MISSING',
    READBACK_MISMATCH: 'PROGRAM_DOMAIN_READBACK_MISMATCH',
    TRANSIENT_FAILURE: 'PROGRAM_DOMAIN_TRANSIENT_FAILURE',
    AUTH_REJECTED: 'PROGRAM_DOMAIN_AUTH_REJECTED',
    PREDECESSOR_UNRESOLVED: 'PROGRAM_DOMAIN_PREDECESSOR_UNRESOLVED'
  });

  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
  const fingerprint = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
  const revision = value => Number.isSafeInteger(value) && value >= 0;

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function result(value) {
    return deepFreeze(value);
  }

  function normalizedInstant(value) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
    return new Date(value).toISOString();
  }

  function field(value, camel, snake = null) {
    if (!isRecord(value)) return undefined;
    if (Object.hasOwn(value, camel)) return value[camel];
    return snake && Object.hasOwn(value, snake) ? value[snake] : undefined;
  }

  function normalizeAcceptedBase(value, { accountId, profileId }) {
    if (value == null) return null;
    const baseAccountId = field(value, 'accountId', 'account_id') ?? accountId;
    const baseProfileId = field(value, 'profileId', 'profile_id') ?? profileId;
    const baseClientId = field(value, 'clientId', 'client_id') ?? CLIENT_ID;
    const acceptedUpdatedAt = normalizedInstant(field(value, 'updatedAt', 'updated_at'));
    const normalized = {
      accountId: baseAccountId,
      profileId: baseProfileId,
      clientId: baseClientId,
      version: field(value, 'version'),
      updatedAt: acceptedUpdatedAt,
      fingerprint: field(value, 'fingerprint'),
      definitionsRevision: field(value, 'definitionsRevision', 'definitions_revision'),
      definitionsFingerprint: field(value, 'definitionsFingerprint', 'definitions_fingerprint'),
      headsRevision: field(value, 'headsRevision', 'heads_revision'),
      headsFingerprint: field(value, 'headsFingerprint', 'heads_fingerprint'),
      sequenceRevision: field(value, 'sequenceRevision', 'sequence_revision'),
      sequenceFingerprint: field(value, 'sequenceFingerprint', 'sequence_fingerprint')
    };
    if (normalized.accountId !== accountId || normalized.profileId !== profileId
      || normalized.clientId !== CLIENT_ID
      || !Number.isSafeInteger(normalized.version) || normalized.version < 1
      || !acceptedUpdatedAt || !fingerprint(normalized.fingerprint)
      || !revision(normalized.definitionsRevision) || !fingerprint(normalized.definitionsFingerprint)
      || !revision(normalized.headsRevision) || !fingerprint(normalized.headsFingerprint)
      || !revision(normalized.sequenceRevision) || !fingerprint(normalized.sequenceFingerprint)) {
      throw new TypeError(REASON_CODES.STALE_BASE);
    }
    return result(normalized);
  }

  function baseFromOperation(operation) {
    if (!isProgramDomainOperation(operation)) throw new TypeError(REASON_CODES.STALE_BASE);
    return result({
      accountId: operation.owner.accountId,
      profileId: operation.owner.profileId,
      clientId: CLIENT_ID,
      version: operation.version,
      updatedAt: operation.updatedAt,
      fingerprint: operation.payloadFingerprint,
      definitionsRevision: operation.programDomain.definitionsRevision,
      definitionsFingerprint: operation.programDomain.definitionsFingerprint,
      headsRevision: operation.programDomain.headsRevision,
      headsFingerprint: operation.programDomain.headsFingerprint,
      sequenceRevision: operation.programDomain.sequenceRevision,
      sequenceFingerprint: operation.programDomain.sequenceFingerprint
    });
  }

  function sameIdentity(left, right) {
    return Boolean(left && right
      && left.version === right.version
      && left.updatedAt === right.updatedAt
      && left.fingerprint === right.fingerprint
      && left.definitionsRevision === right.definitionsRevision
      && left.definitionsFingerprint === right.definitionsFingerprint
      && left.headsRevision === right.headsRevision
      && left.headsFingerprint === right.headsFingerprint
      && left.sequenceRevision === right.sequenceRevision
      && left.sequenceFingerprint === right.sequenceFingerprint);
  }

  function sameProfile(operation, accountId, profileId) {
    return operation?.entityType === ENTITY_TYPE
      && operation?.entityId === CLIENT_ID
      && operation?.owner?.accountId === accountId
      && operation?.owner?.profileId === profileId;
  }

  function isProgramDomainOperation(operation) {
    return Boolean(sameProfile(operation, operation?.owner?.accountId, operation?.owner?.profileId)
      && operation.mutation === 'upsert'
      && isRecord(operation.programDomain)
      && operation.programDomain.clientId === CLIENT_ID
      && typeof operation.programDomain.payloadCanonical === 'string');
  }

  function componentRevisions(envelope) {
    if (Object.keys(envelope).length === 0) return { definitions: 0, heads: 0, sequence: 0 };
    return {
      definitions: envelope.definitionsRevision,
      heads: envelope.headsRevision,
      sequence: envelope.sequenceRevision
    };
  }

  function nextRevisions(base, componentHashes, initialEnvelope) {
    if (!base) return componentRevisions(initialEnvelope);
    return {
      definitions: base.definitionsRevision + (componentHashes.definitionsFingerprint !== base.definitionsFingerprint ? 1 : 0),
      heads: base.headsRevision + (componentHashes.headsFingerprint !== base.headsFingerprint ? 1 : 0),
      sequence: base.sequenceRevision + (componentHashes.sequenceFingerprint !== base.sequenceFingerprint ? 1 : 0)
    };
  }

  function noSemanticChange(base, componentHashes) {
    return Boolean(base
      && componentHashes.definitionsFingerprint === base.definitionsFingerprint
      && componentHashes.headsFingerprint === base.headsFingerprint
      && componentHashes.sequenceFingerprint === base.sequenceFingerprint);
  }

  function queuedPredecessor(queue, base, accountId, profileId) {
    const pending = queue.pending().filter(operation => sameProfile(operation, accountId, profileId));
    if (!pending.length) return null;
    if (!base) throw new TypeError(REASON_CODES.STALE_BASE);
    const exact = pending.find(operation => sameIdentity(baseFromOperation(operation), base));
    if (!exact) throw new TypeError(REASON_CODES.STALE_BASE);
    return exact;
  }

  async function enqueueProgramDomain({
    accountId,
    profileId,
    scope: envelopeScope = { accountId, profileId },
    programCapture,
    acceptedBase = null,
    lastTransition = null,
    catalog = null,
    updatedAt = null,
    queue,
    envelopeApi = scope.BigGainsProgramDomainEnvelope,
    cloudApi = scope.BigGainsCloud,
    now = () => new Date().toISOString()
  } = {}) {
    if (!nonempty(accountId) || !nonempty(profileId)
      || !nonempty(envelopeScope?.accountId) || !nonempty(envelopeScope?.profileId)
      || !queue?.enqueue || !queue?.pending
      || !envelopeApi?.build || !envelopeApi?.fingerprints || !cloudApi?.createOperation) {
      return result({ ok: false, enqueued: false, reasonCode: REASON_CODES.SERIALIZATION_FAILED });
    }
    try {
      const base = normalizeAcceptedBase(acceptedBase, { accountId, profileId });
      const initialEnvelope = await envelopeApi.build({
        accountId: envelopeScope.accountId, profileId: envelopeScope.profileId,
        programCapture, catalog, lastTransition
      });
      const initialHashes = await envelopeApi.fingerprints(initialEnvelope, {
        accountId: envelopeScope.accountId, profileId: envelopeScope.profileId,
        revisions: componentRevisions(initialEnvelope)
      });
      if (noSemanticChange(base, initialHashes)) {
        return result({ ok: true, enqueued: false, noOp: true, reasonCode: null, operation: null });
      }
      if (base && Object.keys(initialEnvelope).length === 0
        && (base.definitionsRevision > 0 || base.headsRevision > 0 || base.sequenceRevision > 0)) {
        throw new TypeError(REASON_CODES.SERIALIZATION_FAILED);
      }
      const revisions = nextRevisions(base, initialHashes, initialEnvelope);
      const envelope = await envelopeApi.build({
        accountId: envelopeScope.accountId, profileId: envelopeScope.profileId,
        programCapture, catalog, revisions, lastTransition
      });
      const hashes = await envelopeApi.fingerprints(envelope, {
        accountId: envelopeScope.accountId, profileId: envelopeScope.profileId, revisions
      });
      const predecessor = queuedPredecessor(queue, base, accountId, profileId);
      const operationUpdatedAt = updatedAt || now();
      if (normalizedInstant(operationUpdatedAt) !== operationUpdatedAt) {
        throw new TypeError(REASON_CODES.SERIALIZATION_FAILED);
      }
      const version = base ? base.version + 1 : 1;
      const payload = clone(envelope);
      const operation = cloudApi.createOperation({
        owner: { accountId, profileId },
        entityType: ENTITY_TYPE,
        entityId: CLIENT_ID,
        mutation: 'upsert',
        version,
        updatedAt: operationUpdatedAt,
        payload,
        payloadFingerprint: hashes.fingerprint,
        baseRevision: base ? {
          version: base.version,
          updatedAt: base.updatedAt,
          fingerprint: base.fingerprint,
          tombstone: false
        } : null,
        programDomain: {
          clientId: CLIENT_ID,
          envelopeScope: clone(envelopeScope),
          payloadCanonical: envelopeApi.canonicalize(envelope),
          definitionsRevision: hashes.definitionsRevision,
          definitionsFingerprint: hashes.definitionsFingerprint,
          headsRevision: hashes.headsRevision,
          headsFingerprint: hashes.headsFingerprint,
          sequenceRevision: hashes.sequenceRevision,
          sequenceFingerprint: hashes.sequenceFingerprint,
          manifest: hashes.manifest,
          acceptedBase: base,
          predecessorIdempotencyKey: predecessor?.idempotencyKey || null
        }
      });
      const persisted = queue.enqueue(operation);
      return result({ ok: true, enqueued: true, noOp: false, reasonCode: null, operation: persisted });
    } catch (error) {
      const reasonCode = error?.message === REASON_CODES.STALE_BASE
        ? REASON_CODES.STALE_BASE
        : REASON_CODES.SERIALIZATION_FAILED;
      return result({ ok: false, enqueued: false, reasonCode });
    }
  }

  function rpcArguments(operation) {
    const base = operation.programDomain.acceptedBase;
    return result({
      target_profile_id: operation.owner.profileId,
      expected_version: base?.version ?? null,
      expected_updated_at: base?.updatedAt ?? null,
      expected_fingerprint: base?.fingerprint ?? null,
      expected_definitions_revision: base?.definitionsRevision ?? null,
      expected_definitions_fingerprint: base?.definitionsFingerprint ?? null,
      expected_heads_revision: base?.headsRevision ?? null,
      expected_heads_fingerprint: base?.headsFingerprint ?? null,
      expected_sequence_revision: base?.sequenceRevision ?? null,
      expected_sequence_fingerprint: base?.sequenceFingerprint ?? null,
      next_version: operation.version,
      next_updated_at: operation.updatedAt,
      next_payload: clone(operation.payload),
      next_fingerprint: operation.payloadFingerprint,
      next_definitions_revision: operation.programDomain.definitionsRevision,
      next_definitions_fingerprint: operation.programDomain.definitionsFingerprint,
      next_heads_revision: operation.programDomain.headsRevision,
      next_heads_fingerprint: operation.programDomain.headsFingerprint,
      next_sequence_revision: operation.programDomain.sequenceRevision,
      next_sequence_fingerprint: operation.programDomain.sequenceFingerprint,
      operation_idempotency_key: operation.idempotencyKey
    });
  }

  function errorCode(error) {
    return String(error?.code || error?.status || '').toUpperCase();
  }

  function classifyError(error) {
    const code = errorCode(error);
    const message = String(error?.message || '').toLowerCase();
    if (['42P01', '42883', 'PGRST202', 'PGRST205', '404'].includes(code)
      || message.includes('does not exist') || message.includes('schema cache')) return REASON_CODES.UNSUPPORTED;
    if (['42501', '401', '403', 'PGRST301'].includes(code)
      || message.includes('authentication required') || message.includes('access denied')) return REASON_CODES.AUTH_REJECTED;
    if (code === 'P0001' || message.includes('accepted base')
      || message.includes('initial program domain write must not name')) return REASON_CODES.STALE_BASE;
    if (code.startsWith('22') || code === '23514' || code === '23505') return REASON_CODES.GUARD_REJECTED;
    return REASON_CODES.TRANSIENT_FAILURE;
  }

  async function authenticate(client, verifyAuthenticated) {
    if (typeof verifyAuthenticated === 'function') {
      const verified = await verifyAuthenticated();
      return Boolean(verified?.id || verified === true);
    }
    if (typeof client?.auth?.getUser !== 'function') return false;
    const response = await client.auth.getUser();
    return Boolean(!response?.error && response?.data?.user?.id);
  }

  function rowBaseMatches(row, base) {
    const fields = [
      ['base_version', 'version'],
      ['base_updated_at', 'updatedAt'],
      ['base_fingerprint', 'fingerprint'],
      ['base_definitions_revision', 'definitionsRevision'],
      ['base_definitions_fingerprint', 'definitionsFingerprint'],
      ['base_heads_revision', 'headsRevision'],
      ['base_heads_fingerprint', 'headsFingerprint'],
      ['base_sequence_revision', 'sequenceRevision'],
      ['base_sequence_fingerprint', 'sequenceFingerprint']
    ];
    return fields.every(([rowField, baseField]) => row?.[rowField] === (base?.[baseField] ?? null));
  }

  async function verifyReadback(row, operation, envelopeApi) {
    const envelopeScope = operation.programDomain.envelopeScope || operation.owner;
    if (!isRecord(row)
      || row.account_id !== operation.owner.accountId
      || row.profile_id !== operation.owner.profileId
      || row.client_id !== CLIENT_ID
      || row.contract !== envelopeApi.contract
      || Number(row.contract_version) !== envelopeApi.contractVersion
      || Number(row.version) !== operation.version
      || normalizedInstant(row.updated_at) !== operation.updatedAt
      || row.fingerprint !== operation.payloadFingerprint
      || Number(row.definitions_revision) !== operation.programDomain.definitionsRevision
      || row.definitions_fingerprint !== operation.programDomain.definitionsFingerprint
      || Number(row.heads_revision) !== operation.programDomain.headsRevision
      || row.heads_fingerprint !== operation.programDomain.headsFingerprint
      || Number(row.sequence_revision) !== operation.programDomain.sequenceRevision
      || row.sequence_fingerprint !== operation.programDomain.sequenceFingerprint
      || row.idempotency_key !== operation.idempotencyKey
      || !rowBaseMatches(row, operation.programDomain.acceptedBase)
      || envelopeApi.canonicalize(row.payload) !== operation.programDomain.payloadCanonical) return false;
    try {
      const revisions = {
        definitions: operation.programDomain.definitionsRevision,
        heads: operation.programDomain.headsRevision,
        sequence: operation.programDomain.sequenceRevision
      };
      const validation = await envelopeApi.validate(row.payload, {
        accountId: envelopeScope.accountId,
        profileId: envelopeScope.profileId,
        revisions
      });
      if (!validation.ok) return false;
      const hashes = await envelopeApi.fingerprints(row.payload, {
        accountId: envelopeScope.accountId,
        profileId: envelopeScope.profileId,
        revisions
      });
      return hashes.fingerprint === operation.payloadFingerprint
        && hashes.definitionsFingerprint === operation.programDomain.definitionsFingerprint
        && hashes.headsFingerprint === operation.programDomain.headsFingerprint
        && hashes.sequenceFingerprint === operation.programDomain.sequenceFingerprint
        && envelopeApi.canonicalize(hashes.manifest) === envelopeApi.canonicalize(operation.programDomain.manifest);
    } catch {
      return false;
    }
  }

  function createTransport({
    client,
    enabled = false,
    verifyAuthenticated = null,
    envelopeApi = scope.BigGainsProgramDomainEnvelope
  } = {}) {
    const available = Boolean(enabled && client && envelopeApi);
    return result({
      enabled: available,
      reason: available ? null : REASON_CODES.UNSUPPORTED,
      async send(operation) {
        if (!available) return result({ ok: false, disabled: true, reasonCode: REASON_CODES.UNSUPPORTED });
        if (!isProgramDomainOperation(operation)) {
          return result({ ok: false, blocked: true, reasonCode: REASON_CODES.GUARD_REJECTED });
        }
        try {
          if (!await authenticate(client, verifyAuthenticated)) {
            return result({ ok: false, blocked: true, reasonCode: REASON_CODES.AUTH_REJECTED });
          }
        } catch {
          return result({ ok: false, blocked: true, reasonCode: REASON_CODES.AUTH_REJECTED });
        }
        let rpcResult;
        try {
          rpcResult = await client.rpc(RPC_NAME, rpcArguments(operation));
        } catch (error) {
          const reasonCode = classifyError(error);
          return result({ ok: false, blocked: reasonCode !== REASON_CODES.TRANSIENT_FAILURE, reasonCode });
        }
        if (rpcResult?.error) {
          const reasonCode = classifyError(rpcResult.error);
          return result({ ok: false, blocked: reasonCode !== REASON_CODES.TRANSIENT_FAILURE, reasonCode });
        }
        let readback;
        try {
          readback = await client.from(ENTITY_TYPE).select(ROW_COLUMNS)
            .eq('account_id', operation.owner.accountId)
            .eq('profile_id', operation.owner.profileId)
            .eq('client_id', CLIENT_ID)
            .maybeSingle();
        } catch (error) {
          const reasonCode = classifyError(error);
          return result({ ok: false, blocked: reasonCode !== REASON_CODES.TRANSIENT_FAILURE, reasonCode });
        }
        if (readback?.error) {
          const reasonCode = classifyError(readback.error);
          return result({ ok: false, blocked: reasonCode !== REASON_CODES.TRANSIENT_FAILURE, reasonCode });
        }
        if (!readback?.data) {
          return result({ ok: false, blocked: true, reasonCode: REASON_CODES.READBACK_MISSING });
        }
        if (!await verifyReadback(readback.data, operation, envelopeApi)) {
          return result({ ok: false, blocked: true, reasonCode: REASON_CODES.READBACK_MISMATCH });
        }
        const rpcRow = Array.isArray(rpcResult?.data) ? rpcResult.data[0] : rpcResult?.data;
        return result({
          ok: true,
          reasonCode: null,
          disposition: rpcRow?.already_applied === true ? 'already-applied' : 'applied-or-already-applied',
          remoteId: readback.data.id || null,
          remoteVersion: operation.version
        });
      }
    });
  }

  function orderingKey(operation) {
    return [operation.owner.accountId, operation.owner.profileId, String(operation.version).padStart(16, '0'), operation.queuedAt, operation.idempotencyKey]
      .join('\u0000');
  }

  function createQueueRuntime({ queue, transport }) {
    if (!queue?.pending || !queue?.acknowledge || !queue?.markRetried) {
      throw new TypeError('A durable queue is required.');
    }
    return result({
      async flush() {
        const programOperations = queue.pending().filter(isProgramDomainOperation).sort((left, right) =>
          orderingKey(left).localeCompare(orderingKey(right)));
        if (!transport?.enabled) {
          return result({
            ok: false,
            disabled: true,
            reasonCode: REASON_CODES.UNSUPPORTED,
            sent: 0,
            failed: 0,
            deferred: programOperations.length,
            pending: programOperations.length
          });
        }
        let sent = 0;
        let failed = 0;
        let deferred = 0;
        const failures = [];
        const blockedProfiles = new Set();
        for (const operation of programOperations) {
          const profileKey = `${operation.owner.accountId}\u0000${operation.owner.profileId}`;
          if (blockedProfiles.has(profileKey)) {
            deferred += 1;
            continue;
          }
          const earlierPending = queue.pending().some(candidate => sameProfile(
            candidate, operation.owner.accountId, operation.owner.profileId
          ) && candidate.version < operation.version);
          if (earlierPending) {
            blockedProfiles.add(profileKey);
            deferred += 1;
            continue;
          }
          const predecessorKey = operation.programDomain.predecessorIdempotencyKey;
          if (predecessorKey && !queue.acknowledgement(predecessorKey)) {
            blockedProfiles.add(profileKey);
            deferred += 1;
            failures.push(result({
              idempotencyKey: operation.idempotencyKey,
              version: operation.version,
              reasonCode: REASON_CODES.PREDECESSOR_UNRESOLVED,
              blocked: true
            }));
            continue;
          }
          let response;
          try {
            response = await transport.send(operation);
          } catch {
            response = { ok: false, blocked: false, reasonCode: REASON_CODES.TRANSIENT_FAILURE };
          }
          if (!response?.ok) {
            queue.markRetried(operation.idempotencyKey);
            blockedProfiles.add(profileKey);
            failed += 1;
            failures.push(result({
              idempotencyKey: operation.idempotencyKey,
              version: operation.version,
              reasonCode: response?.reasonCode || REASON_CODES.TRANSIENT_FAILURE,
              blocked: response?.blocked === true
            }));
            continue;
          }
          queue.acknowledge(operation.idempotencyKey, response);
          sent += 1;
        }
        const pending = queue.pending().filter(isProgramDomainOperation).length;
        return result({
          ok: failed === 0 && failures.length === 0,
          sent,
          failed,
          deferred,
          reasonCode: failures[0]?.reasonCode || null,
          failures,
          pending
        });
      }
    });
  }

  function createService({
    queue,
    client = null,
    enabled = false,
    verifyAuthenticated = null,
    envelopeApi = scope.BigGainsProgramDomainEnvelope,
    cloudApi = scope.BigGainsCloud,
    now = () => new Date().toISOString()
  } = {}) {
    const transport = createTransport({ client, enabled, verifyAuthenticated, envelopeApi });
    const runtime = createQueueRuntime({ queue, transport });
    return result({
      enabled: transport.enabled,
      queue,
      transport,
      enqueueProgramDomain(input) {
        return enqueueProgramDomain({ ...input, queue, envelopeApi, cloudApi, now });
      },
      flush: runtime.flush
    });
  }

  scope.BigGainsProgramDomainSync = Object.freeze({
    entityType: ENTITY_TYPE,
    clientId: CLIENT_ID,
    rpcName: RPC_NAME,
    reasonCodes: REASON_CODES,
    enqueueProgramDomain,
    baseFromOperation,
    rpcArguments,
    verifyReadback,
    createTransport,
    createQueueRuntime,
    createService,
    isProgramDomainOperation
  });
})(typeof window === 'object' ? window : globalThis);
