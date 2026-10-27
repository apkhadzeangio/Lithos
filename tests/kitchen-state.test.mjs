import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { NUMBER_RULES, numericResult, projectNumericErrors, createShareController } from '../dist/kitchen/state-guards.mjs';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const html = read('dist/kitchen/index.html');
const moduleSource = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

class Clock {
  now = 0; nextId = 0; jobs = new Map();
  schedule = (fn, ms = 0) => { const id = ++this.nextId; this.jobs.set(id, { fn, at: this.now + ms }); return id; };
  cancel = id => this.jobs.delete(id);
  start() {
    const [id, job] = [...this.jobs].sort((a, b) => a[1].at - b[1].at)[0];
    this.jobs.delete(id); this.now = job.at; return job.fn();
  }
  async flush() { while (this.jobs.size) await this.start(); }
}

// This harness runs actual page handlers and model functions, without a browser or GPU.
// It deliberately does not claim to test layout, real focus traversal, touch or WebGL.
function fixture({ stored, hash = '', encodeOverride } = {}) {
  const clock = new Clock(), storage = new Map();
  if (stored !== undefined) storage.set('lithos-kitchen-v1', stored);
  const nodes = [], bySelector = new Map(), inputs = []; let copied = '';
  const doc = { activeElement: null, body: { classList: { add() {}, remove() {} } }, addEventListener() {} };
  class Element {
    constructor(tagName = 'DIV') { this.tagName = tagName; this.attributes = new Map(); this.dataset = {}; this.children = []; this.listeners = {}; this.style = {}; this.value = ''; this.checked = false; this.validity = { badInput: false }; this.hidden = false; this.removed = false; const cls = new Set(); this.classList = { contains: c => cls.has(c), add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), toggle: (c, on = !cls.has(c)) => (on ? cls.add(c) : cls.delete(c), on) }; nodes.push(this); }
    set value(value) { this.inputValue = String(value); }
    get value() { return this.inputValue; }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text || ''; }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    setCustomValidity(message) { this.validationMessage = message; this.validity.customError = !!message; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    remove() { this.removed = true; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    querySelectorAll() { return []; }
    closest(selector) { if (selector === 'button') return this.tagName === 'BUTTON' ? this : null; if (selector === 'label' || selector === '.mrow') return this.wrapper || null; return null; }
    focus() { doc.activeElement = this; }
    select() {}
    scrollIntoView() {}
  }
  doc.createElement = tag => new Element(tag.toUpperCase());
  doc.getElementById = id => nodes.find(n => n.id === id && !n.removed) || null;
  doc.querySelector = selector => {
    if (selector.startsWith('meta[') || selector.startsWith('script[')) return null;
    if (!bySelector.has(selector)) { const el = new Element(); el.id = selector.startsWith('#') && !selector.includes(' ') ? selector.slice(1) : ''; bySelector.set(selector, el); }
    return bySelector.get(selector);
  };
  doc.querySelectorAll = selector => selector === '#stepBody input' ? inputs : [];
  const guards = { NUMBER_RULES, numericResult, projectNumericErrors, createShareController: options => createShareController({ ...options, ...(encodeOverride ? { encode: encodeOverride } : {}), schedule: clock.schedule, cancel: clock.cancel }) };
  const context = vm.createContext({
    __guards: guards, document: doc, window: { devicePixelRatio: 1, lithosDesignerConfig: { endpoint: '' } },
    location: { hostname: 'lithos.ge', origin: 'https://lithos.ge', pathname: '/kitchen/', hash },
    navigator: { deviceMemory: 8, hardwareConcurrency: 8, clipboard: { writeText: async text => { copied = text; } } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    matchMedia: () => ({ matches: false }), performance: { now: () => clock.now },
    setTimeout: clock.schedule, clearTimeout: clock.cancel, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    Intl, console, TextEncoder, TextDecoder, Blob, Response, URL, Uint8Array, btoa, atob,
    fetch: () => { throw new Error('Tests must not call the network'); }
  });
  for (const f of ['dist/neolith-data.js', 'dist/quartz-data.js']) vm.runInContext(read(f), context);
  const source = moduleSource;
  const offset = source.indexOf('(async function boot()');
  const prelude = source.slice(0, offset).replace(/import \{[^}]+\} from '\.\/state-guards\.mjs';/, 'const { NUMBER_RULES, numericResult, projectNumericErrors, createShareController } = __guards;');
  vm.runInContext("'use strict';\n" + prelude, context);
  const run = code => vm.runInContext(code, context);
  run(`renderStep = () => { restoreInputErrors(); };
    renderSteps = () => {}; renderStats = () => {};
    refreshLive = () => { restoreInputErrors(); };
    scheduleRebuild = () => {}; init3D = async () => {};
    S = sanitize(DEFAULTS); model = computeModel(S);`);
  const emit = (type, target) => { for (const cb of doc.querySelector('#stepBody').listeners[type] || []) cb({ target, preventDefault() {} }); };
  return {
    run, clock, storage, doc, nodes,
    json: expression => JSON.parse(run('JSON.stringify(' + expression + ')')),
    copy: () => copied,
    shareHTML: () => doc.querySelector('#stepBody [data-live="send"]').innerHTML || '',
    boot: () => vm.runInContext(source.slice(offset), context),
    field(path, value, { act, i = 0, k = 'w', min = 0, max = 2000, badInput = false } = {}) {
      const el = new Element('INPUT'); el.wrapper = new Element('LABEL'); el.wrapper.appendChild(el);
      el.dataset = act ? { act, i: String(i), k } : { kind: 'num', path };
      el.value = String(value); el.setAttribute('min', min); el.setAttribute('max', max); el.validity.badInput = badInput;
      inputs.push(el); doc.activeElement = el; return el;
    },
    input: el => emit('input', el), change: el => emit('change', el),
    click(action, more = {}) { const b = new Element('BUTTON'); b.dataset = { act: action, ...more }; emit('click', b); },
    node: selector => doc.querySelector(selector)
  };
}

