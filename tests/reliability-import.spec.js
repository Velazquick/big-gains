import { test, expect } from '@playwright/test';
import { blankState, activeWorkout, completedWorkout } from './fixtures/local-storage.js';
import { openApp, reloadApp } from './helpers/app.js';

// This corpus holds the real asynchronous File.text boundary, then uses the
// actual controller and persistence ports. It never contacts a remote account.
test.use({ serviceWorkers: 'block' });

async function seed(page) {
  await page.context().route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.addInitScript(value => {
    if (localStorage.getItem('reliability-import-seed')) return;
    localStorage.setItem('big-gains-active-profile', 'jorge');
    localStorage.setItem('big-gains-v2', JSON.stringify(value));
    localStorage.setItem('reliability-import-seed', 'yes');
  }, { ...blankState('jorge'), workouts: [completedWorkout()], activeWorkout: activeWorkout({ startedAt: new Date().toISOString() }) });
  await openApp(page);
}

async function holdImport(page, changeBackup = value => value) {
  const messages = [];
  page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.accept(); });
  const backup = changeBackup(await page.evaluate(() => JSON.parse(statePersistenceApi.prepareExport(state).json)));
  await page.evaluate(() => {
    const original = File.prototype.text;
    const gate = new Promise(resolve => { window.releaseReliabilityImport = resolve; });
    File.prototype.text = async function () {
      const value = await original.call(this);
      window.reliabilityImportReading = true;
      await gate;
      return value;
    };
  });
  await page.locator('#importData').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.waitForFunction(() => window.reliabilityImportReading);
  return messages;
}

async function release(page) {
  await page.evaluate(() => releaseReliabilityImport());
  await page.waitForFunction(() => document.getElementById('importData').value === '');
}

test('import refuses newer saved same-owner History and set edits through reload', async ({ page }) => {
  await seed(page);
  const messages = await holdImport(page);
  const newer = await page.evaluate(() => {
    state.workouts[0].exercises[0].note = 'Newer performed History fact';
    saveState();
    workoutSessionController.updateSet(0, 1, 'weight', '135');
    return localStorage.getItem(ACCOUNT.storageKey);
  });
  await release(page);
  expect(await page.evaluate(() => localStorage.getItem(ACCOUNT.storageKey))).toBe(newer);
  expect(messages).toEqual(['Your training changed while the backup was being read. Choose the backup again.']);
  await reloadApp(page);
  expect(await page.evaluate(() => state.workouts[0].exercises[0].note)).toBe('Newer performed History fact');
  expect(await page.evaluate(() => Number(active.exercises[0].sets[1].weight))).toBe(135);
});

test('import refuses unsaved in-place live edits without publishing or discarding draft', async ({ page }) => {
  await seed(page);
  const messages = await holdImport(page);
  const before = await page.evaluate(() => {
    active.exercises[0].sets[1].weight = '145';
    return localStorage.getItem(ACCOUNT.storageKey);
  });
  await release(page);
  expect(await page.evaluate(() => active.exercises[0].sets[1].weight)).toBe('145');
  expect(await page.evaluate(() => localStorage.getItem(ACCOUNT.storageKey))).toBe(before);
  expect(messages[0]).toContain('training changed');
});

test('valid import persists before live publication and preserves pending queue bytes', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => BigGainsCloudSync.queue.enqueue(BigGainsCloud.createOperation({ owner: {accountId:'synthetic-account',profileId:'synthetic-profile'},entityType:'workouts',entityId:'retained-workout',mutation:'upsert',version:1,updatedAt:'2026-10-22T12:00:00.000Z',payload:{id:'retained-workout'},synthetic:true })));
  const beforeQueue = await page.evaluate(() => localStorage.getItem('big-gains-cloud-sync-queue-v1'));
  const messages = await holdImport(page, value => { value.workouts[0].exercises[0].note = 'Deliberate restored note'; return value; });
  await release(page);
  expect(messages).toEqual(['Backup restored for Jorge.']);
  await reloadApp(page);
  expect(await page.evaluate(() => state.workouts[0].exercises[0].note)).toBe('Deliberate restored note');
  expect(await page.evaluate(() => localStorage.getItem('big-gains-cloud-sync-queue-v1'))).toBe(beforeQueue);
});

