// Independent, non-browser tests of the shipped functions. No source blobs or network access.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const archive = fs.readFileSync('assets/archive-ui.js', 'utf8');

function openHarness({ blocked = false, sourceError = null, downloadError = false, pdf = true } = {}) {
  const events = [], statuses = [], timers = [];
  const tab = { opener: {}, location: {}, close() { events.push('close'); } };
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  const row = { name: pdf ? 'test.pdf' : 'test.docx', blob: new Blob([pdf ? '%PDF-test' : 'word-test']) };
  const context = {
    window: { open(url, target) { events.push(['open', url, target]); return blocked ? null : tab; } },
    original: async () => { events.push('source'); await ready; if (sourceError) throw Error(sourceError); return row; },
    status: message => statuses.push(message),
    URL: { createObjectURL() { if (downloadError) throw Error('Download URL unavailable'); events.push('url'); return 'blob:test'; }, revokeObjectURL() {} },
    Blob, TextDecoder,
    setTimeout: (fn, delay) => timers.push({ fn, delay }),
    document: { createElement: () => ({ click() { events.push('download'); }, remove() {} }), body: { appendChild() {} } }
  };
  vm.createContext(context);
  const start = archive.indexOf('  async function downloadOriginal(');
  const end = archive.indexOf('  async function editDetails(', start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(archive.slice(start, end), context);
  return { context, events, statuses, tab, release, timers };
}

test('PDF actual handler reserves the tab synchronously and navigates only after source loading', async () => {
  const h = openHarness();
  const pending = h.context.openOriginal('synthetic');
  assert.deepEqual(h.events, [['open', 'about:blank', '_blank'], 'source']);
  assert.equal(h.tab.opener, null);
  assert.equal(h.tab.location.href, undefined);
  h.release(); await pending;
  assert.equal(h.tab.location.href, 'blob:test');
  assert.equal(h.statuses.at(-1), 'PDF opened in a new tab.');
  assert.equal(h.timers[0].delay, 300000);
});

test('PDF actual handler reports blocked popup without claiming success or reading a source', async () => {
  const h = openHarness({ blocked: true });
  await h.context.openOriginal('synthetic');
  assert.equal(h.events.length, 1);
  assert.match(h.statuses.at(-1), /blocked.*Download original/);
});

test('PDF actual handler closes reserved tab and preserves a source read error', async () => {
  const h = openHarness({ sourceError: 'Original unavailable' });
  const pending = h.context.openOriginal('synthetic');
  h.release(); await pending;
  assert.equal(h.events.at(-1), 'close');
  assert.equal(h.tab.location.href, undefined);
  assert.equal(h.statuses.at(-1), 'Original unavailable');
});

test('non-PDF actual handler closes blank tab and downloads unchanged original', async () => {
  const h = openHarness({ pdf: false });
  const pending = h.context.openOriginal('synthetic');
  h.release(); await pending;
  assert.ok(h.events.indexOf('close') < h.events.indexOf('download'));
  assert.match(h.statuses.at(-1), /Original downloaded/);
});

test('non-PDF download failure must not be overwritten with a success status', async () => {
  const h = openHarness({ pdf: false, downloadError: true });
  const pending = h.context.openOriginal('synthetic');
  h.release(); await pending;
  assert.equal(h.statuses.at(-1), 'Download URL unavailable');
});

function drawerHarness() {
  const nodes = new Map(), handlers = {};
  const doc = {
    readyState: 'complete', activeElement: null,
    documentElement: { style: { setProperty() {} } },
    getElementById: id => nodes.get(id),
    querySelector: selector => selector === 'body > header' ? { getBoundingClientRect: () => ({ height: 130 }) } : nodes.get('settingsClose'),
    addEventListener: (event, handler) => { handlers[event] = handler; }
  };
  function node(id, extra = {}) {
    const classes = new Set();
    const n = { id, value: '', inert: true, attrs: { 'aria-hidden': 'true' }, children: [], disabled: false,
      classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
      setAttribute(k, v) { this.attrs[k] = v; }, focus() { doc.activeElement = this; },
      getClientRects: () => [{}], querySelector() { return this.children[0]; }, querySelectorAll() { return this.children; },
      contains(n) { return this === n || this.children.includes(n); }, ...extra };
    nodes.set(id, n); return n;
  }
  const opener = node('opener'), settings = node('settingsDrawer'), notes = node('shiftNotesDrawer');
  settings.children = [node('settingsClose'), node('settingsFirstInput'), node('settingsLast')];
  notes.children = [node('notesClose'), node('notesText'), node('notesLast')];
  for (const id of ['settingsOverlay', 'settingsDefaultSite', 'settingsPeriod', 'settingsPurchasingEmail']) node(id);
  const values = new Map();
  const c = { document: doc, window: { addEventListener() {} }, localStorage: { getItem: k => values.get(k) || null }, currentSite: 'all', PURCHASING_EMAIL_KEY: 'purchasing', renderShiftNotes() {} };
  vm.createContext(c);
  vm.runInContext(html.slice(html.indexOf('const HUB_SETTINGS_KEY='), html.indexOf('function saveHubSettings()')), c);
  vm.runInContext(html.slice(html.indexOf('let notesReturnFocus='), html.indexOf('function saveShiftNote()')), c);
  vm.runInContext(fs.readFileSync('assets/responsive-ui.js', 'utf8'), c);
  opener.focus();
  function key(key, shiftKey = false) { let prevented = false; handlers.keydown({ key, shiftKey, preventDefault() { prevented = true; } }); return prevented; }
  return { c, doc, nodes, opener, settings, notes, key, values };
}

for (const [name, open, close] of [['settings', 'openSettings', 'closeSettings'], ['notes', 'openShiftNotes', 'closeShiftNotes']]) {
  test(`${name} actual drawer handlers remove inert, focus close button, and restore opener on close`, () => {
    const h = drawerHarness(), drawer = h[name];
    h.c[open]();
    assert.equal(drawer.inert, false);
    assert.equal(drawer.attrs['aria-hidden'], 'false');
    assert.equal(drawer.classList.contains('open'), true);
    assert.equal(h.doc.activeElement, drawer.children[0]);
    h.c[close]();
    assert.equal(drawer.inert, true);
    assert.equal(drawer.attrs['aria-hidden'], 'true');
    assert.equal(drawer.classList.contains('open'), false);
    assert.equal(h.doc.activeElement, h.opener);
  });
  test(`${name} actual keyboard handler wraps Tab and closes on Escape`, () => {
    const h = drawerHarness(), drawer = h[name];
    h.c[open]();
    assert.equal(h.key('Tab', true), true);
    assert.equal(h.doc.activeElement, drawer.children.at(-1));
    assert.equal(h.key('Tab'), true);
    assert.equal(h.doc.activeElement, drawer.children[0]);
    h.opener.focus();
    assert.equal(h.key('Tab'), true);
    assert.equal(h.doc.activeElement, drawer.children[0]);
    assert.equal(h.key('Escape'), true);
    assert.equal(drawer.inert, true);
    assert.equal(h.doc.activeElement, h.opener);
  });
}