function projectFromLink(url) {
  const code = new URL(url).hash.slice(3);
  assert.equal(code[0], 'j'); // Harness has no CompressionStream; the page's existing JSON fallback is used.
  return JSON.parse(Buffer.from(code.slice(1), 'base64url').toString('utf8'));
}
function whatsappProject(markup) {
  const href = markup.match(/<a[^>]+href="([^"]+)"/)[1];
  const text = new URL(href).searchParams.get('text');
  return { text, url: text.split('\nპროექტი: ')[1] };
}

test('room dimensions reject negative, zero, empty, non-finite and out-of-range values', () => {
  for (const value of [-10, 0, '', null, Infinity, NaN, 'NaN', 'Infinity', 'abc', true, [], {}, 1201]) assert.equal(numericResult(value, NUMBER_RULES['room.w']).valid, false, String(value));
  for (const value of [200, 460, 1200, '500', '4e2']) assert.equal(numericResult(value, NUMBER_RULES['room.w']).valid, true, String(value));
});

test('nullable inputs distinguish intentional clearing from malformed numeric values', () => {
  assert.deepEqual(numericResult(null, NUMBER_RULES['quote.rate']), { valid: true, value: null, message: '' });
  assert.equal(numericResult('', NUMBER_RULES['quote.rate']).valid, false);
  assert.equal(numericResult('no', NUMBER_RULES['quote.rate']).valid, false);
  assert.equal(numericResult(-1, NUMBER_RULES['quote.rate']).valid, false);
  assert.equal(numericResult(-50, NUMBER_RULES['isl.shift']).value, -50);
});

test('default project, sparse legacy input and compatible filler modules remain loadable', () => {
  const f = fixture();
  assert.deepEqual(projectNumericErrors(f.json('DEFAULTS')), []);
  assert.deepEqual(projectNumericErrors({ room: { w: '500' }, mods: { A: [{ t: 'filler', w: 1.5 }] } }), []);
  assert.deepEqual(projectNumericErrors({ win: { on: true, x: 30, w: 100, h: 120, sill: 100 } }), []);
});

test('invalid restored/imported scalar values cannot silently become fallback measurements', () => {
  for (const value of [-10, 0, '', null, 'abc', Infinity]) assert.ok(projectNumericErrors({ room: { w: value } }).some(e => e.path === 'room.w'));
  for (const value of [null, [], 12, 'project']) assert.ok(projectNumericErrors(value).length);
  assert.ok(projectNumericErrors({ room: 'bad' }).length);
  assert.ok(projectNumericErrors({ quote: { waste: -1 } }).length);
});

test('invalid features, legacy windows and module widths are rejected before sanitize clamps them', () => {
  for (const feature of [{ t: 'window', x: -10 }, { t: 'window', x: 0, w: 0 }, { t: 'beam', x: 0, h: 0 }, { t: 'radiator', x: 0, d: 100 }]) assert.ok(projectNumericErrors({ feats: [feature] }).length);
  assert.ok(projectNumericErrors({ win: { on: true, x: 0, w: -50 } }).length);
  for (const w of [0, -10, 400, Infinity, 'abc']) assert.ok(projectNumericErrors({ mods: { A: [{ t: 'door', w }] } }).length);
});

test('live invalid dimensions preserve the state, model, saved data and calculation count', async () => {
  const f = fixture(); f.run('update(true)'); await f.clock.flush();
  const before = f.json('S'), beforeModel = f.json('model.q'), saved = f.storage.get('lithos-kitchen-v1');
  f.run('var computeCalls = 0; const originalCompute = computeModel; computeModel = (...args) => { computeCalls++; return originalCompute(...args); };');
  const el = f.field('room.w', '-10'); f.input(el);
  assert.deepEqual(f.json('S'), before); assert.deepEqual(f.json('model.q'), beforeModel);
  assert.equal(f.run('computeCalls'), 0); assert.equal(f.storage.get('lithos-kitchen-v1'), saved);
  assert.equal(el.getAttribute('aria-invalid'), 'true'); assert.match(el.validationMessage, /200/);
  assert.equal(f.node('#inputStatus').hidden, false); assert.doesNotMatch(f.shareHTML(), /href=/);
  // The default flow is now the workspace ('ws'); an invalid entry still blocks both navigation and switching flow.
  f.run('go(2); switchFlow("full");'); assert.equal(f.run('step'), 0); assert.equal(f.run('S.flow'), 'ws');
  el.value = '500'; f.input(el); assert.equal(f.run('S.room.w'), 500); assert.ok(f.run('computeCalls') > 0);
  assert.equal(el.getAttribute('aria-invalid'), null); await f.clock.flush(); assert.match(f.shareHTML(), /href=/);
});

test('restoring a rejected live value clears the error without changing the project', async () => {
  const f = fixture(); f.run('update(true)'); await f.clock.flush();
  const before = f.json('S'), el = f.field('room.w', ''); f.input(el);
  assert.equal(f.run('inputErrors.size'), 1);
  f.click('number-revert', { key: 'room.w' });
  assert.equal(el.value, '460'); assert.equal(f.run('inputErrors.size'), 0); assert.deepEqual(f.json('S'), before);
  assert.equal(f.node('#inputStatus').hidden, true); assert.equal(f.doc.activeElement, el); assert.match(f.shareHTML(), /href=/);
});

