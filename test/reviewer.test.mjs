import test from 'node:test';
import assert from 'node:assert/strict';
import { nextReview } from '../web/review-model.js';
import { printCase } from '../web/case-sheet.js';

test('continue review skips decisions, prioritizes inferences and stops at the last open step', () => {
  const cases = [{ id:'A', steps:[{ id:'1', status:'missing' }, { id:'2', status:'observed' }] },
    { id:'B', steps:[{ id:'1', status:'inferred' }, { id:'2', status:'inferred' }] }];
  const reviews = { 'B/1':{decision:'flagged'} };
  assert.equal(nextReview(cases, reviews, 'A','2').step.id, '2');
  reviews['B/2'] = { decision:'confirmed' };
  assert.equal(nextReview(cases, reviews, 'B','2').item.id, 'A');
  assert.equal(nextReview(cases, reviews, 'A','1'), undefined);
});

test('case print sheet includes sources, saved review and exclusions, and clears after printing', t => {
  const values = [];
  let removed = false, printed = false, close;
  const element = () => ({ append(){}, set textContent(value){values.push(value);}, remove(){removed = true;} });
  const document = { createElement:element, body:element(), querySelector(){return null;} };
  const window = { print(){printed = true;}, addEventListener(name,func){assert.equal(name,'afterprint'); close=func;} };
  for (const [key,value] of Object.entries({document,window})) {
    const previous = Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(() => previous ? Object.defineProperty(globalThis,key,previous) : delete globalThis[key]);
  }
  const record = { source:'email', at:'2026-03-04T13:00:00Z', text:'Reviewed receipt', reason:'Thread matched', origin:'Record 8', timeKind:'Recorded' };
  const item = { id:'A', steps:[{ id:'s', label:'Receipt', status:'observed', evidence:[record],
    excludedEvidence:[{ origin:'Record 9', correction:{reason:'Wrong request'} }] }] };
  printCase({process:'Procurement'},item,{'A/s':{decision:'confirmed',note:'Checked with owner'}},true);
  assert.ok(printed);
  for (const term of ['Reviewed receipt','Thread matched','Record 8','Checked with owner','Wrong request']) {
    assert.ok(values.some(value => String(value).includes(term)));
  }
  close(); assert.ok(removed);
});
