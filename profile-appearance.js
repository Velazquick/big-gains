(() => {
  'use strict';
  const model = window.BigGainsAppearanceModel;
  const accounts = window.bigGainsAccounts;
  const runtime = accounts.runtime;
  const boundary = window.BigGainsSupabase;
  const key = `big-gains-appearance-v1-${runtime.authUserId || 'local'}-${runtime.cloudAccountId || runtime.storageNamespace}-${ACCOUNT.profileId}`;
  const fallback = model.normalize(ACCOUNT.presentation) || { accent: 'cobalt', version: 0 };
  const same = (a, b) => a?.accent === b?.accent && a?.version === b?.version;
  let busy = null;
  let message = '';
  let conflict = false;
  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      const accepted = model.normalize(raw?.accepted);
      const pending = raw?.pending && typeof raw.pending.id === 'string' && model.normalize(raw.pending.value)?.version === 1
        ? { id: raw.pending.id, value: model.normalize(raw.pending.value), base: model.normalize(raw.pending.base) } : null;
      return { accepted, pending };
    } catch { return { accepted: null, pending: null }; }
  }
  const current = () => { const value = read(); return value.pending?.value || value.accepted || fallback; };
  function save(value) { localStorage.setItem(key, JSON.stringify(value)); }
  function apply() {
    const value = current();
    const root = document.documentElement;
    root.dataset.appearanceVersion = String(value.version);
    const variableNames = ['accent','accent-primary','accent2','accent-bright','accent-rgb','accent-soft','accent-border','accent-border-soft','on-accent','accent-chart','accent-glow','accent-wash','accent-wash-strong'];
    variableNames.forEach(name => root.style.removeProperty(`--${name}`));
    root.dataset.accent = value.accent;
    // Legacy CSS remains byte-for-byte in effect until an explicit v1 choice.
    if (value.version === 1) {
      const tokens = model.tokens(value.accent, PRESENTATION.theme === 'wellness-light');
      root.dataset.accent = value.accent;
      const vars = { accent: tokens.ink, 'accent-primary': tokens.primary, accent2: tokens.primary,
        'accent-bright': tokens.bright, 'accent-rgb': tokens.rgb, 'accent-soft': tokens.soft,
        'accent-border': tokens.border, 'accent-border-soft': tokens.borderSoft, 'on-accent': tokens.on,
        'accent-chart': tokens.chart, 'accent-glow': `rgba(${tokens.rgb},.13)`,
        'accent-wash': `rgba(${tokens.rgb},.18)`, 'accent-wash-strong': `rgba(${tokens.rgb},.22)` };
      Object.entries(vars).forEach(([name, token]) => root.style.setProperty(`--${name}`, token));
    }
    render();
  }
  function render() {
    const selected = model.resolve(current());
    document.querySelectorAll('[name="profileAccent"]').forEach(input => { input.checked = input.value === selected; });
    const status = document.getElementById('accentStatus');
    if (status) status.textContent = message || (read().pending ? 'Saved on this device. Syncs when your private cloud is available.' : 'Choose a color for this profile.');
    const actions = document.getElementById('accentConflict');
    if (actions) actions.hidden = !conflict;
  }
  function select(accent) {
    if (!model.names.includes(accent)) return false;
    const cache = read();
    const value = { accent, version: 1 };
    try {
      save({ accepted: cache.accepted, pending: { id: crypto.randomUUID(), value, base: cache.accepted } });
    } catch {
      message = 'This device could not save your color. Free some storage and try again.';
      render(); return false;
    }
    conflict = false; message = ''; apply(); void sync(); return true;
  }
  async function performSync() {
    if (!boundary?.configured || !runtime.authUserId || navigator.onLine === false) return;
    try {
      const session = await boundary.session();
      if (session?.user?.id !== runtime.authUserId) return;
      await boundary.verifiedUser(runtime.authUserId);
      const owner = await boundary.readCloudAccount(runtime.authUserId);
      if (!accounts.matchesCloudOwner(owner, runtime.authUserId)) return;
      const row = owner.profiles[ACCOUNT.profileId];
      if (!row || row.account_id !== runtime.cloudAccountId || (ACCOUNT.cloudProfileId && row.id !== ACCOUNT.cloudProfileId)) return;
      const remote = model.normalize({ accent: row.accent, version: row.accent_version ?? 0 });
      if (!remote) throw new Error('Unsupported presentation');
      let cache = read();
      const operation = cache.pending;
      if (!operation) {
        save({ accepted: remote, pending: null }); message = ''; conflict = false; apply(); return;
      }
      if (same(remote, operation.value)) {
        save({ accepted: remote, pending: null }); message = 'Color synced.'; conflict = false; apply(); return;
      }
      if (operation.base && !same(remote, operation.base)) {
        save({ ...cache, accepted: remote });
        conflict = true; message = 'Your color changed on another device. Choose which color to keep.'; render(); return;
      }
      const result = await boundary.updateProfileAccent({
        authUserId: runtime.authUserId, accountId: row.account_id, profileId: row.id,
        clientId: ACCOUNT.profileId, expected: remote, accent: operation.value.accent
      });
      if ((await boundary.session())?.user?.id !== runtime.authUserId) return;
      if (!result) { message = 'Your color changed while syncing. Checking again…'; render(); return; }
      // A second click while the first PATCH is in flight must remain queued.
      cache = read();
      const pending = cache.pending?.id === operation.id ? null : cache.pending;
      save({ accepted: operation.value, pending: pending ? { ...pending, base: operation.value } : null });
      conflict = false; message = pending ? '' : 'Color synced.'; apply();
      if (pending) setTimeout(sync, 0);
    } catch {
      message = read().pending ? 'Saved on this device. Color sync will retry when available.' : '';
      render();
    }
  }
  function sync() {
    if (busy) return busy;
    busy = performSync().finally(() => { busy = null; });
    return busy;
  }
  function init() {
    const choice = document.getElementById('accentChoice');
    if (choice) {
      choice.innerHTML = '<legend>Accent color</legend>' + model.names.map(accent => `<label><input type="radio" name="profileAccent" value="${accent}"><span><i aria-hidden="true" style="background:${model.palettes[accent].dark.primary}"></i><b>${model.palettes[accent].name}</b><em aria-hidden="true">✓</em></span></label>`).join('');
      choice.addEventListener('change', event => { if (event.target.name === 'profileAccent') select(event.target.value); });
      choice.addEventListener('click', event => {
        if (event.target.name === 'profileAccent' && current().version === 0
          && model.resolve(current()) === event.target.value) select(event.target.value);
      });
    }
    document.getElementById('accentKeepLocal')?.addEventListener('click', () => select(model.resolve(current())));
    document.getElementById('accentUseCloud')?.addEventListener('click', () => {
      try { save({ accepted: read().accepted, pending: null }); conflict = false; message = ''; apply(); } catch { message = 'This device could not save your color.'; render(); }
    });
    document.getElementById('openSettings')?.addEventListener('click', () => void sync());
    boundary?.onAuthStateChange(() => setTimeout(sync, 0));
    window.addEventListener('online', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('storage', event => { if (event.key === key) { apply(); void sync(); } });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sync(); });
    setInterval(() => { if (document.visibilityState === 'visible') void sync(); }, 30000);
    apply(); void sync();
  }
  window.BigGainsAppearance = Object.freeze({ current, select, sync, storageKey: key, render,
    presentation: () => ({ ...PRESENTATION, accent: model.resolve(current()), accentVersion: current().version }) });
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