test('invalid feature and module editors never commit or materialize their values', () => {
  const f = fixture();
  const feature = f.field(null, '-5', { act: 'feat', i: 0, k: 'w', min: 10, max: 600 }); f.input(feature);
  assert.equal(f.run('S.feats[0].w'), 120);
  f.click('number-revert', { key: 'feature-0-w' });
  f.run('S.flow="full"; update(true);');
  const width = f.field(null, '-1', { act: 'mod-w', i: 0, min: 3, max: 300 }); f.change(width);
  assert.equal(f.run('S.mods.A'), null);
  width.value = '70'; f.input(width); assert.equal(f.run('S.mods.A'), null); // checked while typing, committed on change
  f.change(width); assert.equal(f.run('S.mods.A[0].w'), 70);
});

// Browser finding: these editors sit in lists that update() re-renders, so committing on every keystroke
// replaced the field under the cursor — typing "155" saved 1. They must not update until change.
test('typing in room-element and module-width fields does not re-render them before change', () => {
  const f = fixture(); f.run('update(true); var updates = 0; const realUpdate = update; update = (...a) => { updates++; return realUpdate(...a); };');
  const x = f.field(null, '1', { act: 'feat', i: 0, k: 'x', min: 0, max: 1200 });
  for (const v of ['1', '15', '155']) { x.value = v; f.input(x); }
  assert.equal(f.run('updates'), 0); assert.equal(f.run('S.feats[0].x'), 150); assert.equal(f.run('inputErrors.size'), 0);
  x.value = '-3'; f.input(x); assert.equal(f.run('inputErrors.size'), 1); assert.equal(x.getAttribute('aria-invalid'), 'true');
  x.value = '155'; f.input(x); assert.equal(f.run('inputErrors.size'), 0);
  f.change(x); assert.equal(f.run('updates'), 1); assert.equal(f.run('S.feats[0].x'), 155);
});

// Browser finding: change (fired by Tab) rebuilt the message and its button, so keyboard focus moving onto the button was dropped.
test('the revert button survives repeated validation so Tab can reach it', () => {
  const f = fixture(), el = f.field('room.w', '-10'); f.input(el);
  const box = f.doc.getElementById('validation-room-w'), button = box.children[1];
  assert.equal(button.dataset.act, 'number-revert');
  f.change(el); el.value = '-20'; f.input(el); f.run('refreshLive()');
  assert.equal(f.doc.getElementById('validation-room-w'), box); assert.equal(box.children[1], button); assert.ok(!button.removed);
  assert.match(box.children[0].textContent, /200/);
});

// Browser finding: leaving a field fires change, which refreshed the share buttons with identical markup
// in the middle of the click that caused the blur — the first click on copy/WhatsApp was lost.
test('unchanged share buttons are not rebuilt when a field is left', async () => {
  const f = fixture(); f.run('step=2; update(true);'); await f.clock.flush();
  const box = f.node('#stepBody [data-live="send"]'); let html = box.innerHTML, writes = 0;
  assert.match(html, /href=/);
  Object.defineProperty(box, 'innerHTML', { get: () => html, set: v => { writes++; html = v; } });
  const el = f.field('quote.waste', String(f.run('S.quote.waste'))); f.change(el); f.run('refreshShareActions()');
  assert.equal(writes, 0);
  el.value = '99'; f.input(el); assert.equal(writes, 1); assert.doesNotMatch(html, /href=/);
});

test('badInput does not erase a nullable value; clearing intentionally still works', () => {
  const f = fixture(); f.run('S.quote.rate=100; update(true);');
  const el = f.field('quote.rate', '', { badInput: true }); f.input(el);
  assert.equal(f.run('S.quote.rate'), 100);
  el.validity.badInput = false; f.input(el); assert.equal(f.run('S.quote.rate'), null);
});

test('a refused checkbox change returns its displayed value to committed state', () => {
  const f = fixture(); const width = f.field('room.w', '-10'); f.input(width);
  const toggle = f.field(null, 'on'); toggle.dataset = { kind: 'tog', path: 'isl.on' }; toggle.checked = false;
  f.change(toggle); assert.equal(toggle.checked, true); assert.equal(f.run('S.isl.on'), true);
});

test('JSON import is atomic on numeric errors and can replace an invalid draft explicitly', () => {
  const f = fixture(), before = f.json('S');
  f.node('#jsonBox').value = JSON.stringify({ room: { w: -10 } }); f.click('import');
  assert.deepEqual(f.json('S'), before); assert.match(f.node('#importMsg').textContent, /სიგანე/);
  f.input(f.field('room.w', '-10'));
  f.node('#jsonBox').value = JSON.stringify({ room: { w: 500 } }); f.click('import');
  assert.equal(f.run('S.room.w'), 500); assert.equal(f.run('inputErrors.size'), 0);
});

test('invalid stored dimensions are preserved while a labelled sample is shown', async () => {
  const stored = JSON.stringify({ room: { w: -10 } }), f = fixture({ stored });
  await f.boot(); await f.clock.flush();
  assert.equal(f.run('S.room.w'), 460); assert.equal(f.run('rejectedStoredProject'), true);
  assert.equal(f.storage.get('lithos-kitchen-v1'), stored); assert.match(f.node('#inputStatus').textContent, /ნიმუში/);
});

