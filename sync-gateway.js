(() => {
  'use strict';

  const CONFIG_KEY = 'big-gains-sync-gateway-v1';
  const VAULT = Object.freeze({
    owner: 'Velazquick',
    repo: 'firstcut-validator',
    branch: 'big-gains-data',
    prefix: 'big-gains/profiles'
  });
  const API_ROOT = 'https://api.github.com';
  const MAX_WORKOUTS = 120;
  const MAX_WEIGHTS = 200;
  const runtime = { busy: false };
  let initialized = false;

  class GitHubSyncError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = 'GitHubSyncError';
      this.status = status;
    }
  }

  function readConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
      return {
        token: typeof saved.token === 'string' ? saved.token : '',
        lastSyncedAt: saved.lastSyncedAt || null,
        lastWorkoutByProfile: saved.lastWorkoutByProfile || {}
      };
    } catch (error) {
      console.warn('Could not read Big Gains sync settings', error);
      return { token: '', lastSyncedAt: null, lastWorkoutByProfile: {} };
    }
  }

  function writeConfig(config) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      token: config.token || '',
      lastSyncedAt: config.lastSyncedAt || null,
      lastWorkoutByProfile: config.lastWorkoutByProfile || {}
    }));
  }

  function profileId() {
    if (typeof PROFILE !== 'undefined' && PROFILE?.id) return PROFILE.id;
    return document.documentElement.dataset.profile || 'jorge';
  }

  function profileName() {
    if (typeof PROFILE !== 'undefined' && PROFILE?.name) return PROFILE.name;
    const id = profileId();
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  function currentState() {
    return typeof state !== 'undefined' && state ? state : null;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function workoutVolume(workout) {
    return (workout?.exercises || [])
      .flatMap(exercise => exercise?.sets || [])
      .filter(set => !set?.warmup)
      .reduce((total, set) => total + (Number(set?.weight) || 0) * (Number(set?.reps) || 0), 0);
  }

  function buildSnapshot() {
    const data = currentState();
    if (!data) throw new Error('Workout data is not ready yet.');

    const allWorkouts = Array.isArray(data.workouts) ? data.workouts : [];
    const allWeights = Array.isArray(data.weights) ? data.weights : [];
    const workouts = clone(allWorkouts.slice(0, MAX_WORKOUTS));
    const weights = clone(allWeights.slice(0, MAX_WEIGHTS));
    const prs = clone(data.prs || {});
    const latestWorkout = workouts[0] || null;
    const latestWeight = weights[0] || null;
    const generatedAt = new Date().toISOString();

    return {
      schema: 'big-gains.snapshot.v1',
      generatedAt,
      source: {
        app: 'Big Gains',
        profileId: profileId(),
        stateVersion: data.version || null,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null
      },
      profile: {
        id: profileId(),
        name: profileName(),
        primaryGoal: typeof PROFILE !== 'undefined' ? PROFILE?.goals?.primary || null : null
      },
      summary: {
        completedWorkouts: allWorkouts.length,
        publishedWorkouts: workouts.length,
        lifetimeVolumeLb: Math.round(allWorkouts.reduce((total, workout) => total + workoutVolume(workout), 0)),
        personalRecordCount: Object.keys(data.prs || {}).length,
        latestWeightLb: latestWeight ? Number(latestWeight.weight) || null : null,
        lastCompletedAt: latestWorkout?.completedAt || null
      },
      latestWorkout,
      workouts,
      weights,
      prs
    };
  }

  function snapshotPath() {
    return `${VAULT.prefix}/${profileId()}/snapshot.json`;
  }

  function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  function headers(token) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async function request(url, options, token) {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      headers: {
        ...headers(token),
        ...(options?.headers || {})
      }
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const message = body?.message || `GitHub request failed (${response.status}).`;
      throw new GitHubSyncError(message, response.status);
    }
    return body;
  }

  async function testConnection(token) {
    const branch = encodeURIComponent(VAULT.branch);
    return request(
      `${API_ROOT}/repos/${VAULT.owner}/${VAULT.repo}/git/ref/heads/${branch}`,
      { method: 'GET' },
      token
    );
  }

  async function currentFileSha(token) {
    const path = encodePath(snapshotPath());
    const ref = encodeURIComponent(VAULT.branch);
    try {
      const file = await request(
        `${API_ROOT}/repos/${VAULT.owner}/${VAULT.repo}/contents/${path}?ref=${ref}`,
        { method: 'GET' },
        token
      );
      return file?.sha || null;
    } catch (error) {
      if (error instanceof GitHubSyncError && error.status === 404) return null;
      throw error;
    }
  }

  async function writeSnapshot(token, snapshot, retry = true) {
    const path = encodePath(snapshotPath());
    const sha = await currentFileSha(token);
    const payload = {
      message: `Sync Big Gains ${profileId()} snapshot`,
      branch: VAULT.branch,
      content: toBase64(`${JSON.stringify(snapshot, null, 2)}\n`)
    };
    if (sha) payload.sha = sha;

    try {
      return await request(
        `${API_ROOT}/repos/${VAULT.owner}/${VAULT.repo}/contents/${path}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        token
      );
    } catch (error) {
      if (retry && error instanceof GitHubSyncError && error.status === 409) {
        return writeSnapshot(token, snapshot, false);
      }
      throw error;
    }
  }

  function friendlyError(error) {
    if (error instanceof GitHubSyncError) {
      if (error.status === 401) return 'That key was rejected. Check that it was copied completely.';
      if (error.status === 403) return 'The key connected, but it does not have Contents read/write access.';
      if (error.status === 404) return 'The private vault or data branch could not be reached with this key.';
      if (error.status === 409) return 'GitHub changed the file at the same time. Tap Sync now once more.';
      if (error.status === 422) return 'GitHub rejected the snapshot. The key or branch settings may need attention.';
      return `${error.message} (${error.status})`;
    }
    if (!navigator.onLine) return 'You are offline. Big Gains will retry when the connection returns.';
    return error?.message || 'The sync attempt did not finish.';
  }

  function renderCard() {
    const panel = document.getElementById('settingsPanel');
    if (!panel || document.getElementById('syncGatewayCard')) return;

    const config = readConfig();
    const card = document.createElement('div');
    card.className = 'sync-gateway-card';
    card.id = 'syncGatewayCard';
    card.innerHTML = `
      <div class="sync-gateway-head">
        <div class="sync-gateway-title">
          <span class="label">Private access door</span>
          <strong>Workout sync</strong>
        </div>
        <span class="sync-gateway-status" id="syncGatewayStatus" data-state="${config.token ? 'ready' : 'idle'}">${config.token ? 'Key saved' : 'Not connected'}</span>
      </div>
      <p>Publish completed workouts to a private GitHub branch so your workout history can be read without exporting JSON.</p>
      <div class="sync-gateway-target">
        <span>Private vault</span>
        <strong>${VAULT.owner}/${VAULT.repo} · ${VAULT.branch} · ${VAULT.prefix}/${profileId()}/snapshot.json</strong>
      </div>
      <div class="sync-gateway-secret">
        <label>
          <span>Fine-grained GitHub token</span>
          <input id="syncGatewayToken" type="password" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${config.token ? 'Key saved on this device' : 'Paste token once'}" />
        </label>
        <button id="syncGatewayConnect" class="secondary" type="button">${config.token ? 'Test key' : 'Connect'}</button>
      </div>
      <small>Use a fine-grained token restricted to <strong>${VAULT.repo}</strong> with Contents: Read and write only. The key stays in this browser and is never included in workout data.</small>
      <div class="sync-gateway-actions">
        <button id="syncGatewayNow" class="secondary" type="button" ${config.token ? '' : 'disabled'}>Sync now</button>
        <button id="syncGatewayForget" class="ghost" type="button" ${config.token ? '' : 'disabled'}>Forget key</button>
      </div>
      <p class="sync-gateway-message" id="syncGatewayMessage" aria-live="polite">${config.lastSyncedAt ? `Last synced ${new Date(config.lastSyncedAt).toLocaleString()}.` : 'Only completed workouts are published. Active sessions stay local.'}</p>
    `;
    panel.appendChild(card);

    document.getElementById('syncGatewayConnect')?.addEventListener('click', connect);
    document.getElementById('syncGatewayNow')?.addEventListener('click', () => publishSnapshot({ reason: 'manual' }));
    document.getElementById('syncGatewayForget')?.addEventListener('click', forgetKey);
  }

  function setStatus(label, stateName = 'idle', message = '') {
    const status = document.getElementById('syncGatewayStatus');
    const messageNode = document.getElementById('syncGatewayMessage');
    if (status) {
      status.textContent = label;
      status.dataset.state = stateName;
    }
    if (messageNode && message) messageNode.textContent = message;
  }

  function setControlsDisabled(disabled) {
    ['syncGatewayConnect', 'syncGatewayNow', 'syncGatewayForget'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.disabled = disabled || (id !== 'syncGatewayConnect' && !readConfig().token);
    });
  }

  async function connect() {
    if (runtime.busy) return;
    const input = document.getElementById('syncGatewayToken');
    const config = readConfig();
    const candidate = (input?.value || config.token || '').trim();
    if (!candidate) {
      setStatus('Key needed', 'error', 'Paste a fine-grained GitHub token to open the private sync door.');
      input?.focus();
      return;
    }

    runtime.busy = true;
    setControlsDisabled(true);
    setStatus('Checking…', 'busy', 'Confirming access to the private data branch.');
    try {
      await testConnection(candidate);
      config.token = candidate;
      writeConfig(config);
      if (input) {
        input.value = '';
        input.placeholder = 'Key saved on this device';
      }
      const connectButton = document.getElementById('syncGatewayConnect');
      if (connectButton) connectButton.textContent = 'Test key';
      setStatus('Connected', 'ready', 'Private branch reached. Publishing the current profile snapshot.');
      await publishSnapshot({ reason: 'connect', tokenOverride: candidate });
    } catch (error) {
      setStatus('Connection failed', 'error', friendlyError(error));
    } finally {
      runtime.busy = false;
      setControlsDisabled(false);
    }
  }

  async function publishSnapshot({ reason = 'auto', tokenOverride = '' } = {}) {
    if (runtime.busy && reason !== 'connect') return false;
    const config = readConfig();
    const token = (tokenOverride || config.token || '').trim();
    if (!token) {
      setStatus('Not connected', 'error', 'Connect a repository key before syncing.');
      document.getElementById('syncGatewayToken')?.focus();
      return false;
    }
    if (!navigator.onLine) {
      setStatus('Waiting for signal', 'busy', 'Offline right now. Big Gains will retry when the connection returns.');
      return false;
    }

    const ownsBusyState = reason !== 'connect';
    if (ownsBusyState) {
      runtime.busy = true;
      setControlsDisabled(true);
    }
    setStatus('Syncing…', 'busy', `Publishing ${profileName()}'s completed workout snapshot.`);

    try {
      const snapshot = buildSnapshot();
      await writeSnapshot(token, snapshot);
      const latestId = snapshot.latestWorkout?.id || null;
      const freshConfig = readConfig();
      freshConfig.token = token;
      freshConfig.lastSyncedAt = snapshot.generatedAt;
      freshConfig.lastWorkoutByProfile = {
        ...(freshConfig.lastWorkoutByProfile || {}),
        [profileId()]: latestId
      };
      writeConfig(freshConfig);
      setStatus('Synced', 'ready', `Private snapshot updated ${new Date(snapshot.generatedAt).toLocaleString()}.`);
      const nowButton = document.getElementById('syncGatewayNow');
      const forgetButton = document.getElementById('syncGatewayForget');
      if (nowButton) nowButton.disabled = false;
      if (forgetButton) forgetButton.disabled = false;
      return true;
    } catch (error) {
      setStatus('Sync failed', 'error', friendlyError(error));
      return false;
    } finally {
      if (ownsBusyState) {
        runtime.busy = false;
        setControlsDisabled(false);
      }
    }
  }

  function forgetKey() {
    const config = readConfig();
    config.token = '';
    writeConfig(config);
    const input = document.getElementById('syncGatewayToken');
    if (input) {
      input.value = '';
      input.placeholder = 'Paste token once';
    }
    const connectButton = document.getElementById('syncGatewayConnect');
    if (connectButton) connectButton.textContent = 'Connect';
    setStatus('Not connected', 'idle', 'The key was removed from this device. Existing private snapshots were not deleted.');
    setControlsDisabled(false);
  }

  function needsSync() {
    const config = readConfig();
    if (!config.token) return false;
    const latest = currentState()?.workouts?.[0] || null;
    if (!latest?.id) return !config.lastSyncedAt;
    return config.lastWorkoutByProfile?.[profileId()] !== latest.id;
  }

  function scheduleCatchUp(delay = 500) {
    window.setTimeout(() => {
      if (!runtime.busy && needsSync()) publishSnapshot({ reason: 'catch-up' });
    }, delay);
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    renderCard();

    const finishButton = document.getElementById('finishWorkout');
    finishButton?.addEventListener('click', () => scheduleCatchUp(450));
    document.addEventListener('big-gains-workout-saved', () => scheduleCatchUp(450));

    window.addEventListener('online', () => scheduleCatchUp(250));
    window.addEventListener('pageshow', () => scheduleCatchUp(800));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleCatchUp(350);
    });

    scheduleCatchUp(1000);
    return true;
  }

  window.BigGainsSync = Object.freeze({
    initialize,
    publishSnapshot,
    buildSnapshot,
    destination: { ...VAULT, path: snapshotPath() }
  });
})();
