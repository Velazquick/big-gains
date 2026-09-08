import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const window = {};
vm.runInNewContext(readFileSync(new URL('../train-position.js', import.meta.url), 'utf8'), { window });
const { resolve } = window.BigGainsTrainPosition;
const workout = { id:'workout', exercises:[{id:'a',sets:[{id:'a1'},{id:'a2'},{id:'a3'}]},{id:'b',sets:[{id:'b1'}]},{id:'c',sets:[]}] };
const record = {workoutId:'workout',exerciseId:'a',setId:'a2',exerciseOrder:['a','b','c'],setOrder:['a1','a2','a3']};
const plain = value => JSON.parse(JSON.stringify(value));
test('stable identities survive reorder without mutating session or bookmark',()=>{
  const live=structuredClone(workout);live.exercises.reverse();live.exercises[2].sets.reverse();
  const before=structuredClone(live);assert.deepEqual(plain(resolve(record,live)),{exerciseId:'a',setId:'a2'});assert.deepEqual(live,before);
});
test('deleted set resolves successor then predecessor within its exercise',()=>{
  const live=structuredClone(workout);live.exercises[0].sets.splice(1,1);
  assert.equal(resolve(record,live).setId,'a3');live.exercises[0].sets.pop();assert.equal(resolve(record,live).setId,'a1');
  live.exercises[0].sets=[];assert.equal(resolve(record,live).setId,null);
});
test('deleted exercise resolves successor then predecessor and clears set identity',()=>{
  const live=structuredClone(workout);live.exercises.shift();assert.deepEqual(plain(resolve(record,live)),{exerciseId:'b',setId:null});
  const removed={...record,exerciseId:'c'};assert.equal(resolve(removed,{...workout,exercises:workout.exercises.slice(0,2)}).exerciseId,'b');
});
test('replacement workout and empty workout never borrow the old anchor',()=>{
  assert.equal(resolve(record,{...workout,id:'new'}),null);assert.equal(resolve(record,{...workout,exercises:[]}),null);
});

function harness() {
  let current={namespace:'owner-a',accountId:'a',profileId:'p',workout:structuredClone(workout)};
  const values=new Map(),events=new Map(),frames=[],scrolls=[];
  const target={getClientRects:()=>[{}],getBoundingClientRect:()=>({top:900,bottom:944,height:44})};
  const card={dataset:{exerciseId:'a'},querySelectorAll:()=>[{...target,dataset:{setId:'a2'}}],querySelector:()=>target};
  const root={documentElement:{dataset:{runtimeState:'interactive'}},body:{dataset:{view:'train'}},visibilityState:'visible',
    addEventListener:(name,fn)=>events.set(name,fn),querySelector:()=>null,getElementById:()=>null,
    querySelectorAll:selector=>selector.startsWith('#activeExercises')?[card]:[]};
  const host={requestAnimationFrame:fn=>frames.push(fn),innerHeight:844,addEventListener:(name,fn)=>events.set(name,fn),scrollBy:value=>scrolls.push(value),scrollTo:value=>scrolls.push(value)};
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const api=window.BigGainsTrainPosition.create({getContext:()=>current,root,host,storage:()=>storage});
  const flush=()=>{while(frames.length)frames.shift()();};
  const visibility=value=>{root.visibilityState=value;events.get('visibilitychange')();};
  return {api,root,host,values,scrolls,flush,visibility,events,setContext:value=>{current=value;}};
}
test('one foreground restore is consumed before later renders and respects navigation',()=>{
  const h=harness();h.api.capture('a','a2');h.visibility('hidden');h.visibility('visible');h.flush();assert.equal(h.scrolls.length,1);
  h.api.afterRender();h.visibility('visible');h.flush();assert.equal(h.scrolls.length,1);
  h.visibility('hidden');h.root.body.dataset.view='progress';h.api.viewChanged();h.visibility('visible');h.flush();assert.equal(h.scrolls.length,1);
});
test('user input cancels a pending restoration and completion bookmark wins',()=>{
  const h=harness();h.api.capture('a','a2');h.visibility('hidden');h.visibility('visible');h.events.get('keydown')();h.flush();assert.equal(h.scrolls.length,0);
  h.api.capture('b','b1');h.visibility('hidden');const saved=JSON.parse([...h.values.values()][0]);assert.equal(saved.exerciseId,'b');assert.equal(saved.setId,'b1');
});
test('unresolved identity and replacement owner cannot restore a prior owner anchor',()=>{
  const h=harness();h.api.capture('a','a2');h.visibility('hidden');h.setContext(null);h.visibility('visible');h.flush();assert.equal(h.scrolls.length,0);
  h.setContext({namespace:'owner-b',accountId:'b',profileId:'p',workout:structuredClone(workout)});assert.equal(h.api.requestRestore(),false);h.flush();assert.equal(h.scrolls.length,0);
});

test('restoration fits the visual viewport when the software keyboard reduces usable height',()=>{
  const h=harness();h.host.visualViewport={offsetTop:100,height:360};h.api.capture('a','a2');h.visibility('hidden');h.visibility('visible');h.flush();
  const delta=h.scrolls[0].top;assert.equal(944-delta,448);assert.ok(900-delta>=112);assert.equal(h.scrolls.length,1);
});