test('malformed and null stored JSON is not overwritten by a default autosave', async () => {
  for (const stored of ['not-json', 'null']) {
    const f = fixture({ stored }); await f.boot(); await f.clock.flush();
    assert.equal(f.storage.get('lithos-kitchen-v1'), stored); assert.equal(f.run('rejectedStoredProject'), true);
    assert.deepEqual([...f.storage.keys()], ['lithos-kitchen-v1']); // no backup until the user changes something
  }
});

// Browser finding: after a rejected saved project nothing was ever saved again, so the user's new work vanished on reload.
test('after a rejected saved project the first real change backs it up and saving resumes', async () => {
  for (const stored of ['not-json', JSON.stringify({ room: { w: -10 } })]) {
    const f = fixture({ stored }); await f.boot(); await f.clock.flush();
    f.run('S.room.d = 450; update(false);'); await f.clock.flush();
    const backups = [...f.storage].filter(([k]) => k.startsWith('lithos-kitchen-v1.unreadable-'));
    assert.equal(backups.length, 1); assert.equal(backups[0][1], stored);
    assert.equal(JSON.parse(f.storage.get('lithos-kitchen-v1')).room.d, 450); assert.equal(f.run('rejectedStoredProject'), false);
    assert.match(f.node('#inputStatus').textContent, /სარეზერვო/);
    f.run('S.room.d = 460; update(false);'); await f.clock.flush();
    assert.equal([...f.storage.keys()].filter(k => k.includes('unreadable')).length, 1); assert.equal(f.node('#inputStatus').hidden, true);
  }
});

test('importing over a rejected saved project keeps a backup of the old text', async () => {
  const stored = 'not-json', f = fixture({ stored }); await f.boot(); await f.clock.flush();
  f.node('#jsonBox').value = JSON.stringify({ room: { w: 520 } }); f.click('import'); await f.clock.flush();
  assert.equal(JSON.parse(f.storage.get('lithos-kitchen-v1')).room.w, 520);
  assert.ok([...f.storage].some(([k, v]) => k.startsWith('lithos-kitchen-v1.unreadable-') && v === stored));
});

test('an invalid shared project falls back to the valid saved project', async () => {
  const stored = JSON.stringify({ room: { w: 500 } });
  const hash = '#p.j' + Buffer.from(JSON.stringify({ room: { w: -10 } })).toString('base64url');
  const f = fixture({ stored, hash }); await f.boot(); await f.clock.flush();
  assert.equal(f.run('S.room.w'), 500); assert.equal(f.run('rejectedStoredProject'), false); assert.match(f.run('loadNotice'), /ბმულიდან/);
});

for (const [flow, step] of [['quick', 2], ['full', 6], ['ws', 3]]) test(`${flow}: WhatsApp and copied URLs contain the same updated project`, async () => {
  const f = fixture(); f.run(`S.flow=${JSON.stringify(flow)}; step=${step}; update(true);`); await f.clock.flush();
  const el = f.field('quote.waste', '15'); f.input(el);
  assert.doesNotMatch(f.shareHTML(), /href=/); // Old URL must not be clickable while new encoding is pending.
  f.click('share'); assert.equal(f.copy(), '');
  await f.clock.flush(); const wa = whatsappProject(f.shareHTML());
  assert.equal(projectFromLink(wa.url).quote.waste, 15);
  f.click('share'); await Promise.resolve(); assert.equal(f.copy(), wa.url);
  assert.deepEqual(projectFromLink(f.copy()), f.json('S'));
});

test('the share text and payload are captured together before later mutation', async () => {
  const clock = new Clock(), controller = createShareController({ encode: async p => JSON.stringify(p), baseUrl: 'https://lithos.ge/kitchen/', schedule: clock.schedule, cancel: clock.cancel });
  const project = { stone: 'A' }; controller.queue(project, 'stone A'); project.stone = 'B';
  await clock.flush(); assert.match(controller.current().url, /"A"/); assert.equal(controller.current().text, 'stone A');
});

