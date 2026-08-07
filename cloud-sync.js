(() => {
  'use strict';

  const cloud = window.BigGainsCloud;
  const supabaseBoundary = window.BigGainsSupabase;
  const queue = cloud.createDurableQueue();
  let initialized = false;
  let authSubscription = null;
  let cloudOwner = null;
  let busy = false;
  let lastResult = null;

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
        if (!inserted.error) {
          return Object.freeze({ ok: true, remoteId: inserted.data.id, remoteVersion: inserted.data.version });
        }
        if (inserted.error.code !== '23505') {
          return Object.freeze({ ok: false, reason: 'remote-insert-failed', error: inserted.error.message });
        }
        const existing = await client.from('workouts')
          .select('id,version,idempotency_key')
          .eq('account_id', operation.owner.accountId)
          .eq('profile_id', operation.owner.profileId)
          .eq('client_id', operation.entityId)
          .maybeSingle();
        if (existing.error || !existing.data || existing.data.idempotency_key !== operation.idempotencyKey) {
          return Object.freeze({ ok: false, reason: 'idempotency-conflict', error: existing.error?.message || null });
        }
        return Object.freeze({
          ok: true,
          duplicate: true,
          remoteId: existing.data.id,
          remoteVersion: existing.data.version
        });
      }
    });
  }

  function createSyncRuntime({ durableQueue, transport, isOnline = () => navigator.onLine }) {
    return Object.freeze({
      async flush() {
        if (!isOnline()) return Object.freeze({ ok: false, offline: true, sent: 0, pending: durableQueue.pending().length });
        if (!transport.enabled) return Object.freeze({ ok: true, disabled: true, sent: 0, pending: durableQueue.pending().length, reason: transport.reason });
        let sent = 0;
        let failed = 0;
        for (const operation of durableQueue.pending()) {
          let response;
          try { response = await transport.send(operation); } catch (error) {
            response = { ok: false, reason: 'transport-threw', error: error?.message || String(error) };
          }
          if (!response?.ok) {
            durableQueue.markRetried(operation.idempotencyKey);
            failed += 1;
            continue;
          }
          durableQueue.acknowledge(operation.idempotencyKey, response);
          sent += 1;
        }
        return Object.freeze({ ok: failed === 0, sent, failed, pending: durableQueue.pending().length });
      }
    });
  }

  async function enqueueSyntheticCompletedWorkout({ owner, workout, persistLocal }) {
    if (typeof persistLocal !== 'function') throw new TypeError('Synthetic proof requires an explicit local persistence function.');
    if (!workout?.id || !Number.isFinite(Date.parse(workout?.completedAt))) throw new TypeError('A completed synthetic workout is required.');
    const operation = cloud.createOperation({
      owner,
      entityType: 'workouts',
      entityId: workout.id,
      mutation: 'upsert',
      version: Number.isSafeInteger(workout.version) ? workout.version : 1,
      updatedAt: workout.updatedAt || workout.completedAt,
      payload: workout,
      synthetic: true
    });
    await persistLocal(JSON.parse(JSON.stringify(workout)), operation);
    queue.enqueue(operation);
    render();
    return operation;
  }

  async function flush() {
    if (busy) return Object.freeze({ ok: false, busy: true, sent: 0, pending: queue.pending().length });
    busy = true;
    render();
    try {
      const session = await supabaseBoundary.session();
      const client = session ? supabaseBoundary.getClient() : null;
      const runtime = createSyncRuntime({ durableQueue: queue, transport: createCompletedWorkoutTransport({ client }) });
      lastResult = await runtime.flush();
      return lastResult;
    } catch (error) {
      lastResult = Object.freeze({ ok: false, sent: 0, pending: queue.pending().length, error: error?.message || String(error) });
      return lastResult;
    } finally {
      busy = false;
      render();
    }
  }

  function cardMarkup() {
    if (!supabaseBoundary.configured) {
      return '<span class="label">Private cloud</span><h3>Not configured</h3><p>Local workouts continue normally. Phase 4C cloud requests are disabled.</p>';
    }
    return `<span class="label">Private cloud</span><h3 id="cloudAuthHeading">Checking Jorge’s sign-in…</h3>
      <p id="cloudAuthDetail">Local workout logging is always available.</p>
      <form id="cloudAuthForm" class="cloud-auth-form" hidden>
        <label><span>Jorge’s email</span><input id="cloudAuthEmail" type="email" autocomplete="email" required></label>
        <button class="secondary" type="submit">Email sign-in link</button>
      </form>
      <div class="data-actions"><button id="cloudSyncNow" class="secondary" type="button" hidden>Retry synthetic queue</button><button id="cloudSignOut" class="ghost" type="button" hidden>Sign out</button></div>
      <small id="cloudQueueStatus">${queue.pending().length} synthetic operation${queue.pending().length === 1 ? '' : 's'} queued.</small>`;
  }

  function ensureCard() {
    const panel = document.getElementById('settingsPanel');
    if (!panel || document.getElementById('cloudFoundationCard')) return;
    const card = document.createElement('section');
    card.id = 'cloudFoundationCard';
    card.className = 'cloud-foundation-card';
    card.innerHTML = cardMarkup();
    panel.insertAdjacentElement('afterend', card);
  }

  async function render() {
    ensureCard();
    const heading = document.getElementById('cloudAuthHeading');
    if (!heading) return;
    const detail = document.getElementById('cloudAuthDetail');
    const form = document.getElementById('cloudAuthForm');
    const syncButton = document.getElementById('cloudSyncNow');
    const signOutButton = document.getElementById('cloudSignOut');
    const queueStatus = document.getElementById('cloudQueueStatus');
    let currentSession = null;
    try { currentSession = await supabaseBoundary.session(); } catch {}
    heading.textContent = currentSession ? 'Signed in as Jorge' : 'Jorge sign-in';
    detail.textContent = currentSession
      ? 'Jorge’s account owns the Jorge and Alexa cloud profiles. Only synthetic workout sync is enabled.'
      : 'Signed-out use stays local. Existing Jorge and Alexa data is never uploaded by Phase 4C.';
    form.hidden = Boolean(currentSession);
    syncButton.hidden = !currentSession;
    syncButton.disabled = busy || queue.pending().length === 0;
    signOutButton.hidden = !currentSession;
    queueStatus.textContent = `${queue.pending().length} synthetic operation${queue.pending().length === 1 ? '' : 's'} queued${lastResult?.sent ? ` · ${lastResult.sent} acknowledged` : ''}.`;
  }

  async function handleSignedIn() {
    try {
      cloudOwner = await supabaseBoundary.readJorgeCloudProfiles();
      await flush();
    } catch (error) {
      lastResult = Object.freeze({ ok: false, error: error?.message || String(error), pending: queue.pending().length });
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
      const detail = document.getElementById('cloudAuthDetail');
      try {
        await supabaseBoundary.requestJorgeMagicLink(document.getElementById('cloudAuthEmail').value);
        detail.textContent = 'Check Jorge’s email for the private sign-in link.';
      } catch (error) {
        detail.textContent = error?.message || 'Sign-in link could not be sent.';
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
    render().then(async () => {
      if (await supabaseBoundary.session()) await handleSignedIn();
    });
    return true;
  }

  window.BigGainsCloudSync = Object.freeze({
    initialize,
    queue,
    flush,
    enqueueSyntheticCompletedWorkout,
    createCompletedWorkoutTransport,
    createSyncRuntime,
    status: () => Object.freeze({
      configured: supabaseBoundary.configured,
      initialized,
      syntheticOnly: true,
      pending: queue.pending().length,
      ownerReady: Boolean(cloudOwner),
      lastResult
    })
  });
})();
