(() => {
  'use strict';

  const PREVIEW_FORMAT = 'big-gains.migration-preview.v1';
  const PREVIEW_VERSION = 1;
  const SOURCE_SCHEMA_VERSION = 5;
  const PROFILE_IDS = Object.freeze(['jorge', 'alexa']);
  const APPLICATION_TABLES = Object.freeze([
    'workouts',
    'routines',
    'preferences',
    'active_sessions',
    'sync_metadata',
    'tombstones'
  ]);
  const ENTITY_ORDER = Object.freeze([
    'completedWorkouts',
    'customRoutines',
    'bodyweightEntries',
    'goals',
    'timerPreferences',
    'exercisePreferences',
    'activeSession'
  ]);
  const ENTITY_META = Object.freeze({
    completedWorkouts: Object.freeze({ label: 'Completed workouts', destination: 'workouts' }),
    customRoutines: Object.freeze({ label: 'Custom routines', destination: 'routines' }),
    bodyweightEntries: Object.freeze({ label: 'Bodyweight entries', destination: 'preferences' }),
    goals: Object.freeze({ label: 'Goal preferences', destination: 'preferences' }),
    timerPreferences: Object.freeze({ label: 'Timer preferences', destination: 'preferences' }),
    exercisePreferences: Object.freeze({ label: 'Exercise preferences', destination: 'preferences' }),
    activeSession: Object.freeze({ label: 'Active session', destination: 'active_sessions' })
  });
  const KNOWN_STATE_KEYS = new Set([
    'version', 'profileId', 'goals', 'workouts', 'weights', 'prs', 'activeWorkout',
    'restTimerEndsAt', 'customRoutines', 'timerPreferences', 'exercisePreferences'
  ]);
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const validDate = value => (typeof value === 'string' || typeof value === 'number')
    && Number.isFinite(new Date(value).getTime());
  const validNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const nonempty = value => typeof value === 'string' && value.trim().length > 0;
  const normalizeString = value => value.replace(/\r\n?/g, '\n');

  function canonicalize(value) {
    if (value === null) return 'null';
    if (typeof value === 'string') return JSON.stringify(normalizeString(value));
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError('Canonical values must contain only finite numbers.');
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
    if (isRecord(value)) {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(normalizeString(key))}:${canonicalize(value[key])}`).join(',')}}`;
    }
    throw new TypeError(`Unsupported canonical value: ${typeof value}`);
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(canonicalize(value));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function issue(issues, profileId, path, message) {
    issues.push(Object.freeze({ profileId, path, message }));
  }

  function validateSet(value, path, profileId, issues, { active }) {
    if (!isRecord(value)) {
      issue(issues, profileId, path, 'Set must be an object.');
      return;
    }
    if (!nonempty(value.id)) issue(issues, profileId, `${path}.id`, 'Set id is required.');
    for (const field of ['weight', 'reps']) {
      if (!(validNumber(value[field]) || (active && value[field] === ''))) {
        issue(issues, profileId, `${path}.${field}`, `${field} must be a non-negative number${active ? ' or an empty in-progress value' : ''}.`);
      }
    }
    if (typeof value.warmup !== 'boolean') issue(issues, profileId, `${path}.warmup`, 'warmup must be true or false.');
    if (typeof value.completed !== 'boolean') issue(issues, profileId, `${path}.completed`, 'completed must be true or false.');
  }

  function validateExercise(value, path, profileId, issues, options) {
    if (!isRecord(value)) {
      issue(issues, profileId, path, 'Exercise must be an object.');
      return;
    }
    if (!nonempty(value.id)) issue(issues, profileId, `${path}.id`, 'Exercise id is required.');
    if (!nonempty(value.name)) issue(issues, profileId, `${path}.name`, 'Exercise name is required.');
    if (value.definitionId !== undefined && !nonempty(value.definitionId)) issue(issues, profileId, `${path}.definitionId`, 'definitionId must be a non-empty string.');
    if (value.note !== undefined && typeof value.note !== 'string') issue(issues, profileId, `${path}.note`, 'Exercise note must be text.');
    if (value.restSeconds !== undefined && (!validNumber(value.restSeconds) || value.restSeconds < 30)) issue(issues, profileId, `${path}.restSeconds`, 'Rest duration must be at least 30 seconds.');
    if (!Array.isArray(value.sets)) {
      issue(issues, profileId, `${path}.sets`, 'Exercise sets must be an array.');
      return;
    }
    const setIds = new Set();
    value.sets.forEach((set, index) => {
      validateSet(set, `${path}.sets[${index}]`, profileId, issues, options);
      if (nonempty(set?.id)) {
        if (setIds.has(set.id)) issue(issues, profileId, `${path}.sets[${index}].id`, 'Set ids must be unique within an exercise.');
        setIds.add(set.id);
      }
    });
  }

  function validateWorkout(value, index, profileId, issues, ids, { active = false } = {}) {
    const path = active ? 'activeWorkout' : `workouts[${index}]`;
    if (!isRecord(value)) {
      issue(issues, profileId, path, 'Workout must be an object.');
      return;
    }
    if (!nonempty(value.id)) issue(issues, profileId, `${path}.id`, 'Workout id is required.');
    else if (!active) {
      if (ids.has(value.id)) issue(issues, profileId, `${path}.id`, 'Completed workout ids must be unique.');
      ids.add(value.id);
    }
    if (!nonempty(value.type)) issue(issues, profileId, `${path}.type`, 'Workout type is required.');
    if (!validDate(value.startedAt)) issue(issues, profileId, `${path}.startedAt`, 'Workout start time is invalid.');
    if (!active && !validDate(value.completedAt)) issue(issues, profileId, `${path}.completedAt`, 'Workout completion time is invalid.');
    if (!active && !validNumber(value.durationSeconds)) issue(issues, profileId, `${path}.durationSeconds`, 'Workout duration must be a non-negative number.');
    if (!active && !validNumber(value.prs)) issue(issues, profileId, `${path}.prs`, 'Workout PR count must be a non-negative number.');
    if (value.note !== undefined && typeof value.note !== 'string') issue(issues, profileId, `${path}.note`, 'Workout note must be text.');
    if (value.entryMethod !== undefined && value.entryMethod !== 'retrospective') issue(issues, profileId, `${path}.entryMethod`, 'Workout entry method is unsupported.');
    if (!Array.isArray(value.exercises)) {
      issue(issues, profileId, `${path}.exercises`, 'Workout exercises must be an array.');
      return;
    }
    const exerciseIds = new Set();
    value.exercises.forEach((exercise, exerciseIndex) => {
      validateExercise(exercise, `${path}.exercises[${exerciseIndex}]`, profileId, issues, { active });
      if (nonempty(exercise?.id)) {
        if (exerciseIds.has(exercise.id)) issue(issues, profileId, `${path}.exercises[${exerciseIndex}].id`, 'Exercise ids must be unique within a workout.');
        exerciseIds.add(exercise.id);
      }
    });
  }

  function validateDerivedPrs(value, profileId, issues) {
    if (!isRecord(value)) {
      issue(issues, profileId, 'prs', 'Derived personal records must be an object.');
      return;
    }
    Object.entries(value).forEach(([key, record]) => {
      const path = `prs.${key}`;
      if (!isRecord(record)) {
        issue(issues, profileId, path, 'Personal record must be an object.');
        return;
      }
      if (!validNumber(record.estimated1RM) || !validNumber(record.weight) || !validNumber(record.reps)) {
        issue(issues, profileId, path, 'Personal record measurements must be non-negative numbers.');
      }
      if (record.date !== null && !validDate(record.date)) issue(issues, profileId, `${path}.date`, 'Personal record date is invalid.');
    });
  }

  function validateLocalState(value, expectedProfileId) {
    const issues = [];
    if (!isRecord(value)) {
      issue(issues, expectedProfileId, '$', 'Local profile state must be an object.');
      return issues;
    }
    if (value.version !== SOURCE_SCHEMA_VERSION) issue(issues, expectedProfileId, 'version', 'Source schema must remain version 5.');
    if (value.profileId !== expectedProfileId) issue(issues, expectedProfileId, 'profileId', `Local state must belong to ${expectedProfileId}.`);
    Object.keys(value).filter(key => !KNOWN_STATE_KEYS.has(key)).sort().forEach(key => {
      issue(issues, expectedProfileId, key, 'Unsupported top-level local field.');
    });

    if (!Array.isArray(value.workouts)) issue(issues, expectedProfileId, 'workouts', 'Completed workouts must be an array.');
    else {
      const ids = new Set();
      value.workouts.forEach((workout, index) => validateWorkout(workout, index, expectedProfileId, issues, ids));
    }

    if (!Array.isArray(value.weights)) issue(issues, expectedProfileId, 'weights', 'Bodyweight history must be an array.');
    else value.weights.forEach((entry, index) => {
      if (!isRecord(entry) || !validNumber(entry.weight) || !validDate(entry.date)) {
        issue(issues, expectedProfileId, `weights[${index}]`, 'Bodyweight entry requires a non-negative weight and valid date.');
      }
    });

    if (!isRecord(value.customRoutines)) issue(issues, expectedProfileId, 'customRoutines', 'Custom routines must be an object.');
    else Object.entries(value.customRoutines).forEach(([name, exerciseIds]) => {
      if (!nonempty(name) || !Array.isArray(exerciseIds) || exerciseIds.some(id => !nonempty(id)) || new Set(exerciseIds).size !== exerciseIds.length) {
        issue(issues, expectedProfileId, `customRoutines.${name}`, 'Routine must have a name and an ordered list of unique exercise ids.');
      }
    });

    if (!isRecord(value.goals)) issue(issues, expectedProfileId, 'goals', 'Goal preferences must be an object.');
    if (!isRecord(value.timerPreferences)
      || typeof value.timerPreferences.sound !== 'boolean'
      || typeof value.timerPreferences.vibration !== 'boolean') {
      issue(issues, expectedProfileId, 'timerPreferences', 'Timer sound and vibration preferences must be explicit booleans.');
    }
    if (value.exercisePreferences !== undefined && !isRecord(value.exercisePreferences)) issue(issues, expectedProfileId, 'exercisePreferences', 'Exercise preferences must be an object when present.');
    else Object.entries(value.exercisePreferences || {}).forEach(([exerciseId, preference]) => {
      if (!nonempty(exerciseId) || !isRecord(preference)) {
        issue(issues, expectedProfileId, `exercisePreferences.${exerciseId}`, 'Exercise preference must be an object with a stable exercise id.');
        return;
      }
      if (preference.cue !== undefined && typeof preference.cue !== 'string') issue(issues, expectedProfileId, `exercisePreferences.${exerciseId}.cue`, 'Saved cue must be text.');
      if (preference.restSeconds !== undefined && (!validNumber(preference.restSeconds) || preference.restSeconds < 30)) issue(issues, expectedProfileId, `exercisePreferences.${exerciseId}.restSeconds`, 'Saved rest must be at least 30 seconds.');
    });

    if (value.activeWorkout !== null) validateWorkout(value.activeWorkout, 0, expectedProfileId, issues, new Set(), { active: true });
    if (value.restTimerEndsAt !== null && (!validNumber(value.restTimerEndsAt) || value.restTimerEndsAt === 0)) {
      issue(issues, expectedProfileId, 'restTimerEndsAt', 'Rest timer deadline must be null or a positive timestamp.');
    }
    if (value.activeWorkout === null && value.restTimerEndsAt !== null) issue(issues, expectedProfileId, 'restTimerEndsAt', 'A rest timer cannot migrate without an active session.');
    validateDerivedPrs(value.prs, expectedProfileId, issues);
    return issues;
  }

  function recordsFor(value) {
    const routines = isRecord(value?.customRoutines)
      ? Object.entries(value.customRoutines).sort(([left], [right]) => left.localeCompare(right))
        .map(([clientId, exerciseIds]) => ({ clientId, exerciseIds }))
      : [];
    const exercisePreferences = isRecord(value?.exercisePreferences)
      ? Object.entries(value.exercisePreferences).sort(([left], [right]) => left.localeCompare(right))
        .map(([clientId, preference]) => ({ clientId, preference }))
      : [];
    return Object.freeze({
      completedWorkouts: Array.isArray(value?.workouts) ? value.workouts : [],
      customRoutines: routines,
      bodyweightEntries: Array.isArray(value?.weights) ? value.weights : [],
      goals: isRecord(value?.goals) ? [{ clientId: 'goals', value: value.goals }] : [],
      timerPreferences: isRecord(value?.timerPreferences) ? [{ clientId: 'timer', value: value.timerPreferences }] : [],
      exercisePreferences,
      activeSession: isRecord(value?.activeWorkout)
        ? [{ ...value.activeWorkout, restTimerEndsAt: value.restTimerEndsAt ?? null }]
        : []
    });
  }

  async function previewProfile(profileId, snapshot) {
    const value = snapshot?.ok ? snapshot.value : null;
    const issues = snapshot?.ok
      ? validateLocalState(value, profileId)
      : [Object.freeze({ profileId, path: '$', message: snapshot?.reason || 'Local profile could not be read.' })];
    const records = recordsFor(value);
    const entities = {};
    for (const entityType of ENTITY_ORDER) {
      const checksum = await sha256({
        contract: PREVIEW_FORMAT,
        sourceSchemaVersion: SOURCE_SCHEMA_VERSION,
        profileClientId: profileId,
        entityType,
        records: records[entityType]
      });
      entities[entityType] = Object.freeze({
        count: records[entityType].length,
        checksum,
        destination: ENTITY_META[entityType].destination
      });
    }
    const checksum = await sha256({
      contract: PREVIEW_FORMAT,
      sourceSchemaVersion: SOURCE_SCHEMA_VERSION,
      profileClientId: profileId,
      entities: Object.fromEntries(ENTITY_ORDER.map(entityType => [entityType, entities[entityType]]))
    });
    return Object.freeze({
      clientId: profileId,
      displayName: profileId === 'jorge' ? 'Jorge' : 'Alexa',
      valid: issues.length === 0,
      issues: Object.freeze(issues),
      entities: Object.freeze(entities),
      checksum,
      derived: Object.freeze({
        personalRecords: isRecord(value?.prs) ? Object.keys(value.prs).length : 0,
        note: 'PRs, progress, volume, and calendar summaries are derived. Notes remain inside their parent workout or active session.'
      })
    });
  }

  function validateRemote(remote) {
    const blockers = [];
    const userId = remote?.signedInUserId;
    const accounts = Array.isArray(remote?.accounts) ? remote.accounts : [];
    if (!nonempty(userId)) blockers.push('The signed-in cloud user could not be verified.');
    if (accounts.length !== 1) blockers.push(`Expected one owned cloud account; found ${accounts.length}.`);
    const account = accounts.length === 1 ? accounts[0] : null;
    if (account && account.owner_user_id !== userId) blockers.push('The signed-in cloud owner does not match the destination account.');
    const profiles = Array.isArray(remote?.profiles) ? remote.profiles : [];
    const mapping = {};
    PROFILE_IDS.forEach(profileId => {
      const matches = profiles.filter(profile => profile?.client_id === profileId);
      if (matches.length !== 1) blockers.push(`Expected one ${profileId === 'jorge' ? 'Jorge' : 'Alexa'} cloud profile; found ${matches.length}.`);
      const profile = matches.length === 1 ? matches[0] : null;
      if (profile && account && profile.account_id !== account.id) blockers.push(`Cloud ${profileId === 'jorge' ? 'Jorge' : 'Alexa'} profile belongs to a different account.`);
      if (profile) mapping[profileId] = profile;
    });
    if (account && profiles.filter(profile => profile?.account_id === account.id).length !== 2) {
      blockers.push(`Expected exactly two cloud profiles for the account; found ${profiles.filter(profile => profile?.account_id === account.id).length}.`);
    }
    const remoteCounts = {};
    APPLICATION_TABLES.forEach(table => {
      const count = remote?.counts?.[table];
      remoteCounts[table] = Number.isSafeInteger(count) && count >= 0 ? count : null;
      if (remoteCounts[table] === null) blockers.push(`Remote ${table} count could not be verified.`);
      else if (remoteCounts[table] > 0) blockers.push(`${table} already has ${remoteCounts[table]} row${remoteCounts[table] === 1 ? '' : 's'} for this account.`);
    });
    return Object.freeze({ account, mapping: Object.freeze(mapping), counts: Object.freeze(remoteCounts), blockers });
  }

  async function buildPreview({ localSnapshots, remote, generatedAt = new Date().toISOString(), appRelease = null }) {
    const profiles = {};
    for (const profileId of PROFILE_IDS) profiles[profileId] = await previewProfile(profileId, localSnapshots?.[profileId]);
    const remoteResult = validateRemote(remote);
    const blockers = [...remoteResult.blockers];
    PROFILE_IDS.forEach(profileId => profiles[profileId].issues.forEach(value => blockers.push(`${profiles[profileId].displayName}: ${value.path} — ${value.message}`)));
    const checksum = await sha256({
      contract: PREVIEW_FORMAT,
      sourceSchemaVersion: SOURCE_SCHEMA_VERSION,
      profiles: PROFILE_IDS.map(profileId => ({
        clientId: profileId,
        checksum: profiles[profileId].checksum,
        entities: Object.fromEntries(ENTITY_ORDER.map(entityType => [entityType, profiles[profileId].entities[entityType].count]))
      }))
    });
    return Object.freeze({
      format: PREVIEW_FORMAT,
      version: PREVIEW_VERSION,
      generatedAt,
      source: Object.freeze({ schemaVersion: SOURCE_SCHEMA_VERSION, appRelease }),
      account: remoteResult.account ? Object.freeze({ id: remoteResult.account.id, ownerUserId: remoteResult.account.owner_user_id }) : null,
      mappings: Object.freeze(Object.fromEntries(PROFILE_IDS.map(profileId => [profileId, remoteResult.mapping[profileId]
        ? Object.freeze({ localProfileId: profileId, cloudProfileId: remoteResult.mapping[profileId].id, cloudAccountId: remoteResult.mapping[profileId].account_id, cloudClientId: remoteResult.mapping[profileId].client_id })
        : null]))),
      profiles: Object.freeze(profiles),
      remoteCounts: remoteResult.counts,
      combinedChecksum: checksum,
      ready: blockers.length === 0,
      status: blockers.length === 0 ? 'READY FOR MIGRATION' : 'BLOCKED',
      blockingReasons: Object.freeze(blockers)
    });
  }

  async function readRemoteDestination({ client, session }) {
    if (!client || !session?.user?.id) return Object.freeze({ signedInUserId: null, accounts: [], profiles: [], counts: {} });
    const accountResult = await client.from('accounts')
      .select('id,owner_user_id')
      .eq('owner_user_id', session.user.id)
      .limit(2);
    if (accountResult.error) throw accountResult.error;
    const accounts = accountResult.data || [];
    if (accounts.length !== 1) return Object.freeze({ signedInUserId: session.user.id, accounts, profiles: [], counts: {} });
    const account = accounts[0];
    const profileResult = await client.from('profiles')
      .select('id,account_id,client_id,display_name')
      .eq('account_id', account.id);
    if (profileResult.error) throw profileResult.error;
    const counts = {};
    await Promise.all(APPLICATION_TABLES.map(async table => {
      const result = await client.from(table).select('id', { count: 'exact', head: true }).eq('account_id', account.id);
      if (result.error) throw result.error;
      counts[table] = result.count;
    }));
    return Object.freeze({
      signedInUserId: session.user.id,
      accounts: Object.freeze(accounts),
      profiles: Object.freeze(profileResult.data || []),
      counts: Object.freeze(counts)
    });
  }

  function auditArtifact(preview) {
    return {
      format: preview.format,
      version: preview.version,
      generatedAt: preview.generatedAt,
      source: { schemaVersion: preview.source.schemaVersion, appRelease: preview.source.appRelease },
      account: preview.account ? { id: preview.account.id, ownerUserId: preview.account.ownerUserId } : null,
      mappings: Object.fromEntries(PROFILE_IDS.map(profileId => [profileId, preview.mappings[profileId] ? { ...preview.mappings[profileId] } : null])),
      profiles: Object.fromEntries(PROFILE_IDS.map(profileId => [profileId, {
        counts: Object.fromEntries(ENTITY_ORDER.map(entityType => [entityType, preview.profiles[profileId].entities[entityType].count])),
        entityChecksums: Object.fromEntries(ENTITY_ORDER.map(entityType => [entityType, preview.profiles[profileId].entities[entityType].checksum])),
        profileChecksum: preview.profiles[profileId].checksum,
        valid: preview.profiles[profileId].valid
      }])),
      combinedChecksum: preview.combinedChecksum,
      remoteCounts: { ...preview.remoteCounts },
      status: preview.status,
      ready: preview.ready,
      blockingReasons: [...preview.blockingReasons]
    };
  }

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
  const shortChecksum = checksum => `${checksum.slice(0, 12)}…`;

  function profileMarkup(profile, mapping) {
    const summary = ['completedWorkouts', 'customRoutines', 'bodyweightEntries', 'activeSession']
      .map(entityType => `<li><span>${escapeHtml(ENTITY_META[entityType].label)}</span><strong>${profile.entities[entityType].count}</strong></li>`).join('');
    const details = ENTITY_ORDER.map(entityType => {
      const entity = profile.entities[entityType];
      return `<div class="migration-audit-row"><div><strong>${escapeHtml(ENTITY_META[entityType].label)}</strong><small>${entity.count} · ${escapeHtml(entity.destination)}</small></div><code>${escapeHtml(entity.checksum)}</code><button class="ghost compact" type="button" data-copy-checksum="${escapeHtml(entity.checksum)}">Copy</button></div>`;
    }).join('');
    return `<article class="migration-profile-card">
      <div class="migration-profile-head"><div><span class="label">${escapeHtml(profile.displayName)}</span><h4>Local ${escapeHtml(profile.displayName)} → ${mapping ? `Cloud ${escapeHtml(profile.displayName)}` : 'Cloud profile missing'}</h4></div><span class="migration-check ${mapping ? 'is-verified' : ''}">${mapping ? 'Verified' : 'Blocked'}</span></div>
      <ul class="migration-counts">${summary}</ul>
      <div class="migration-checksum"><span>Profile checksum</span><code title="${escapeHtml(profile.checksum)}">${escapeHtml(shortChecksum(profile.checksum))}</code><button class="ghost compact" type="button" data-copy-checksum="${escapeHtml(profile.checksum)}">Copy</button></div>
      <details><summary>Audit details</summary><div class="migration-audit-list">${details}</div><p class="migration-derived">${escapeHtml(profile.derived.note)} Persisted derived PR entries: ${profile.derived.personalRecords}.</p></details>
    </article>`;
  }

  function cardMarkup(preview) {
    const totalRemoteRows = Object.values(preview.remoteCounts).reduce((total, count) => total + (count || 0), 0);
    const blockers = preview.blockingReasons.length
      ? `<ul class="migration-blockers">${preview.blockingReasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>`
      : '<p class="migration-ready-note">Cloud destination verified. No application data rows exist for this account.</p>';
    return `<span class="label">Private cloud</span>
      <div class="migration-title-row"><div><h3>Migration preview</h3><p>Read-only inspection of this device. No personal records leave the browser.</p></div><strong class="migration-status ${preview.ready ? 'is-ready' : 'is-blocked'}">${preview.status}</strong></div>
      <div class="migration-profile-grid">${PROFILE_IDS.map(profileId => profileMarkup(preview.profiles[profileId], preview.mappings[profileId])).join('')}</div>
      <section class="migration-account-summary"><div><span>Account checksum</span><code title="${escapeHtml(preview.combinedChecksum)}">${escapeHtml(shortChecksum(preview.combinedChecksum))}</code><button class="ghost compact" type="button" data-copy-checksum="${escapeHtml(preview.combinedChecksum)}">Copy</button></div><div><span>Cloud destination</span><strong>${preview.account ? 'Verified owner' : 'Not verified'}</strong></div><div><span>Remote data rows</span><strong>${totalRemoteRows}</strong></div></section>
      ${blockers}
      <div class="migration-preview-footer"><small>Previewed ${escapeHtml(new Date(preview.generatedAt).toLocaleString())}. Timestamp is excluded from every checksum.</small><button id="exportMigrationPreview" class="secondary" type="button">Export migration preview</button></div>
      <p class="migration-next-phase">Migration requires a separately reviewed and approved next phase. This preview cannot upload data.</p>`;
  }

  let initialized = false;
  let authSubscription = null;
  let lastPreview = null;

  function removeCard() {
    document.getElementById('migrationPreviewCard')?.remove();
    lastPreview = null;
  }

  function ensureCard() {
    let card = document.getElementById('migrationPreviewCard');
    if (card) return card;
    const anchor = document.getElementById('cloudFoundationCard') || document.getElementById('settingsPanel');
    if (!anchor) return null;
    card = document.createElement('section');
    card.id = 'migrationPreviewCard';
    card.className = 'cloud-foundation-card migration-preview-card';
    anchor.insertAdjacentElement('afterend', card);
    return card;
  }

  function downloadAudit(preview) {
    const blob = new Blob([`${JSON.stringify(auditArtifact(preview), null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `big-gains-migration-preview-${new Date(preview.generatedAt).toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyChecksum(button) {
    try {
      await navigator.clipboard.writeText(button.dataset.copyChecksum);
      const original = button.textContent;
      button.textContent = 'Copied';
      window.setTimeout(() => { button.textContent = original; }, 1200);
    } catch {
      button.textContent = 'Copy failed';
    }
  }

  async function refresh() {
    const boundary = window.BigGainsSupabase;
    if (!boundary?.configured) {
      removeCard();
      return null;
    }
    let currentSession = null;
    try { currentSession = await boundary.session(); } catch {}
    if (!currentSession?.user?.id) {
      removeCard();
      return null;
    }
    const card = ensureCard();
    if (!card) return null;
    card.innerHTML = '<span class="label">Private cloud</span><h3>Migration preview</h3><p>Verifying this device and the private destination…</p>';
    try {
      const localSnapshots = Object.fromEntries(PROFILE_IDS.map(profileId => [profileId, window.bigGainsStatePersistence.readProfileSnapshot(profileId)]));
      const remote = await readRemoteDestination({ client: boundary.getClient(), session: currentSession });
      lastPreview = await buildPreview({
        localSnapshots,
        remote,
        appRelease: window.BIG_GAINS_ASSET_MANIFEST?.release || null
      });
      card.innerHTML = cardMarkup(lastPreview);
      return lastPreview;
    } catch (error) {
      card.innerHTML = `<span class="label">Private cloud</span><h3>Migration preview</h3><strong class="migration-status is-blocked">BLOCKED</strong><p>${escapeHtml(error?.message || 'The read-only preview could not be completed.')}</p>`;
      return null;
    }
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    if (!window.BigGainsSupabase?.configured) return true;
    document.addEventListener('click', event => {
      const copy = event.target.closest('[data-copy-checksum]');
      if (copy) copyChecksum(copy);
      if (event.target.closest('#exportMigrationPreview') && lastPreview) downloadAudit(lastPreview);
    });
    authSubscription = window.BigGainsSupabase.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) window.setTimeout(refresh, 0);
      if (event === 'SIGNED_OUT') removeCard();
    });
    refresh();
    return true;
  }

  window.BigGainsMigrationPreview = Object.freeze({
    format: PREVIEW_FORMAT,
    version: PREVIEW_VERSION,
    sourceSchemaVersion: SOURCE_SCHEMA_VERSION,
    applicationTables: APPLICATION_TABLES,
    entityOrder: ENTITY_ORDER,
    canonicalize,
    sha256,
    validateLocalState,
    previewProfile,
    validateRemote,
    buildPreview,
    readRemoteDestination,
    auditArtifact,
    initialize,
    refresh,
    status: () => Object.freeze({ initialized, ready: lastPreview?.ready === true, preview: lastPreview, authSubscribed: Boolean(authSubscription) })
  });
})();