test('rapid queued changes coalesce and clear the previously clickable URL immediately', async () => {
  const clock = new Clock(), calls = [], controller = createShareController({ encode: async p => { calls.push(p); return p.id; }, baseUrl: 'https://lithos.ge/kitchen/', schedule: clock.schedule, cancel: clock.cancel });
  controller.queue({ id: 'old' }, 'old'); await clock.flush();
  controller.queue({ id: 'A' }, 'A'); assert.equal(controller.current().url, '');
  controller.queue({ id: 'B' }, 'B'); controller.queue({ id: 'C' }, 'C'); await clock.flush();
  assert.deepEqual(calls.map(c => c.id), ['old', 'C']); assert.match(controller.current().url, /#p.C$/); assert.equal(controller.current().text, 'C');
});

test('an older encoding cannot replace the newer result even when it finishes last', async () => {
  const clock = new Clock(), pending = new Map();
  const controller = createShareController({ encode: p => new Promise(resolve => pending.set(p.id, resolve)), baseUrl: 'https://lithos.ge/kitchen/', schedule: clock.schedule, cancel: clock.cancel });
  controller.queue({ id: 'A' }, 'A'); const a = clock.start();
  controller.queue({ id: 'B' }, 'B'); const b = clock.start();
  pending.get('B')('B'); await b; pending.get('A')('A'); await a;
  assert.match(controller.current().url, /#p.B$/); assert.equal(controller.current().text, 'B');
});

test('an older failed encoding does not clear a newer successful result', async () => {
  const clock = new Clock(), pending = new Map();
  const controller = createShareController({ encode: p => new Promise((resolve, reject) => pending.set(p.id, { resolve, reject })), baseUrl: 'https://lithos.ge/kitchen/', schedule: clock.schedule, cancel: clock.cancel });
  controller.queue({ id: 'A' }, 'A'); const a = clock.start(); controller.queue({ id: 'B' }, 'B'); const b = clock.start();
  pending.get('B').resolve('B'); await b; pending.get('A').reject(new Error('old failure')); await a;
  assert.equal(controller.current().error, null); assert.match(controller.current().url, /#p.B$/);
});

test('a failed latest encoding hides the stale URL and can be retried', async () => {
  const clock = new Clock(); let fail = false;
  const controller = createShareController({ encode: async p => { if (fail) throw Error('failed'); return p.id; }, baseUrl: 'https://lithos.ge/kitchen/', schedule: clock.schedule, cancel: clock.cancel });
  controller.queue({ id: 'A' }, 'A'); await clock.flush(); fail = true;
  controller.queue({ id: 'B' }, 'B'); await clock.flush(); assert.equal(controller.current().url, ''); assert.equal(controller.current().error, 'encode');
  fail = false; controller.queue({ id: 'B' }, 'B'); await clock.flush(); assert.match(controller.current().url, /#p.B$/);
});

test('the inline UI exposes retry after an encoding failure and recovers', async () => {
  let calls = 0;
  const f = fixture({ encodeOverride: async p => { if (++calls === 1) throw Error('failed'); return 'j' + Buffer.from(JSON.stringify(p)).toString('base64url'); } });
  f.run('step=2; update(true);'); await f.clock.flush(); assert.match(f.shareHTML(), /share-retry/); assert.doesNotMatch(f.shareHTML(), /href=/);
  f.click('share-retry'); await f.clock.flush(); assert.match(f.shareHTML(), /href=/);
});

test('valid restored projects keep their dimensions and nullable quote fields', async () => {
  const f = fixture({ stored: JSON.stringify({ room: { w: 500, d: 350, h: 280 }, quote: { rate: null, waste: 15 } }) });
  await f.boot(); await f.clock.flush();
  assert.deepEqual(f.json('S.room'), { w: 500, d: 350, h: 280 }); assert.equal(f.run('S.quote.rate'), null); assert.equal(f.run('S.quote.waste'), 15);
});

test('numeric strings in nullable imported quote fields become numbers before arithmetic', () => {
  const f = fixture();
  f.node('#jsonBox').value = JSON.stringify({ quote: { rate: '100', install: '50', extra: '20', waste: '15' } });
  f.click('import');
  assert.deepEqual(f.json('S.quote'), { rate: 100, install: 50, extra: 20, waste: 15 });
});

test('visible room limits use the same configured bounds as committed state', () => {
  const f = fixture(), field = f.run('num("room.w", "სიგანე")');
  assert.match(field, /min="200"/); assert.match(field, /max="1200"/);
  assert.ok(projectNumericErrors({ room: { w: 199 } }).length);
  assert.deepEqual(projectNumericErrors({ room: { w: 200 } }), []);
});

test('an unfinished negative entry does not erase the existing offset or prevent completing it', () => {
  const f = fixture(); f.run('S.flow="full"; update(true);');
  const old = f.run('S.isl.shift'), field = f.field('isl.shift', '', { badInput: true });
  f.input(field); assert.equal(f.run('S.isl.shift'), old);
  field.validity.badInput = false; field.value = '-50'; f.input(field);
  assert.equal(f.run('S.isl.shift'), -50); assert.equal(f.run('inputErrors.size'), 0);
});

// Goldens recorded from main at 888c7749532473df3cb9a73e127b2ba4f3f071ca.
for (const [id, type, a, b, island, area, warnings] of [
  ['default', 'L', 460, 290, true, 11.0964, 0],
  ['small', 'L', 260, 140, false, 3.7564, 1],
  ['galley', 'L', 420, 150, false, 5.4304, 0],
  ['square', 'L', 400, 300, false, 6.8764, 0],
  ['newbuild', 'L', 430, 230, false, 6.3094, 0],
  ['studio', 'I', 600, null, true, 9.216, 0]
]) test(`existing ${id} sample keeps its baseline layout and material calculation`, () => {
  const f = fixture();
  f.run(`S=clone(DEFAULTS); ${id === 'default' ? '' : `{
    const t=ROOM_TPL[${JSON.stringify(id)}];
    S.room={...S.room,...t.room}; S.feats=clone(t.feats); S.sk.walls={...t.walls}; S.sk.isl=t.isl; S.sk.family=t.fam;
  }`} autoDesign(S); model=computeModel(S);`);
  assert.equal(f.run('S.lay.type'), type); assert.equal(f.run('S.lay.a'), a);
  if (b !== null) assert.equal(f.run('S.lay.b'), b);
  assert.equal(f.run('S.isl.on'), island); assert.ok(Math.abs(f.run('model.q.total') - area) < 1e-9);
  assert.equal(f.run('model.warns.filter(w=>w.level==="error").length'), 0);
  assert.equal(f.run('model.warns.filter(w=>w.level==="warn").length'), warnings);
});

/* ---------------- workspace: shape & island → materials → fit to the room → price ---------------- */
const layoutOf = f => f.json('{ lay: S.lay, isl: S.isl, sink: S.sink, hob: S.hob, fridge: S.fridge, dw: S.dw, pantry: S.pantry, mods: S.mods, oven: S.oven, hood: S.hood }');
const materialsOf = f => f.json('{ stone: S.stone, front: S.front, int: S.int }');
const fitErrors = f => f.json('autoNotes.filter(n => n.level === "error").map(n => ({ text: n.text, fixes: (n.fixes || []).map(x => x.label) }))');

test('a first visit opens the workspace with a labelled, complete sample kitchen', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  assert.equal(f.run('S.flow'), 'ws'); assert.equal(f.run('S.sk.dims'), 'sample'); assert.equal(f.run('S.sk.fsample'), true);
  assert.equal(f.run('curSteps().map(s => s.t).join("|")'), 'ფორმა|მასალები|ზომები|ფასი');
  assert.equal(f.run('S.lay.type'), 'L'); assert.equal(f.run('!!model.isl'), true); assert.deepEqual(fitErrors(f), []);
  assert.match(f.run('wsStageHTML()'), /ნიმუში<\/b> — ზომები შეგიძლია შეცვალო/);
  assert.match(f.run('requestText()'), /ზომები: ნიმუში/);   // the sample is never sent as measured data
});

for (const shape of ['I', 'L', 'U']) for (const island of [true, false]) test(`workspace sample: ${shape} ${island ? 'with' : 'without'} island is fully arranged and fits`, async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  f.click('ws-shape', { v: shape }); f.click('ws-island', { v: island ? 'yes' : 'no' });
  assert.equal(f.run('S.lay.type'), shape); assert.equal(f.run('S.isl.on'), island);
  assert.deepEqual(f.json('S.room'), f.json(`WS_SAMPLES[${JSON.stringify(shape + (island ? '+' : ''))}].room`));
  assert.equal(f.run('S.sk.dims'), 'sample'); assert.deepEqual(fitErrors(f), []);
  assert.equal(f.run('model.warns.filter(w => w.level === "error").length'), 0);
  assert.ok(f.run('model.items.A.some(m => m.t === "sink") || model.items[model.sinkRun].some(m => m.t === "sink")'));
  assert.ok(f.run('model.q.total') > 2);
});

test('changing the stone never moves the layout; an unavailable thickness is switched and explained', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  const before = layoutOf(f);
  f.click('mat', { v: 'quartz:quartz-calacatta-vita' });
  assert.equal(f.run('S.stone.main'), 'quartz:quartz-calacatta-vita'); assert.equal(f.run('S.stone.t'), 20);
  assert.match(f.node('#toast').textContent, /12 მმ სისქით არ მზადდება — არჩეულია 20 მმ/);
  assert.deepEqual(layoutOf(f), before);
  f.click('mat', { v: 'neolith:nero-marquina' }); assert.deepEqual(layoutOf(f), before);
});

test('changing the shape or the room keeps every material and colour', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  f.click('mat', { v: 'neolith:beton' }); f.run('ui.wsScope = "all"'); f.click('ws-color', { v: 'navy' }); f.run('S.front.type = "shaker"; update(false)');
  const mats = materialsOf(f);
  for (const v of ['U', 'I', 'L']) { f.click('ws-shape', { v }); assert.deepEqual(materialsOf(f), mats, v); }
  f.click('ws-island', { v: 'no' }); assert.deepEqual(materialsOf(f), mats);
  const w = f.field('room.w', '520'); f.input(w); assert.deepEqual(materialsOf(f), mats);
});

