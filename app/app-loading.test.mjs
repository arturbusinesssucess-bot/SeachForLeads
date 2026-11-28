import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = (await readFile(new URL('./app-loading.js', import.meta.url), 'utf8'))
  .replace('export const appLoading =', 'const appLoading =');

function createLoadingApp(view = 'home') {
  let now = 0;
  let timerId = 0;
  let reloads = 0;
  const timers = new Map();
  const windowListeners = new Map();
  let activeElement;

  class Element {
    constructor(parent = null) {
      this.parent = parent;
      this.hidden = false;
      this.inert = false;
      this.isConnected = true;
      this.textContent = '';
      this.attributes = new Map();
      this.listeners = new Map();
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    addEventListener(name, handler) { this.listeners.set(name, handler); }
    focus() { activeElement = this; }
    closest() {
      for (let node = this; node; node = node.parent) {
        if (node.hidden || node.inert) return node;
      }
      return null;
    }
    click() { this.listeners.get('click')?.({ target: this }); }
  }
  class ScriptElement extends Element {}

  const overlay = new Element();
  const error = new Element();
  error.hidden = true;
  const errorMessage = new Element(error);
  error.querySelector = (selector) => selector === 'p' ? errorMessage : null;
  const retry = new Element(error);
  const frame = new Element();
  const mobileHeader = new Element();
  const mobileBar = new Element();
  const trigger = new Element(frame);
  activeElement = trigger;
  const shell = [mobileHeader, frame, mobileBar];
  const selectors = new Map([
    ['#app-loading', overlay],
    ['#app-loading-error', error],
    ['#app-loading-retry', retry],
    ['.app-frame', frame],
  ]);
  const body = { dataset: {} };
  const window = {
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, { at: now + Math.max(0, delay), callback });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, handler) { windowListeners.set(name, handler); },
  };
  const document = {
    body,
    get activeElement() { return activeElement; },
    querySelector: (selector) => selectors.get(selector),
    querySelectorAll: () => shell,
  };
  const context = {
    document,
    window,
    location: { hash: `#${view}`, reload() { reloads++; } },
    performance: { now: () => now },
    HTMLScriptElement: ScriptElement,
  };
  runInNewContext(`${source}\nglobalThis.loadingController = appLoading;`, context);

  function advance(milliseconds) {
    const target = now + milliseconds;
    while (true) {
      const pending = [...timers].filter(([, timer]) => timer.at <= target)
        .sort(([aId, a], [bId, b]) => a.at - b.at || aId - bId)[0];
      if (!pending) break;
      const [id, timer] = pending;
      timers.delete(id);
      now = timer.at;
      timer.callback();
    }
    now = target;
  }

  return {
    loading: context.loadingController,
    overlay, error, errorMessage, retry, shell, frame, body, trigger,
    advance,
    activeElement: () => activeElement,
    reloads: () => reloads,
    emit: (name, event = {}) => windowListeners.get(name)?.(event),
    script: () => new ScriptElement(),
  };
}

function finishStartup(app) {
  app.loading.finishStartup();
  app.advance(600);
  assert.equal(app.overlay.hidden, true);
}

test('startup covers the shell and retains the orb for its minimum visible time', () => {
  const app = createLoadingApp('analytics');
  assert.equal(app.overlay.hidden, false);
  assert.equal(app.body.dataset.loading, 'true');
  assert.equal(app.frame.attributes.get('aria-busy'), 'true');
  assert.ok(app.shell.every((element) => element.inert));
  app.loading.finishStartup();
  app.advance(599);
  assert.equal(app.overlay.hidden, false);
  app.advance(1);
  assert.equal(app.overlay.hidden, true);
  assert.equal(app.body.dataset.loading, 'false');
  assert.equal(app.frame.attributes.get('aria-busy'), 'false');
  assert.ok(app.shell.every((element) => !element.inert));
});

