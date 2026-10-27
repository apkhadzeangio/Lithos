// Pure guards shared by live edits, restored projects and regression tests.
const rule = (min, max, label, nullable = false) => Object.freeze({ min, max, label, nullable });
export const NUMBER_RULES = Object.freeze({
  'room.w': rule(200, 1200, 'ოთახის სიგანე'),
  'room.d': rule(200, 1200, 'ოთახის სიღრმე'),
  'room.h': rule(220, 400, 'ჭერის სიმაღლე'),
  'lay.a': rule(60, 1200, 'A მონაკვეთი'),
  'lay.b': rule(90, 1200, 'B მონაკვეთი'),
  'lay.c': rule(90, 1200, 'C მონაკვეთი'),
  'lay.off': rule(0, 1000, 'კედლიდან დაშორება'),
  'base.depth': rule(50, 80, 'ზედაპირის სიღრმე'),
  'base.top': rule(80, 105, 'ზედაპირის სიმაღლე'),
  'base.userH': rule(140, 210, 'მომხმარებლის სიმაღლე', true),
  'isl.len': rule(100, 400, 'კუნძულის სიგრძე'),
  'isl.dep': rule(60, 140, 'კუნძულის სიღრმე'),
  'isl.aisle': rule(60, 250, 'კუნძულამდე გასასვლელი'),
  'isl.shift': rule(-200, 200, 'კუნძულის წანაცვლება'),
  'isl.over': rule(15, 40, 'ზედაპირის გადმოშვერა'),
  'sink.pos': rule(0, 2000, 'ნიჟარის პოზიცია', true),
  'hob.pos': rule(0, 2000, 'ქურის პოზიცია', true),
  'cab.plinth': rule(8, 15, 'კარადის ქვედა ნაწილი'),
  'up.h': rule(40, 110, 'ზედა კარადის სიმაღლე'),
  'up.gap': rule(45, 80, 'ზედა კარადამდე დაშორება'),
  'quote.rate': rule(0, 100000, 'მასალისა და დამუშავების ტარიფი', true),
  'quote.waste': rule(0, 40, 'ნარჩენის რეზერვი'),
  'quote.install': rule(0, 100000, 'მონტაჟის თანხა', true),
  'quote.extra': rule(0, 100000, 'დამატებითი სამუშაოს თანხა', true)
});

export function numericResult(raw, limits) {
  if (raw === null && limits.nullable) return { valid: true, value: null, message: '' };
  const numericString = typeof raw === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim());
  if (typeof raw !== 'number' && !numericString) return { valid: false, message: 'მიუთითე რიცხვი.' };
  const value = Number(raw);
  if (!Number.isFinite(value)) return { valid: false, message: 'მიუთითე სასრული რიცხვი.' };
  if (value < limits.min || value > limits.max) return { valid: false, message: `მიუთითე რიცხვი ${limits.min}–${limits.max} ფარგლებში.` };
  return { valid: true, value, message: '' };
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const at = (src, path) => path.split('.').reduce((o, key) => object(o) ? o[key] : undefined, src);