test('cabinet colour applies to the named group only', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  f.run('ui.wsScope = "all"'); f.click('ws-color', { v: 'white' });
  assert.deepEqual(f.json('[S.front.base, S.front.up, S.front.isl]'), ['white', null, null]);
  f.run('ui.wsScope = "base"'); f.click('ws-color', { v: 'sage' });
  assert.deepEqual(f.json('[S.front.base, S.front.up, S.front.isl]'), ['sage', 'white', 'white']);   // uppers and island keep their look
  f.run('ui.wsScope = "up"'); f.click('ws-color', { v: 'sage' });
  assert.equal(f.run('S.front.up'), null);   // same as base again
  assert.match(f.run('ui.wsT = "cab"; ui.wsScope = "isl"; wsChangingHTML()'), /კუნძულის კარადების ფერი/);
});

test('typing the room size turns the sample into the user\'s room; the kitchen refits automatically', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  const a0 = f.run('S.lay.a');
  const w = f.field('room.w', '380'); f.input(w);
  assert.equal(f.run('S.room.w'), 380); assert.equal(f.run('S.sk.dims'), 'user'); assert.notEqual(f.run('S.lay.a'), a0);
  assert.ok(f.run('S.feats.every(x => x.x + (x.w || 0) <= (x.wall === "back" || x.wall === "front" ? S.room.w : S.room.d))'));   // sample window/door slid inside
  assert.doesNotMatch(f.run('requestText()'), /ზომები: ნიმუში/);
  assert.doesNotMatch(f.run('wsStageHTML()'), /ნიმუში/);
});

test('a typed run length is kept, a too-long one is explained with fixes, "automatic" gives it back', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  const a = f.field('lay.a', '300'); f.input(a);
  assert.equal(f.run('S.sk.fix.a'), true); assert.equal(f.run('S.lay.a'), 300);
  f.run('S.room.d = 450; update(false);'); assert.equal(f.run('S.lay.a'), 300);
  a.value = '700'; f.input(a);
  const errs = fitErrors(f); assert.equal(errs.length, 1); assert.match(errs[0].text, /A მონაკვეთი 700 სმ-ია/);
  assert.ok(errs[0].fixes.includes('ავტომატურად'));
  f.click('ws-fix', { n: '0', f: '0' }); assert.ok(f.run('S.lay.a') <= f.run('S.room.w')); assert.deepEqual(fitErrors(f), []);
  f.click('ws-auto', { v: 'a' }); assert.equal(f.run('S.sk.fix.a'), false);
});

