(() => {
  'use strict';

  const runtime = {
    initialized: false,
    busy: false,
    preview: null,
    audit: null,
    plan: null,
    journal: null,
    resultAudit: null,
    message: '',
    blocker: ''
  };

  const engine = () => window.BigGainsMigrationEngine;
  const previewApi = () => window.BigGainsMigrationPreview;
  const boundary = () => window.BigGainsSupabase;
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);

  function localSnapshots() {
    return Object.fromEntries(engine().profileIds.map(profileId => [
      profileId, window.bigGainsStatePersistence.readProfileSnapshot(profileId)
    ]));
  }

  function ensureCard() {
    let card = document.getElementById('controlledMigrationCard');
    if (card) return card;
    const anchor = document.getElementById('migrationPreviewCard');
    if (!anchor) return null;
    card = document.createElement('section');
    card.id = 'controlledMigrationCard';
    card.className = 'cloud-foundation-card controlled-migration-card';
    anchor.insertAdjacentElement('afterend', card);
    return card;
  }

  function removeCard() {
    document.getElementById('controlledMigrationCard')?.remove();
    runtime.preview = null;
    runtime.audit = null;
    runtime.plan = null;
    runtime.journal = null;
  }

  function totalCountsMarkup(plan) {
    const rows = engine().targetTables.map(table => `
      <li><span>${escapeHtml(table)}</span><strong>${plan.target.tableCounts[table]}</strong></li>`).join('');
    return `<ul class="migration-counts migration-target-counts">${rows}
      <li><span>sync_metadata journal</span><strong>1</strong></li>
      <li class="migration-count-total"><span>Total database rows</span><strong>${plan.target.totalDatabaseRows}</strong></li>
    </ul>`;
  }

  function profileCountsMarkup(plan, profileId) {
    const display = profileId === 'jorge' ? 'Jorge' : 'Alexa';
    const tables = plan.target.profiles[profileId].tables;
    const count = Object.values(tables).reduce((sum, table) => sum + table.count, 0);
    return `<article class="migration-profile-card"><span class="label">Local ${display} → Cloud ${display}</span>
      <h4>${count} application row${count === 1 ? '' : 's'}</h4>
      <ul class="migration-counts">${engine().targetTables.map(table => `<li><span>${escapeHtml(table)}</span><strong>${tables[table].count}</strong></li>`).join('')}</ul>
    </article>`;
  }

  function fileLoaderMarkup(label = 'Choose approved migration preview') {
    return `<label class="migration-file-picker"><span>${escapeHtml(label)}</span>
      <input id="approvedMigrationAudit" type="file" accept="application/json,.json" ${runtime.busy ? 'disabled' : ''}>
    </label>`;
  }

  function completeAuditFromJournal(metadata) {
    return {
      format: engine().postAuditFormat,
      version: 1,
      migration: { contract: metadata.migrationContract, version: metadata.migrationVersion, id: metadata.migrationId, status: metadata.status },
      source: metadata.source,
      target: metadata.target,
      account: metadata.account,
      mappings: metadata.mappings,
      timestamps: metadata.timestamps,
      verification: metadata.verification
    };
  }

  function render() {
    const card = ensureCard();
    if (!card) return;
    const metadata = runtime.journal?.metadata;
    if (metadata?.status === 'complete') {
      runtime.resultAudit = completeAuditFromJournal(metadata);
      card.innerHTML = `<span class="label">Controlled cloud copy</span>
        <div class="migration-title-row"><div><h3>Migration complete</h3><p>Cloud readback matched the verified target checksums. Local data remains intact.</p></div><strong class="migration-status is-ready">COMPLETE</strong></div>
        <p class="migration-ready-note">Migration ${escapeHtml(metadata.migrationId)} completed ${escapeHtml(new Date(metadata.timestamps.completedAt).toLocaleString())}.</p>
        <div class="data-actions"><button id="exportPostMigrationAudit" class="secondary" type="button">Export post-migration audit</button></div>`;
      return;
    }
    if (runtime.blocker && !runtime.plan) {
      card.innerHTML = `<span class="label">Controlled cloud copy</span><h3>Migration unavailable</h3>
        <strong class="migration-status is-blocked">BLOCKED</strong><p>${escapeHtml(runtime.blocker)}</p>
        ${runtime.journal ? fileLoaderMarkup('Choose the same approved audit to inspect or resume') : ''}`;
      return;
    }
    if (!runtime.plan) {
      const resume = metadata && ['pending', 'verifying', 'failed'].includes(metadata.status);
      card.innerHTML = `<span class="label">Controlled cloud copy</span><h3>${resume ? 'Incomplete migration detected' : 'Verified data migration'}</h3>
        <p>${resume ? 'The previous copy did not finish. Load the same approved audit to verify and resume safely.' : 'Load the approved Phase 4D audit. Nothing is written until both confirmations are complete.'}</p>
        ${fileLoaderMarkup()}
        ${runtime.message ? `<p class="migration-inline-message" role="status">${escapeHtml(runtime.message)}</p>` : ''}`;
      return;
    }
    const resume = metadata && ['pending', 'verifying', 'failed'].includes(metadata.status);
    const actionLabel = resume ? 'Resume migration' : 'Migrate verified data';
    card.innerHTML = `<span class="label">Controlled cloud copy</span>
      <div class="migration-title-row"><div><h3>${resume ? 'Resume verified migration' : 'Ready to copy verified data'}</h3><p>Source checksum matched: <code>${escapeHtml(runtime.plan.source.combinedChecksum)}</code></p></div><strong class="migration-status is-ready">VERIFIED</strong></div>
      <div class="migration-profile-grid">${engine().profileIds.map(profileId => profileCountsMarkup(runtime.plan, profileId)).join('')}</div>
      <section class="migration-write-plan"><h4>Exact target writes</h4>${totalCountsMarkup(runtime.plan)}</section>
      <div class="migration-safety-copy"><strong>Remote destination is empty and verified${resume ? ' for the matching journal and partial run' : ''}.</strong>
        <p>Make a fresh local backup first. Big Gains will copy these rows to the private cloud; local data will remain intact.</p></div>
      <label class="migration-confirm"><input id="confirmMigrationWrites" type="checkbox" ${runtime.busy ? 'disabled' : ''}>
        <span>I confirm this exact plan: ${runtime.plan.target.applicationRows} application rows plus 1 recovery journal row.</span></label>
      <div class="data-actions"><button id="runControlledMigration" class="primary" type="button" disabled>${escapeHtml(actionLabel)}</button></div>
      <p class="migration-inline-message" role="status" aria-live="polite">${escapeHtml(runtime.message || 'No cloud write has started.')}</p>`;
  }

  async function readJournal(repository) {
    const journals = await repository.readJournals();
    if (journals.length > 1) throw new (engine().MigrationError)('unexpected-migration-marker', 'More than one remote migration marker exists.');
    const journal = journals[0] || null;
    if (journal && journal.metadata?.format !== engine().journalFormat) {
      throw new (engine().MigrationError)('unexpected-migration-marker', 'An unexpected remote migration marker exists.');
    }
    return journal;
  }

  async function refresh() {
    if (!boundary()?.configured) { removeCard(); return null; }
    const session = await boundary().session().catch(() => null);
    if (!session?.user?.id) { removeCard(); return null; }
    runtime.blocker = '';
    try {
      runtime.preview = await previewApi().refresh();
      if (!runtime.preview?.account?.id) throw new Error('The signed-in account mapping could not be verified.');
      const repository = engine().createSupabaseRepository({ client: boundary().getClient(), accountId: runtime.preview.account.id });
      runtime.journal = await readJournal(repository);
      if (runtime.journal?.metadata?.status === 'complete') {
        render();
        return runtime.journal;
      }
      if (!runtime.journal && runtime.preview.ready !== true) {
        runtime.blocker = runtime.preview.blockingReasons?.[0] || 'The current Phase 4D preview is blocked.';
      }
    } catch (error) {
      runtime.blocker = error?.message || 'Migration readiness could not be verified.';
    }
    render();
    return runtime.journal;
  }

  async function loadAudit(file) {
    runtime.plan = null;
    runtime.audit = null;
    runtime.message = 'Checking the approved audit against this device…';
    runtime.blocker = '';
    render();
    try {
      const text = await file.text();
      const audit = engine().validateApprovedAudit(text);
      const blockers = engine().compareAuditToPreview(audit, runtime.preview, { requireReady: !runtime.journal });
      if (blockers.length) throw new (engine().MigrationError)('audit-mismatch', blockers[0]);
      const plan = await engine().buildMigrationPlan({ audit, preview: runtime.preview, localSnapshots: localSnapshots() });
      if (runtime.journal) engine().validateJournal(plan, runtime.journal);
      runtime.audit = audit;
      runtime.plan = plan;
      runtime.message = runtime.journal ? 'The incomplete run matches this exact source and target plan.' : 'Audit, owner, profiles, source checksums, and empty destination all match.';
    } catch (error) {
      runtime.blocker = error?.message || 'The approved audit could not be verified.';
      runtime.message = '';
    }
    render();
  }

  async function currentSourceChecksum() {
    const session = await boundary().session();
    const remote = await previewApi().readRemoteDestination({ client: boundary().getClient(), session });
    const current = await previewApi().buildPreview({
      localSnapshots: localSnapshots(),
      remote,
      appRelease: window.BIG_GAINS_ASSET_MANIFEST?.release || null
    });
    return { combinedChecksum: current.combinedChecksum };
  }

  async function runMigration() {
    if (runtime.busy || !runtime.plan || !runtime.audit) return;
    runtime.busy = true;
    runtime.message = 'Rechecking the approved source and remote destination before the first write…';
    render();
    try {
      const session = await boundary().session();
      if (!session?.user?.id) throw new (engine().MigrationError)('signed-out', 'Jorge must be signed in.');
      const freshPreview = await previewApi().refresh();
      const repository = engine().createSupabaseRepository({ client: boundary().getClient(), accountId: runtime.audit.account.id });
      const freshJournal = await readJournal(repository);
      const blockers = engine().compareAuditToPreview(runtime.audit, freshPreview, { requireReady: !freshJournal });
      if (blockers.length) throw new (engine().MigrationError)('audit-mismatch', blockers[0]);
      const freshPlan = await engine().buildMigrationPlan({ audit: runtime.audit, preview: freshPreview, localSnapshots: localSnapshots() });
      if (freshJournal) engine().validateJournal(freshPlan, freshJournal);
      runtime.plan = freshPlan;
      runtime.journal = freshJournal;
      const result = await engine().executeMigration({
        plan: freshPlan,
        repository,
        existingJournal: freshJournal,
        verifySource: currentSourceChecksum,
        onProgress(progress) {
          runtime.message = progress.stage === 'verifying'
            ? 'All planned rows are present. Reading them back and verifying checksums…'
            : progress.stage === 'complete'
              ? 'Migration verified and complete.'
              : `Copied or recovered ${progress.completed} of ${progress.total} application rows…`;
          render();
        }
      });
      runtime.journal = result.journal;
      runtime.resultAudit = result.audit;
      runtime.message = 'Migration verified and complete. Local data was not changed.';
    } catch (error) {
      runtime.blocker = error?.message || 'The migration stopped safely and can be inspected before retry.';
      runtime.message = '';
      runtime.plan = null;
    } finally {
      runtime.busy = false;
      render();
    }
  }

  function downloadAudit() {
    if (!runtime.resultAudit) return;
    const serialized = `${JSON.stringify(runtime.resultAudit, null, 2)}\n`;
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `big-gains-migration-audit-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function initialize() {
    if (runtime.initialized) return false;
    runtime.initialized = true;
    if (window.bigGainsAccounts?.runtime?.kind !== 'managed-owner') return true;
    document.addEventListener('change', event => {
      if (event.target.id === 'approvedMigrationAudit' && event.target.files?.[0]) loadAudit(event.target.files[0]);
      if (event.target.id === 'confirmMigrationWrites') {
        const button = document.getElementById('runControlledMigration');
        if (button) button.disabled = !event.target.checked || runtime.busy;
      }
    });
    document.addEventListener('click', event => {
      if (event.target.closest('#runControlledMigration')) runMigration();
      if (event.target.closest('#exportPostMigrationAudit')) downloadAudit();
    });
    boundary()?.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) window.setTimeout(refresh, 0);
      if (event === 'SIGNED_OUT') removeCard();
    });
    window.setTimeout(refresh, 0);
    return true;
  }

  window.BigGainsControlledMigration = Object.freeze({
    initialize,
    refresh,
    loadAudit,
    runMigration,
    status: () => Object.freeze({
      initialized: runtime.initialized,
      busy: runtime.busy,
      hasApprovedAudit: Boolean(runtime.audit),
      hasPlan: Boolean(runtime.plan),
      journalStatus: runtime.journal?.metadata?.status || null,
      blocker: runtime.blocker,
      plan: runtime.plan,
      resultAudit: runtime.resultAudit
    })
  });
})();
