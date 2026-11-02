import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPTY,isCompleted,completeAutomatically,setManual,countCompleted} from '../src/js/progress.js';

test('automatic completion affects only the page passed forward',()=>{
  const s=EMPTY();completeAutomatically(s,'p12');
  assert.equal(countCompleted(s,['p1','p2','p12']),1);
  assert.equal(isCompleted(s.pages.p1),false);
});
test('manual incomplete always survives subsequent automatic completion',()=>{
  const s=EMPTY();completeAutomatically(s,'p1');setManual(s,'p1',false);
  for(let i=0;i<5;i++)completeAutomatically(s,'p1');
  assert.equal(isCompleted(s.pages.p1),false);
});
test('manual complete persists until explicitly changed',()=>{
  const s=EMPTY();setManual(s,'p1',true);completeAutomatically(s,'p1');
  assert.equal(isCompleted(s.pages.p1),true);
  setManual(s,'p1',false);assert.equal(isCompleted(s.pages.p1),false);
});
test('chapter progress uses actual completed page count',()=>{
  const s=EMPTY(),ids=Array.from({length:30},(_,i)=>'p'+i);
  for(const id of ids.slice(0,12))setManual(s,id,true);
  assert.equal(countCompleted(s,ids)/ids.length*100,40);
  for(const id of ids)setManual(s,id,true);
  assert.equal(countCompleted(s,ids),30);
});
test('overrides survive storage serialization',()=>{
  const s=EMPTY();setManual(s,'p1',false);completeAutomatically(s,'p1');setManual(s,'p2',true);
  const loaded=JSON.parse(JSON.stringify(s));
  assert.equal(isCompleted(loaded.pages.p1),false);assert.equal(isCompleted(loaded.pages.p2),true);
});