test('an island that no longer fits is kept as a choice, with the reason and concrete fixes', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  const d = f.field('room.d', '300'); f.input(d);
  assert.equal(f.run('S.sk.island'), true); assert.equal(f.run('S.isl.on'), false);   // not silently deleted
  const errs = fitErrors(f); assert.equal(errs.length, 1);
  assert.match(errs[0].text, /კუნძული ვერ ეტევა: ოთახის სიღრმე 300 სმ-ია/);
  assert.ok(errs[0].fixes.some(x => /სიღრმე → \d+ სმ/.test(x))); assert.ok(errs[0].fixes.includes('კუნძულის გარეშე'));
  assert.match(f.run('wsStageHTML()'), /კუნძული ვერ ეტევა — გამოსავალი/);
  f.click('ws-fix', { n: '0', f: '0' });   // deepen the room
  assert.equal(f.run('S.isl.on'), true); assert.deepEqual(fitErrors(f), []);
});

test('a U kitchen that does not fit says why and offers another shape; the choice is preserved', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  f.click('ws-island', { v: 'no' });
  const w = f.field('room.w', '220'); f.input(w);   // 2 × 62 cm legs leave less than 100 cm in the middle
  f.click('ws-shape', { v: 'U' });
  assert.equal(f.run('S.sk.shape'), 'U');
  const errs = fitErrors(f); assert.ok(errs.length >= 1);
  assert.match(errs[0].text, /U-ს ფორმის სამზარეულო ამ ოთახში ბოლომდე ვერ ეტევა/);
  assert.ok(errs[0].fixes.some(x => /სიგანე → \d+ სმ/.test(x)));
});

test('undo returns the previous shape, island and sample room', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  const room0 = f.json('S.room');
  f.clock.now += 1000; f.click('ws-shape', { v: 'U' });
  f.clock.now += 1000; f.click('ws-island', { v: 'no' });
  f.run('histGo(true)'); assert.equal(f.run('S.sk.island'), true); assert.equal(f.run('S.sk.shape'), 'U');
  f.run('histGo(true)'); assert.equal(f.run('S.sk.shape'), 'L'); assert.deepEqual(f.json('S.room'), room0);
  f.run('histGo(false)'); assert.equal(f.run('S.sk.shape'), 'U');
});

test('workspace: saved project, shared link and screen state are the same; reopening restores it', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  f.click('ws-shape', { v: 'U' }); f.click('mat', { v: 'neolith:arena' }); f.input(f.field('room.w', '520'));
  await f.clock.flush();
  const saved = JSON.parse(f.storage.get('lithos-kitchen-v1'));
  assert.deepEqual(saved, f.json('S'));
  f.run('step = 3; update(true)'); await f.clock.flush();
  const wa = whatsappProject(f.shareHTML()); assert.deepEqual(projectFromLink(wa.url), f.json('S'));
  const g = fixture({ stored: JSON.stringify(saved) }); await g.boot(); await g.clock.flush();
  assert.deepEqual(g.json('S'), saved); assert.equal(g.run('S.sk.shape'), 'U'); assert.equal(g.run('S.sk.dims'), 'user');
  const h = fixture({ hash: new URL(wa.url).hash }); await h.boot(); await h.clock.flush();
  assert.deepEqual(h.json('S'), saved);
});

test('a project from the earlier sketch mode opens in the workspace with the same kitchen', async () => {
  const f = fixture(); f.run('S = clone(DEFAULTS); S.flow = "quick"; S.room.w = 400; S.room.d = 400; S.sk.isl = "no"; autoDesign(S);');
  const old = f.json('S'), before = f.json('{ lay: S.lay, on: S.isl.on }');
  const g = fixture({ stored: JSON.stringify(old) }); await g.boot(); await g.clock.flush();
  assert.equal(g.run('S.flow'), 'ws'); assert.equal(g.run('S.sk.dims'), 'user');
  assert.deepEqual(g.json('{ lay: S.lay, on: S.isl.on }'), before);
});

test('moving a sample window makes the room the user\'s: a later shape change keeps it', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  const x = f.field(null, '40', { act: 'feat', i: 0, k: 'x', min: 0, max: 1200 }); f.change(x);
  assert.equal(f.run('S.sk.fsample'), false); assert.equal(f.run('S.sk.dims'), 'sample');
  const room = f.json('S.room'), feats = f.json('S.feats');
  f.click('ws-shape', { v: 'I' }); assert.deepEqual(f.json('S.room'), room); assert.deepEqual(f.json('S.feats'), feats);
  assert.match(f.run('requestText()'), /ზომები: ნიმუში/); assert.doesNotMatch(f.run('requestText()'), /ნიმუშის ადგილებზე/);
});