test('fast tabs finish before 400 ms without flashing and slow tabs restore focus', () => {
  const app = createLoadingApp('plans');
  finishStartup(app);
  const finishFast = app.loading.begin('plans');
  app.advance(399);
  assert.equal(app.overlay.hidden, true);
  finishFast();
  app.advance(1000);
  assert.equal(app.overlay.hidden, true);

  app.trigger.focus();
  const finishSlow = app.loading.begin('plans');
  app.advance(399);
  assert.equal(app.overlay.hidden, true);
  app.advance(1);
  assert.equal(app.overlay.hidden, false);
  assert.equal(app.activeElement(), app.overlay);
  finishSlow();
  app.advance(599);
  assert.equal(app.overlay.hidden, false);
  app.advance(1);
  assert.equal(app.overlay.hidden, true);
  assert.equal(app.activeElement(), app.trigger);
});

test('an old completion cannot dismiss concurrent work in the active tab', () => {
  const app = createLoadingApp('plans');
  finishStartup(app);
  const finishPlans = app.loading.begin('plans');
  app.advance(400);
  assert.equal(app.overlay.hidden, false);

  app.loading.setView('analytics');
  const finishCharts = app.loading.begin('analytics');
  const finishData = app.loading.begin(['analytics', 'crm']);
  finishPlans();
  finishPlans();
  app.advance(600);
  assert.equal(app.overlay.hidden, false);
  finishCharts();
  app.advance(0);
  assert.equal(app.overlay.hidden, false);
  finishData();
  app.advance(0);
  assert.equal(app.overlay.hidden, true);
});

test('background tabs do not block the active view and switching away releases it', () => {
  const app = createLoadingApp('home');
  finishStartup(app);
  const finish = app.loading.begin('analytics');
  app.advance(1000);
  assert.equal(app.overlay.hidden, true);
  app.loading.setView('analytics');
  app.advance(400);
  assert.equal(app.overlay.hidden, false);
  app.loading.setView('home');
  app.advance(600);
  assert.equal(app.overlay.hidden, true);
  finish();
  app.advance(1000);
  assert.equal(app.overlay.hidden, true);
});

test('startup failures expose recovery and the retry button reloads the app', () => {
  const app = createLoadingApp();
  app.emit('error', { target: app.script() });
  assert.equal(app.overlay.hidden, false);
  assert.equal(app.error.hidden, false);
  assert.match(app.errorMessage.textContent, /Não foi possível abrir o app/);
  app.retry.click();
  assert.equal(app.reloads(), 1);
  app.loading.finishStartup();
  app.advance(600);
  assert.equal(app.error.hidden, true);

  app.emit('unhandledrejection');
  assert.equal(app.overlay.hidden, true);
  app.loading.restartStartup();
  assert.equal(app.overlay.hidden, false);
  app.emit('unhandledrejection');
  assert.equal(app.error.hidden, false);
});

test('a long load offers recovery after 25 seconds and completion clears the warning', () => {
  const app = createLoadingApp('referrals');
  finishStartup(app);
  const finish = app.loading.begin('referrals');
  app.advance(400);
  app.advance(24999);
  assert.equal(app.error.hidden, true);
  app.advance(1);
  assert.equal(app.error.hidden, false);
  assert.match(app.errorMessage.textContent, /demorando/);
  finish();
  app.advance(0);
  assert.equal(app.overlay.hidden, true);
  assert.equal(app.error.hidden, true);
  app.advance(30000);
  assert.equal(app.error.hidden, true);
});

test('a rejected task settled in finally does not leave the overlay or shell locked', async () => {
  const app = createLoadingApp('analytics');
  finishStartup(app);
  const finish = app.loading.begin('analytics');
  app.advance(400);
  const failure = new Error('chart download failed');
  await assert.rejects(async () => {
    try { await Promise.reject(failure); }
    finally { finish(); }
  }, failure);
  app.advance(600);
  assert.equal(app.overlay.hidden, true);
  assert.ok(app.shell.every((element) => !element.inert));
  app.advance(25000);
  assert.equal(app.error.hidden, true);
});
