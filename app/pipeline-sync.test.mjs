import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('a failed legacy migration still receives and caches the server pipeline', async () => {
  const entries = new Map();
  const watchers = [];
  globalThis.window = new EventTarget();
  window.CustomEvent = CustomEvent;
  window.localStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  globalThis.pipelineSyncFixture = {
    updateWorkspace: async () => { throw Error('legacy migration rejected'); },
    watchWorkspace(uid, receive) {
      const watcher = { uid, receive, stopped: false };
      watchers.push(watcher);
      return () => { watcher.stopped = true; };
    },
  };
  try {
    const source = (await readFile(new URL('./pipeline.js', import.meta.url), 'utf8'))
      .replace(/import\('\.\/workspace-sync\.js[^']*'\)/, 'Promise.resolve(globalThis.pipelineSyncFixture)');
    const pipeline = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const old = pipeline.getDefaultPipeline();
    old[0].label = 'Etapa local antiga';
    entries.set('sfl:pipeline:v1:account-a', JSON.stringify(old));
    pipeline.setPipelineUser('account-a');
    await new Promise(setImmediate);
    assert.equal(watchers.length, 1);
    const updated = pipeline.getDefaultPipeline();
    updated[0].label = 'Atualizado no computador';
    watchers[0].receive({ pipeline: updated });
    assert.equal(pipeline.getPipeline()[0].label, 'Atualizado no computador');
    assert.equal(JSON.parse(entries.get('sfl:pipeline:v1:account-a'))[0].label, 'Atualizado no computador');
    pipeline.setPipelineUser('account-b');
    await new Promise(setImmediate);
    assert.equal(watchers[0].stopped, true);
    watchers[0].receive({ pipeline: old });
    assert.equal(pipeline.getPipeline()[0].label, pipeline.getDefaultPipeline()[0].label);
    pipeline.setPipelineUser(null);
  } finally {
    delete globalThis.window;
    delete globalThis.pipelineSyncFixture;
  }
});
