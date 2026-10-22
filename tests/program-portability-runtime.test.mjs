import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

await import('../program-portability.js');

const runtime = globalThis.BigGainsProgramPortability;

test('unresolved adoption recovery stays latched while refresh replaces presentation status',async()=>{
  const storage=new Map(),pending=[];
  const profile={id:'synthetic-profile'},account={accountId:'local-account',storageKey:'synthetic-profile-state'};
  const before={version:5,profileId:profile.id,goals:{},workouts:[],weights:[],activeWorkout:null,restTimerEndsAt:null,customRoutines:{}};
  const owner={account:{id:'cloud-account'},profiles:[{id:'cloud-profile',client_id:profile.id,account_id:'cloud-account'}]};
  let hold=false,release,enter;const entered=new Promise(r=>enter=r),held=new Promise(r=>release=r);
  const scope={console,navigator:{onLine:true},addEventListener(){},document:{getElementById:()=>null,addEventListener(){}},
    localStorage:{get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))},
    bigGainsAccounts:{runtime:{kind:'independent',authUserId:'user',storageNamespace:'synthetic-runtime'},matchesCloudOwner:()=>true},
    BigGainsSupabase:{getClient:()=>({}),verifiedUser:async()=>{if(hold){enter();await held;}return {id:'user'};},readCloudAccount:async()=>owner},
    __BIG_GAINS_CLOUD_CONFIG__:{programPortability:true,programPortabilityVersion:1},
    BigGainsCloud:{createDurableQueue:()=>({pending:()=>pending})},
    BigGainsProgramDomainSync:{isProgramDomainOperation:o=>o.entityType==='program_domains',createService:()=>({})},
    BigGainsProgramDomainCutover:{createService:()=>({inspectCutover:async()=>({state:'cloud_available'})})},
    BigGainsProgramDomainRecovery:{states:{REMOTE_FAST_FORWARD_SAFE:'safe'},readRemote:async()=>({state:'valid',remote:{record:{version:2},envelope:{}}}),classify:async()=>({state:'safe'}),adopt:async()=>({ok:false,recoveryRequired:true,reasonCode:'PROGRAM_RECOVERY_ADOPTION_STATE_CHANGED'})},
    BigGainsProgramModel:{normalizeCapture:x=>x},bigGainsStatePersistence:{readRawOwnedState:()=>JSON.stringify(before)},
    statePersistenceApi:{storageKey:account.storageKey,hasStoredState:()=>true,status:()=>({writable:true})},state:before,active:null,ACCOUNT:account,PROFILE:profile,exerciseCatalog:{}};
  scope.window=scope;vm.createContext(scope);
  vm.runInContext(await readFile(new URL('../program-portability.js',import.meta.url),'utf8'),scope);
  const api=scope.BigGainsProgramPortability;api.initialize();await new Promise(r=>setImmediate(r));
  assert.equal((await api.useCloud()).recoveryRequired,true);assert.equal(api.localMutationSafety(),false);
  hold=true;const refresh=api.refresh();await entered;
  assert.equal(api.status().status,'checking');assert.equal(api.status().recoveryRequired,true);
  assert.equal(api.localMutationSafety(),false);assert.equal(api.updateSafety(),false);
  release();await refresh;
  assert.equal(api.status().status,'update_available');assert.equal(api.localMutationSafety(),false);assert.equal(api.updateSafety(),false);
});

function sequence(programVersionId, nextSlotIndex, completedCycles, updatedAt, lastTransition = null) {
  return { programId: 'program-1', programVersionId, nextSlotIndex, completedCycles, updatedAt, lastTransition };
}

function capture(programVersionId, nextSlotIndex, completedCycles, updatedAt, predecessorProgramVersionId = null) {
  return {
    sequenceState: { programId: 'program-1', programVersionId, nextSlotIndex, completedCycles, updatedAt },
    programVersions: [{
      programId: 'program-1', programVersionId, predecessorProgramVersionId,
      slots: [{ slotId: 'slot-1' }, { slotId: 'slot-2' }]
    }]
  };
}

test('capability is exact, versioned, and fail-closed', () => {
  assert.deepEqual(runtime.capability({}), { enabled: false, version: null, reason: 'capability-disabled' });
  assert.deepEqual(runtime.capability({ programPortability: true }), { enabled: false, version: null, reason: 'capability-disabled' });
  assert.deepEqual(runtime.capability({ programPortability: true, programPortabilityVersion: 2 }), { enabled: false, version: null, reason: 'capability-disabled' });
  assert.deepEqual(runtime.capability({ programPortability: true, programPortabilityVersion: 1 }), { enabled: true, version: 1, reason: null });
});