test('detailed editing and back: materials-only changes keep the sample; layout changes can be restored', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  f.run('switchFlow("full")'); assert.equal(f.run('S.flow'), 'full');
  f.click('mat', { v: 'neolith:beton' }); f.run('switchFlow("ws")');
  assert.equal(f.run('S.flow'), 'ws'); assert.equal(f.run('S.sk.dims'), 'sample'); assert.equal(f.run('ui.fullBackup'), null);
  assert.equal(f.run('S.stone.main'), 'neolith:beton');
  f.run('switchFlow("full"); S.oven = "tall"; update(false); switchFlow("ws")');
  assert.equal(f.run('S.sk.dims'), 'sample');   // room untouched in detail mode
  assert.equal(f.run('ui.fullBackup && ui.fullBackup.oven'), 'tall');   // re-planned, but the detailed version can be restored
  f.click('restore'); assert.equal(f.run('S.flow'), 'full'); assert.equal(f.run('S.oven'), 'tall');
});

test('reset returns to the sample in the workspace', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  f.click('ws-shape', { v: 'I' }); f.input(f.field('room.w', '520'));
  f.run('S = clone(DEFAULTS); applySample(S); update(true)');
  assert.equal(f.run('S.sk.shape'), 'L'); assert.equal(f.run('S.sk.dims'), 'sample'); assert.deepEqual(f.json('S.room'), { w: 460, d: 420, h: 270 });
});

// ---- the 3D can fail; the project and the editor must not ----
test('3D that cannot start leaves a working 2D plan of the same project, with retry and continue', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  const before = f.json('{ room: S.room, lay: S.lay }');
  f.run(`init3D = async () => { throw Object.assign(new Error('Error creating WebGL context.'), { kind: 'create', statusMessage: 'GPU process unavailable' }); }`);
  await f.run('start3D()');
  assert.equal(f.run('GL.mode'), '2d');
  assert.equal(f.node('#fallback').hidden, false); assert.equal(f.node('#fbMsg').hidden, false);
  assert.ok(f.node('#stage').classList.contains('is-2d'));
  assert.match(f.node('#fbTitle').textContent, /3D ამ ბრაუზერში ვერ ჩაირთო/);
  assert.match(f.node('#fbLog').textContent, /create: Error creating WebGL context\. — GPU process unavailable/);
  assert.match(f.node('#fbPlan').innerHTML, /data-role="ct"/);
  // materials, sizes and saving keep working on the plan
  f.click('mat', { v: 'neolith:beton' }); f.input(f.field('room.w', '500')); await f.clock.flush(); f.run('render2D()');
  assert.equal(f.run('S.stone.main'), 'neolith:beton'); assert.equal(f.run('S.room.w'), 500);
  assert.ok(f.node('#fbPlan').innerHTML.includes(f.run('ASSET_BASE + mat("neolith:beton").thumbnail')));
  assert.equal(JSON.parse(f.storage.get('lithos-kitchen-v1')).stone.main, 'neolith:beton');
  assert.equal(f.run('S.lay.type'), before.lay.type); assert.equal(f.run('S.lay.a'), 500);   // the run follows the new wall
  // "continue in 2D" hides the message and keeps a retry button; a retry that fails again lands back in 2D, once
  f.node('#fbContinue').listeners.click[0]();
  assert.equal(f.node('#fbMsg').hidden, true); assert.equal(f.node('#fbBar').hidden, false);
  await f.node('#fbRetry2').listeners.click[0]();
  assert.equal(f.run('GL.mode'), '2d'); assert.equal(f.node('#fbMsg').hidden, false);
  assert.equal(f.run('LIGHT'), true);   // a retry asks for the light pipeline
  assert.deepEqual(f.json('window.lithosKitchen3D.log().map(e => e.type)').filter(t => t === 'retry'), ['retry']);
});

test('a lost context waits for the browser, then shows the 2D plan; repeated losses stop the automatic restore', async () => {
  const f = fixture(); await f.boot(); await f.clock.flush();
  const project = f.storage.get('lithos-kitchen-v1');
  f.run(`GL.mode = '3d'; threeReady = true; var prevented = 0; onGLLost({ preventDefault() { prevented++; } })`);
  assert.equal(f.run('prevented'), 1);   // tells the browser the page wants the context back
  assert.equal(f.run('GL.mode'), 'lost'); assert.equal(f.node('#glNotice').hidden, false);
  assert.equal(f.storage.get('lithos-kitchen-3d'), 'light');   // the next start asks the GPU for less
  await f.clock.flush();   // nothing came back within the wait
  assert.equal(f.run('GL.mode'), '2d'); assert.match(f.node('#fbTitle').textContent, /თავისით ვერ აღდგა/);
  f.run(`GL.mode = '3d'; onGLLost({ preventDefault() {} }); onGLLost({ preventDefault() {} }); onGLRestored()`);
  assert.equal(f.run('GL.mode'), '2d'); assert.match(f.node('#fbTitle').textContent, /რამდენჯერმე შეჩერდა/);
  const types = f.json('window.lithosKitchen3D.log().map(e => e.type)');
  assert.ok(types.includes('restore-timeout') && types.includes('auto-restore-stopped'));
  assert.equal(f.storage.get('lithos-kitchen-v1'), project);   // the project was not touched
});

test('the page keeps one renderer and never builds the 3D again for ordinary edits', () => {
  assert.equal((moduleSource.match(/new T\.WebGLRenderer\(/g) || []).length, 1);
  assert.match(moduleSource, /if \(renderer\) return;/);
  assert.match(moduleSource, /addEventListener\('webglcontextcreationerror'/);
  assert.match(moduleSource, /addEventListener\('webglcontextlost', onGLLost/);
  assert.match(moduleSource, /addEventListener\('webglcontextrestored', onGLRestored/);
  assert.match(html, /3D-ის ხელახლა ცდა/); assert.match(html, /2D-ში გაგრძელება/);
});
