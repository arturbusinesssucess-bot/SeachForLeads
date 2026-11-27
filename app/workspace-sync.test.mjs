import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('resumes server subscriptions and ignores stale callbacks after reconnect and logout', async () => {
  const subscriptions = [];
  const received = [];
  const errors = [];
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  document.hidden = false;
  globalThis.syncSDK = {
    doc: (_db, collection, uid) => ({ collection, uid }),
    getFirestore: () => ({}),
    runTransaction: () => {},
    onSnapshot(reference, _options, receive, fail) {
      const subscription = { reference, receive, fail, stopped: false };
      subscriptions.push(subscription);
      return () => { subscription.stopped = true; };
    },
  };
  try {
    const source = (await readFile(new URL('./workspace-sync.js', import.meta.url), 'utf8'))
      .replace(/^import[^\n]+/, 'const { doc, getFirestore, onSnapshot, runTransaction } = globalThis.syncSDK;');
    const { watchWorkspace } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const stop = watchWorkspace('account-a', (value) => received.push(value), (error) => errors.push(error));
    const snapshot = (data, metadata = {}) => ({ data: () => data, metadata });
    const first = subscriptions[0];
    assert.equal(first.reference.uid, 'account-a');
    first.receive(snapshot({ leads: ['cached'] }, { fromCache: true }));
    first.receive(snapshot({ leads: ['pending'] }, { hasPendingWrites: true }));
    assert.deepEqual(received, []);
    first.receive(snapshot({ leads: ['server'] }));
    assert.deepEqual(received, [{ leads: ['server'] }]);
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(subscriptions.length, 1);
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(first.stopped, true);
    first.receive(snapshot({ leads: ['obsolete'] }));
    first.fail(new Error('obsolete'));
    subscriptions.at(-1).receive(snapshot({ leads: ['updated on desktop'] }));
    assert.equal(received.length, 2);
    assert.equal(errors.length, 0);
    subscriptions.at(-1).fail(new Error('disconnected'));
    assert.equal(errors.length, 1);
    window.dispatchEvent(new Event('online'));
    assert.equal(subscriptions.length, 3);
    const restored = new Event('pageshow');
    restored.persisted = true;
    window.dispatchEvent(restored);
    assert.equal(subscriptions.length, 4);
    stop();
    assert.equal(subscriptions.at(-1).stopped, true);
    subscriptions.at(-1).receive(snapshot({ leads: ['other session'] }));
    window.dispatchEvent(new Event('online'));
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(subscriptions.length, 4);
    assert.equal(received.length, 2);
  } finally {
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.syncSDK;
  }
});
