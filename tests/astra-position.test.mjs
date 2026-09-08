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
