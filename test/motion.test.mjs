import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPaperMotion, pointerDepth } from '../web/paper-motion.js';

test('paper movement stays bounded even when a pointer leaves the viewport', () => {
  assert.deepEqual(pointerDepth(-200, 900, 320, 600), { x:-12, y:7 });
  assert.deepEqual(pointerDepth(160, 300, 320, 600), { x:0, y:0 });
  assert.deepEqual(pointerDepth(1, 1, 0, 0), { x:0, y:0 });
});

test('pointer input coalesces per frame and follows pause, touch and accessibility preferences', t => {
  const page = new EventTarget(), win = new EventTarget(), reduced = new EventTarget(), fine = new EventTarget();
  const frames = [], preferences = new Map(), toggles = new Map();
  reduced.matches = false; fine.matches = true;
  const layer = { style:{}, setAttribute(){} };
  page.documentElement = Object.assign(new EventTarget(), { classList:{ toggle:(key,value) => toggles.set(key,value) } });
  Object.assign(page, { body:{ prepend(){} }, hidden:false, createElement:() => layer, querySelector:() => null });
  const globals = { document:page, window:win, innerWidth:200, innerHeight:100, matchMedia:query => query.includes('reduce') ? reduced : fine,
    localStorage:{ getItem:key => preferences.get(key), setItem:(key,value) => preferences.set(key,value) },
    requestAnimationFrame:callback => { frames.push(callback); return frames.length; } };
  for (const [key,value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true});
    t.after(() => original ? Object.defineProperty(globalThis,key,original) : delete globalThis[key]);
  }
  function pointer(x, type='mouse') {
    page.dispatchEvent(Object.assign(new Event('pointermove'), {clientX:x,clientY:50,pointerType:type}));
  }
  const button = { setAttribute(){} };
  mountPaperMotion(button);
  pointer(0); pointer(200);
  assert.equal(frames.length,1); frames.shift()();
  assert.equal(layer.style.transform,'translate3d(12px,0px,0)');
  pointer(0,'touch'); assert.equal(frames.length,0);
  button.onclick(); frames.shift()(); pointer(0);
  assert.equal(frames.length,0); assert.equal(toggles.get('motion-paused'),true);
  button.onclick();
  reduced.matches = true; reduced.dispatchEvent(new Event('change'));
  pointer(0); assert.equal(frames.length,0); assert.equal(button.disabled,true);
});