test('failed import persistence leaves live and durable training intact', async ({ page }) => {
  await seed(page);
  const messages = await holdImport(page, value => { value.workouts = []; return value; });
  const before = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === ACCOUNT.storageKey) throw new DOMException('Synthetic quota', 'QuotaExceededError'); return original.call(this, key, value); };
    return { raw: localStorage.getItem(ACCOUNT.storageKey), live: JSON.stringify(state) };
  });
  await release(page);
  expect(await page.evaluate(() => ({ raw: localStorage.getItem(ACCOUNT.storageKey), live: JSON.stringify(state) }))).toEqual(before);
  expect(messages).toEqual(['Backup could not be saved. Your existing training is unchanged.']);
});

test('wrong-profile backup cannot replace local training', async ({ page }) => {
  await seed(page);
  const messages = await holdImport(page, value => ({ ...value, profileId: 'alexa' }));
  const before = await page.evaluate(() => localStorage.getItem(ACCOUNT.storageKey));
  await release(page);
  expect(messages[0]).toContain('belongs to Alexa');
  expect(await page.evaluate(() => localStorage.getItem(ACCOUNT.storageKey))).toBe(before);
});

for(const change of ['active-session','auth-generation','external-durable'])test(`import refuses changed ${change} intent without losing newer facts`,async({page})=>{
  await seed(page);const messages=await holdImport(page);
  const before=await page.evaluate(change=>{
    if(change==='active-session'){
      active={...structuredClone(active),id:'replacement-session'};state.activeWorkout=active;saveState();
    }else if(change==='auth-generation'){
      const api=BigGainsCloudSync;
      window.BigGainsCloudSync={...api,status:()=>({...api.status(),lifecycleGeneration:api.status().lifecycleGeneration+1})};
    }else{
      localStorage.setItem(ACCOUNT.storageKey,JSON.stringify({...state,goals:{primary:'New external durable fact'}}));
    }
    return localStorage.getItem(ACCOUNT.storageKey);
  },change);
  await release(page);
  expect(messages[0]).toContain('training changed');
  expect(await page.evaluate(()=>localStorage.getItem(ACCOUNT.storageKey))).toBe(before);
});

test('committed import survives optional presentation failure and background save',async({page})=>{
  await seed(page);const messages=await holdImport(page,value=>{value.workouts[0].exercises[0].note='Committed imported fact';return value;});
  await page.evaluate(()=>{window.renderAll=()=>{throw Error('Synthetic presentation failure');};});
  await release(page);
  expect(messages).toEqual(['Backup restored for Jorge.']);
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await reloadApp(page);
  expect(await page.evaluate(()=>state.workouts[0].exercises[0].note)).toBe('Committed imported fact');
});

test('import publishes committed live state without a new post-write readback failure window',async({page})=>{
  await seed(page);const messages=await holdImport(page,value=>{value.workouts[0].exercises[0].note='Retained imported fact';return value;});
  await page.evaluate(()=>{
    const get=Storage.prototype.getItem,set=Storage.prototype.setItem;let afterWrite=false;
    window.restoreImportFault=()=>{Storage.prototype.getItem=get;Storage.prototype.setItem=set;};
    Storage.prototype.setItem=function(key,value){const result=set.call(this,key,value);if(key===ACCOUNT.storageKey)afterWrite=true;return result;};
    Storage.prototype.getItem=function(key){if(key===ACCOUNT.storageKey&&afterWrite){afterWrite=false;window.importReadFaultObserved=true;throw Error('Synthetic one-shot post-write read fault');}return get.call(this,key);};
  });
  await release(page);
  await page.evaluate(()=>{restoreImportFault();saveBackgroundState();});
  expect(messages).toEqual(['Backup restored for Jorge.']);
  expect(await page.evaluate(()=>state.workouts[0].exercises[0].note)).toBe('Retained imported fact');
  await reloadApp(page);
  expect(await page.evaluate(()=>state.workouts[0].exercises[0].note)).toBe('Retained imported fact');
});