test('unchanged sequence preserves the accepted transition identity', () => {
  const accepted = {
    transitionId: 'accepted-transition', kind: 'completion', occurredAt: '2036-08-10T12:00:00.000Z', workoutId: 'workout-0',
    before: { programVersionId: 'program-v1', nextSlotIndex: 0, completedCycles: 0 },
    after: { programVersionId: 'program-v1', nextSlotIndex: 1, completedCycles: 0 }
  };
  const result = runtime.deriveTransition({
    beforeEnvelope: { sequence: sequence('program-v1', 1, 0, '2036-08-10T12:00:00.000Z', accepted) },
    afterCapture: capture('program-v1', 1, 0, '2036-08-10T12:00:00.000Z')
  });
  assert.equal(result.ok, true);
  assert.equal(result.changed, false);
  assert.deepEqual(result.lastTransition, accepted);
});

test('activation transition is derived only from the exact initial position', () => {
  const result = runtime.deriveTransition({
    beforeEnvelope: { sequence: null },
    afterCapture: capture('program-v1', 0, 0, '2036-08-10T12:00:00.000Z')
  });
  assert.equal(result.ok, true);
  assert.equal(result.lastTransition.kind, 'activation');
  assert.equal(result.lastTransition.before.programVersionId, null);
  assert.equal(result.lastTransition.workoutId, null);
});

test('successor carry transition requires immutable predecessor lineage and unchanged position', () => {
  const result = runtime.deriveTransition({
    beforeEnvelope: { sequence: sequence('program-v1', 1, 2, '2036-08-09T12:00:00.000Z') },
    afterCapture: capture('program-v2', 1, 2, '2036-08-10T12:00:00.000Z', 'program-v1')
  });
  assert.equal(result.ok, true);
  assert.equal(result.lastTransition.kind, 'successor_carry');
  assert.equal(result.lastTransition.before.programVersionId, 'program-v1');
  assert.equal(result.lastTransition.after.programVersionId, 'program-v2');
});

test('completion transition requires the exact frozen Program-origin workout', () => {
  const occurredAt = '2036-08-10T12:00:00.000Z';
  const result = runtime.deriveTransition({
    beforeEnvelope: { sequence: sequence('program-v1', 1, 2, '2036-08-09T12:00:00.000Z') },
    afterCapture: capture('program-v1', 0, 3, occurredAt),
    workouts: [{
      id: 'workout-1', completedAt: occurredAt,
      programOrigin: { programVersionId: 'program-v1', slotIndex: 1, cycleNumber: 3 }
    }]
  });
  assert.equal(result.ok, true);
  assert.equal(result.lastTransition.kind, 'completion');
  assert.equal(result.lastTransition.workoutId, 'workout-1');
});

test('unprovable sequence movement stops without inventing a transition', () => {
  const result = runtime.deriveTransition({
    beforeEnvelope: { sequence: sequence('program-v1', 0, 0, '2036-08-09T12:00:00.000Z') },
    afterCapture: capture('program-v1', 1, 0, '2036-08-10T12:00:00.000Z'),
    workouts: []
  });
  assert.deepEqual(result, { ok: false, changed: true, reasonCode: 'PROGRAM_TRANSITION_UNPROVABLE' });
});

test('queued revisions are strictly newer than their accepted base without rewriting transition time', () => {
  assert.equal(runtime.operationTimestamp('2036-08-10T12:00:00.000Z', {
    changed: true,
    lastTransition: { occurredAt: '2036-08-10T12:00:01.000Z' }
  }, Date.parse('2036-08-10T12:00:02.000Z')), '2036-08-10T12:00:01.000Z');
  assert.equal(runtime.operationTimestamp('2036-08-10T12:00:00.000Z', {
    changed: false,
    lastTransition: null
  }, Date.parse('2036-08-10T11:59:59.000Z')), '2036-08-10T12:00:00.001Z');
});

