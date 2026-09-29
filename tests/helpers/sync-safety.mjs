export function createSyncSafetyFixture(execute) {
  const storage = new Map();
  storage.set('synthetic-recovery-journal', 'preserve');
  storage.set('queue', 'preserve-durable-envelope');
  const catalog = { format: 'big-gains.shadow-catalog.v1', accountId: 'account', authUserId: 'user', profiles: { proof: { profileId: 'profile' } } };
  storage.set('catalog', JSON.stringify(catalog));
  const controls = { recovery: { ok: false, reason: 'synthetic-recovery' }, parity: true, pending: [], timers: [], comparingHook: null };
  const scope = {
    setTimeout: fn => { controls.timers.push(fn); return controls.timers.length; }, clearTimeout() {},
    BigGainsCloud: { createDurableQueue: () => ({ pending: () => controls.pending }) },
    bigGainsAccounts: { runtime: { kind: 'independent', cloudShape: 'independent', cloudKeys: { queue: 'queue', catalog: 'catalog', comparison: 'comparison' } }, matchesCloudOwner: () => true, cloudProfileShape: () => 'independent' },
    BigGainsSupabase: { session: async () => ({ user: { id: 'user' } }), verifiedUser: async () => { if (controls.sessionFailure) throw Error('synthetic verification failure'); return { id: 'user' }; }, readCloudAccount: async () => ({ account: { id: 'account' }, authUserId: 'user', profiles: { proof: { id: 'profile' } } }), getClient: () => ({}) },
    BigGainsManagedProfileRecovery: { adoptionRecoveryStatus: () => controls.recovery, inspectRemoteFastForward: () => ({ eligible: false, reason: 'synthetic-drift' }) },
    BigGainsCloudShadow: { profileIds: ['proof'], createRepository: () => ({ readAll: async () => ({ journals: [] }) }), completedMigrationJournal: () => null, reconstructCloud: async () => ({}), readLocalProfiles: async () => ({}), compare: async () => { await controls.comparingHook?.(); return { parity: controls.parity, profiles: { proof: { parity: controls.parity } } }; }, catalogFromCloud: () => catalog }
  };
  const ctx = { window: scope, document: { visibilityState: 'visible', getElementById: () => null }, navigator: { onLine: true }, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) } };
  execute(ctx);
  return { controls, storage, api: scope.BigGainsCloudSync, async reconcile() { scope.BigGainsCloudSync.scheduleReconciliation('synthetic', 0); await controls.timers.pop()(); await new Promise(resolve => setTimeout(resolve, 0)); } };
}
