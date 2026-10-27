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
    constructor(tagName = 'DIV') { this.tagName = tagName; this.attributes = new Map(); this.dataset = {}; this.children = []; this.listeners = {}; this.style = {}; this.value = ''; this.checked = false; this.validity = { badInput: false }; this.hidden = false; this.removed = false; this.classList = { contains: () => false }; nodes.push(this); }
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
    setTimeout: clock.schedule, clearTimeout: clock.cancel,
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
  f.run('go(2); switchFlow("full");'); assert.equal(f.run('step'), 0); assert.equal(f.run('S.flow'), 'quick');
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
  width.value = '70'; f.input(width); assert.equal(f.run('S.mods.A[0].w'), 70);
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
  }
});

test('an invalid shared project falls back to the valid saved project', async () => {
  const stored = JSON.stringify({ room: { w: 500 } });
  const hash = '#p.j' + Buffer.from(JSON.stringify({ room: { w: -10 } })).toString('base64url');
  const f = fixture({ stored, hash }); await f.boot(); await f.clock.flush();
  assert.equal(f.run('S.room.w'), 500); assert.equal(f.run('rejectedStoredProject'), false); assert.match(f.run('loadNotice'), /ბმულიდან/);
});

for (const [flow, step] of [['quick', 2], ['full', 6]]) test(`${flow}: WhatsApp and copied URLs contain the same updated project`, async () => {
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