test('runtime assets and deployment config are attached without exposing fingerprints in ordinary UI copy', async () => {
  const [manifest, workflow, configWriter, html, source] = await Promise.all([
    readFile(new URL('../asset-manifest.js', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/write-cloud-config.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../program-portability.js', import.meta.url), 'utf8')
  ]);
  for (const asset of ['program-domain-envelope.js', 'program-domain-sync.js', 'program-domain-recovery.js', 'program-domain-cutover.js', 'program-portability.js']) {
    assert.match(manifest, new RegExp(asset.replace('.', '\\.')));
    assert.match(workflow, new RegExp(asset.replace('.', '\\.')));
  }
  assert.match(configWriter, /BIG_GAINS_PROGRAM_PORTABILITY/);
  assert.match(configWriter, /programPortabilityVersion/);
  assert.match(html, /id="programPortabilityStatus"/);
  assert.doesNotMatch(source, /Revision [${}]/);
  assert.doesNotMatch(source, /Fingerprint [${}]/);
});

for (const interleaving of ['normal-save', 'Program-queue', 'unchanged']) test(`accepted Program continuation preserves ownership after ${interleaving}`, async () => {
  const storage = new Map(), pending = [];
  const key = 'synthetic-profile-state';
  const profile = { id: 'synthetic-profile', goals: {} };
  const account = { accountId: 'local-account', profileId: profile.id, storageKey: key };
  const cloudOwner = { account: { id: 'cloud-account' }, profiles: [{ id: 'cloud-profile', client_id: profile.id, account_id: 'cloud-account' }] };
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  const before = { version: 5, profileId: profile.id, goals: {}, workouts: [], weights: [], activeWorkout: null, restTimerEndsAt: null, customRoutines: {} };
  storage.set(key, JSON.stringify(before));
  const scope = { console, localStorage, queueMicrotask, navigator: { onLine: true, locks: { request: async (_name, _options, callback) => callback({ name: 'owned' }) } }, addEventListener() {},
    document: { visibilityState: 'visible', getElementById: () => null, addEventListener() {} },
    bigGainsAccounts: { registry: { accounts: [account], resolve: () => account }, activeSelectionKey: 'selection', runtime: { kind: 'independent', authUserId: 'user', storageNamespace: 'synthetic-runtime' }, matchesCloudOwner: () => true },
    BigGainsProgramModel: { normalizeCapture: value => value },
    BigGainsSupabase: { getClient: () => ({}), verifiedUser: async () => ({ id: 'user' }), readCloudAccount: async () => cloudOwner },
    __BIG_GAINS_CLOUD_CONFIG__: { programPortability: true, programPortabilityVersion: 1 },
    BigGainsCloud: { createDurableQueue: () => ({ pending: () => pending }) },
    BigGainsProgramDomainSync: { isProgramDomainOperation: operation => operation.entityType === 'program_domains', createService: () => ({}) },
    BigGainsProgramDomainCutover: { createService: () => ({ inspectCutover: async () => ({ state: 'cloud_available' }) }) },
    PROFILE: profile, ACCOUNT: account, state: before, active: null, exerciseCatalog: {} };
  scope.window = scope; vm.createContext(scope);
  vm.runInContext(await readFile(new URL('../state-persistence.js', import.meta.url), 'utf8'), scope);
  await scope.bigGainsStatePersistence.writerReady;
  const store = scope.bigGainsStatePersistence.create({ account, profile, profileConfig: { [profile.id]: profile }, validWorkoutTypes: ['Push'], createId: () => 'id', slug: value => value });
  store.load(); scope.statePersistenceApi = store;
  const acceptedKey = 'big-gains-program-domain-accepted-v1-synthetic-runtime-synthetic-profile';
  const accepted = JSON.stringify({ format: 'big-gains.program-domain-accepted.v1', owner: { accountId: 'cloud-account', profileId: 'cloud-profile' }, scope: { accountId: account.accountId, profileId: profile.id }, remote: { record: { version: 1 }, envelope: {} } });
  storage.set(acceptedKey, accepted);
  const remote = { record: { version: 2 }, envelope: { synthetic: 'remote' } };
  let candidateRaw, newerRaw;
  scope.BigGainsProgramDomainRecovery = { states: { REMOTE_FAST_FORWARD_SAFE: 'safe' },
    readRemote: async () => ({ state: 'valid', remote }), classify: async () => ({ state: 'safe' }),
    adopt: async () => {
      const candidate = { ...before, programCapture: { synthetic: 'adopted' } };
      store.save(candidate, null); candidateRaw = storage.get(key);
      // Run between the async domain result and the runtime's accepted-base write.
      queueMicrotask(() => {
        if (interleaving === 'normal-save') {
          const newer = { ...candidate, workouts: [{ id: 'new-durable-history', type: 'Push', completedAt: '2026-10-14T12:00:00.000Z', exercises: [{ name: 'Bench', sets: [] }] }] };
          store.save(newer, null); newerRaw = storage.get(key);
        } else if (interleaving === 'Program-queue') pending.push({ entityType: 'program_domains', idempotencyKey: 'newer-program-operation' });
      });
      return { ok: true, profileRaw: candidateRaw };
    } };
  vm.runInContext(await readFile(new URL('../program-portability.js', import.meta.url), 'utf8'), scope);
  const api = scope.BigGainsProgramPortability; api.initialize(); await new Promise(resolve => setImmediate(resolve));
  const result = await api.useCloud();
  if (interleaving === 'unchanged') {
    assert.equal(JSON.parse(storage.get(acceptedKey)).remote.record.version, 2);
    assert.equal(storage.get(key), candidateRaw);
  } else {
    assert.equal(result.status, 'error');
    assert.equal(result.reasonCode, 'PROGRAM_RECOVERY_ADOPTION_STATE_CHANGED');
    assert.equal(storage.get(acceptedKey), accepted);
    assert.equal(storage.get(key), newerRaw || candidateRaw);
    assert.equal(pending.length, interleaving === 'Program-queue' ? 1 : 0);
  }
});
