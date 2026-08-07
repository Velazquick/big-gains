(() => {
  'use strict';

  const cloud = window.BigGainsCloud;
  const shadow = window.BigGainsCloudShadow;
  const supabaseBoundary = window.BigGainsSupabase;
  const accountRuntime = window.bigGainsAccounts.runtime;
  const queue = cloud.createDurableQueue({ key: accountRuntime.cloudKeys.queue });
  const CATALOG_KEY = accountRuntime.cloudKeys.catalog;
  const COMPARISON_KEY = accountRuntime.cloudKeys.comparison;
  let initialized = false;
  let authSubscription = null;
  let cloudOwner = null;
  let busy = false;
  let comparing = false;
  let lastResult = null;
  let lastComparison = readJson(COMPARISON_KEY);
  let catalog = readJson(CATALOG_KEY);
  let captureChain = Promise.resolve();

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

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
    return Boolean(catalog
      && owner?.account?.id === catalog.accountId
      && owner?.account?.owner_user_id === catalog.authUserId
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

  async function captureLocalSnapshot(profileClientId) {
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
        window.setTimeout(() => flush(), 0);
      }
      return Object.freeze({ queued, pending: queue.pending().length });
    }).catch(error => {
      lastResult = { ok: false, reason: 'capture-failed', error: error?.message || String(error), pending: queue.pending().length };
      render();
      return Object.freeze({ queued: 0, reason: 'capture-failed' });
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
        for (const operation of operations()) {
          let response;
          try { response = await transport.send(operation); } catch (error) {
            response = { ok: false, reason: 'transport-threw', error: error?.message || String(error) };
          }
          if (!response?.ok) {
            durableQueue.markRetried(operation.idempotencyKey);
            failed += 1;
            blocked ||= response?.blocked === true;
            continue;
          }
          durableQueue.acknowledge(operation.idempotencyKey, response);
          sent += 1;
        }
        return Object.freeze({ ok: failed === 0, sent, failed, blocked, pending: durableQueue.pending().length });
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
    comparing = true;
    render();
    try {
      const repository = shadow.createRepository({ client: supabaseBoundary.getClient(), accountId: cloudOwner.account.id });
      const remote = await repository.readAll();
      const journal = shadow.completedMigrationJournal(remote.journals, cloudOwner.account.id);
      if (accountRuntime.kind === 'managed' && !journal) {
        throw Object.assign(new Error('The completed Phase 4E baseline journal was not found.'), { code: 'baseline-missing' });
      }
      const cloudState = await shadow.reconstructCloud({ ...remote, profiles: cloudOwner.profiles, accountId: cloudOwner.account.id });
      const localProfiles = await shadow.readLocalProfiles();
      const comparison = await shadow.compare({ localProfiles, cloud: cloudState, expectedCatalog: catalog });
      lastComparison = comparison;
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
      if (comparison.parity && (!catalog || adopt)) {
        catalog = shadow.catalogFromCloud({ cloud: cloudState, owner: cloudOwner, journal });
        writeJson(CATALOG_KEY, catalog);
      } else if (accountRuntime.kind === 'independent' && !catalog
        && shadow.profileIds.every(profileClientId => cloudState.profiles[profileClientId].current.length === 0)) {
        catalog = shadow.emptyCatalogFromOwner(cloudOwner);
        writeJson(CATALOG_KEY, catalog);
        await Promise.all(shadow.profileIds.map(profileClientId => captureLocalSnapshot(profileClientId)));
      }
      return comparison;
    } catch (error) {
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
    const owner = await supabaseBoundary.readCloudAccount();
    if (owner.account.owner_user_id !== session.user.id) throw new Error('Signed-in account ownership could not be verified.');
    if (!window.bigGainsAccounts.matchesCloudOwner(owner, session.user.id)) {
      throw new Error('Signed-in account does not match this device runtime. Reload after account verification.');
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
      const transport = createProductionTransport({ client: supabaseBoundary.getClient(), owner: cloudOwner });
      lastResult = await createSyncRuntime({ durableQueue: queue, transport, operations: ownedOperations }).flush();
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

  function cardMarkup() {
    if (!supabaseBoundary.configured) {
      return '<span class="label">Cloud shadow</span><h3>Not configured</h3><p>Training stays local on this device.</p>';
    }
    return `<span class="label">Cloud shadow</span><h3 id="cloudShadowHeading">Checking quietly…</h3>
      <p id="cloudAuthDetail">Training stays local while the cloud copy is checked.</p>
      <div id="cloudShadowProfiles" class="cloud-shadow-profiles" hidden></div>
      <details id="cloudShadowDrift" class="cloud-shadow-drift" hidden><summary>What needs attention</summary><ul id="cloudShadowDriftList"></ul></details>
      <form id="cloudAuthForm" class="cloud-auth-form" hidden>
        <label><span>Email</span><input id="cloudAuthEmail" type="email" autocomplete="email" required></label>
        <button class="secondary" type="submit">Email sign-in link</button>
      </form>
      <div class="data-actions"><button id="cloudSyncNow" class="secondary" type="button" hidden>Check now</button><button id="cloudSignOut" class="ghost" type="button" hidden>Sign out</button></div>
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
    const signOutButton = document.getElementById('cloudSignOut');
    const queueStatus = document.getElementById('cloudQueueStatus');
    const profileBox = document.getElementById('cloudShadowProfiles');
    const drift = document.getElementById('cloudShadowDrift');
    const driftList = document.getElementById('cloudShadowDriftList');
    let session = null;
    try { session = await supabaseBoundary.session(); } catch {}
    const pending = queue.pending().length;
    let state = 'CHECKING';
    if (!session) state = online() ? 'SIGNED OUT' : 'OFFLINE';
    else if (lastResult?.blocked || (!pending && lastComparison?.parity === false)) state = 'DRIFT DETECTED';
    else if (pending && lastResult?.ok === false) state = 'CLOUD BEHIND / RETRYING';
    else if (pending) state = 'LOCAL CHANGES PENDING';
    else if (lastComparison?.parity === true) state = 'IN SYNC';
    heading.textContent = state === 'IN SYNC' ? 'In sync' : state;
    const profileNames = shadow.profileIds.map(id => window.bigGainsAccounts.registry.resolve(id)?.displayName || id);
    detail.textContent = state === 'IN SYNC' ? `${profileNames.join(' and ')} ${profileNames.length === 1 ? 'matches' : 'match'} the private cloud shadow.`
      : state === 'LOCAL CHANGES PENDING' ? `${pending} change${pending === 1 ? '' : 's'} waiting for connection.`
        : state === 'CLOUD BEHIND / RETRYING' ? 'Cloud is catching up. Training stays local.'
          : state === 'DRIFT DETECTED' ? 'Drift detected — local data is unchanged.'
            : state === 'OFFLINE' ? 'Offline. Training stays local.'
              : state === 'SIGNED OUT' ? 'Signed-out training stays local. Sign in to compare the cloud shadow.'
                : 'Checking the private cloud copy.';
    form.hidden = Boolean(session);
    syncButton.hidden = !session;
    syncButton.disabled = busy || comparing;
    signOutButton.hidden = !session;
    queueStatus.textContent = `${pending} outbound change${pending === 1 ? '' : 's'} pending${lastComparison?.comparedAt ? ` · Last checked ${new Date(lastComparison.comparedAt).toLocaleString()}` : ''}.`;
    const profileResults = lastComparison?.profiles;
    profileBox.hidden = !profileResults;
    if (profileResults) profileBox.innerHTML = shadow.profileIds.map(id => `<span><strong>${window.bigGainsAccounts.registry.resolve(id)?.displayName || id}</strong>${profileResults[id]?.parity ? 'In sync' : 'Needs attention'}</span>`).join('');
    const reasons = lastComparison?.reasons || [];
    drift.hidden = state !== 'DRIFT DETECTED' || reasons.length === 0;
    driftList.innerHTML = reasons.map(reason => `<li>${String(reason).replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character])}</li>`).join('');
  }

  async function handleSignedIn() {
    try {
      cloudOwner = await verifiedOwnerForSession();
      await compareShadow({ adopt: !catalog });
      if (catalog) await flush();
    } catch (error) {
      lastResult = { ok: false, blocked: true, error: error?.message || String(error), pending: queue.pending().length };
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
        await supabaseBoundary.requestMagicLink(document.getElementById('cloudAuthEmail').value);
        document.getElementById('cloudAuthDetail').textContent = 'Check your email for the private sign-in link.';
      } catch (error) {
        document.getElementById('cloudAuthDetail').textContent = error?.message || 'Sign-in link could not be sent.';
      }
    });
    document.getElementById('cloudSyncNow')?.addEventListener('click', flush);
    document.getElementById('cloudSignOut')?.addEventListener('click', async () => {
      try { await supabaseBoundary.signOut(); } catch {}
      cloudOwner = null;
      render();
    });
    authSubscription = supabaseBoundary.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) window.setTimeout(handleSignedIn, 0);
      if (event === 'SIGNED_OUT') { cloudOwner = null; render(); }
    });
    window.addEventListener('online', () => flush());
    render().then(async () => { if (await supabaseBoundary.session()) await handleSignedIn(); });
    return true;
  }

  window.BigGainsCloudSync = Object.freeze({
    initialize,
    queue,
    flush,
    compareShadow,
    captureLocalSnapshot,
    enqueueSyntheticCompletedWorkout,
    createCompletedWorkoutTransport,
    createProductionTransport,
    createSyncRuntime,
    catalogKey: CATALOG_KEY,
    comparisonKey: COMPARISON_KEY,
    status: () => Object.freeze({
      configured: supabaseBoundary.configured,
      initialized,
      syntheticOnly: false,
      pending: queue.pending().length,
      ownerReady: Boolean(cloudOwner),
      baselineAdopted: Boolean(catalog),
      busy,
      lastResult,
      lastComparison
    })
  });
})();