export function projectNumericErrors(src) {
  if (!object(src)) return [{ path: '', message: 'პროექტი უნდა შეიცავდეს მონაცემების ობიექტს.' }];
  const errors = [];
  const check = (path, value, limits) => {
    if (value === undefined) return;
    const result = numericResult(value, limits);
    if (!result.valid) errors.push({ path, message: `${limits.label}: ${result.message}` });
  };
  for (const group of ['room', 'lay', 'base', 'isl', 'sink', 'hob', 'cab', 'up', 'quote', 'sk']) {
    if (src[group] !== undefined && !object(src[group])) errors.push({ path: group, message: 'პროექტის მონაცემების სტრუქტურა არასწორია.' });
  }
  for (const [path, limits] of Object.entries(NUMBER_RULES)) check(path, at(src, path), limits);
  if (src.feats !== undefined && !Array.isArray(src.feats)) errors.push({ path: 'feats', message: 'ოთახის ელემენტები სიად უნდა იყოს მოცემული.' });
  for (const [i, f] of (Array.isArray(src.feats) ? src.feats : []).entries()) {
    if (!object(f)) { errors.push({ path: `feats.${i}`, message: 'ოთახის ელემენტის მონაცემები არასწორია.' }); continue; }
    const checkFeature = (key, min, max, label) => check(`feats.${i}.${key}`, f[key], rule(min, max, label));
    checkFeature('x', 0, 1200, 'ობიექტის მდებარეობა');
    if (!['water', 'gas', 'vent'].includes(f.t)) checkFeature('w', 10, 600, 'ობიექტის სიგანე');
    if (f.t === 'window') { checkFeature('h', 20, 300, 'ფანჯრის სიმაღლე'); checkFeature('sill', 0, 250, 'რაფის სიმაღლე'); }
    if (f.t === 'door') checkFeature('h', 150, 300, 'კარის სიმაღლე');
    if (f.t === 'column') checkFeature('d', 5, 200, 'კოლონის სიღრმე');
    if (f.t === 'beam') { checkFeature('d', 5, 300, 'კოჭის სიღრმე'); checkFeature('h', 5, 120, 'კოჭის სიმაღლე'); }
    if (f.t === 'radiator') { checkFeature('h', 20, 120, 'რადიატორის სიმაღლე'); checkFeature('d', 5, 25, 'რადიატორის სისქე'); }
  }
  // Preserve legacy hand-edited filler widths accepted by sanitize (>0 and <400).
  // A live width editor still applies its existing 3–300 limits.
  if (src.mods !== undefined && !object(src.mods)) errors.push({ path: 'mods', message: 'კარადების მოდულების მონაცემები არასწორია.' });
  for (const run of ['A', 'B', 'C', 'I']) {
    const list = src.mods?.[run];
    if (list == null) continue;
    if (!Array.isArray(list)) { errors.push({ path: `mods.${run}`, message: 'კარადების მოდულები სიად უნდა იყოს მოცემული.' }); continue; }
    for (const [i, m] of list.entries()) {
      const result = numericResult(m?.w, rule(0, 400, 'მოდულის სიგანე'));
      if (!result.valid || result.value <= 0 || result.value >= 400) errors.push({ path: `mods.${run}.${i}.w`, message: 'მოდულის სიგანე უნდა იყოს 0-ზე მეტი და 400-ზე ნაკლები.' });
    }
  }
  // Legacy single-window projects use win instead of feats.
  if (object(src.win) && src.win.on) {
    const legacy = projectNumericErrors({ feats: [{ ...src.win, t: 'window' }] });
    errors.push(...legacy.map(e => ({ ...e, path: e.path.replace('feats.0', 'win') })));
  }
  return errors;
}

export function createShareController({ encode, baseUrl, onChange = () => {}, delay = 500, schedule = setTimeout, cancel = clearTimeout }) {
  let revision = 0, timer = null;
  let current = Object.freeze({ revision, url: '', text: '', pending: false, error: null });
  const publish = state => { current = Object.freeze(state); onChange(current); };
  return {
    current: () => current,
    queue(project, text) {
      const id = ++revision;
      if (timer !== null) cancel(timer);
      const snapshot = JSON.parse(JSON.stringify(project)), message = String(text);
      publish({ revision: id, url: '', text: message, pending: true, error: null });
      timer = schedule(async () => {
        timer = null;
        try {
          const code = await encode(snapshot);
          if (id !== revision) return;
          publish({ revision: id, url: baseUrl + '#p.' + code, text: message, pending: false, error: null });
        } catch {
          if (id !== revision) return;
          publish({ revision: id, url: '', text: message, pending: false, error: 'encode' });
        }
      }, delay);
    }
  };
}
