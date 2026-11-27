import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('refreshes app scripts across devices and retains offline and immutable asset caches', async () => {
  const handlers = {};
  const stored = new Map();
  let online = true;
  let requests = 0;
  const source = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
  const cache = {
    match: async (request) => stored.get(request.url)?.clone(),
    put: async (request, response) => stored.set(request.url, response.clone()),
  };
  runInNewContext(source, {
    URL, Response,
    self: { location: { origin: 'https://example.test' }, addEventListener: (name, handler) => { handlers[name] = handler; } },
    caches: { open: async () => cache },
    fetch: async () => { requests++; if (!online) throw Error('offline'); return new Response('new release'); },
  });
  const request = { url: 'https://example.test/app/app.js', method: 'GET', destination: 'script' };
  stored.set(request.url, new Response('old release'));
  const load = (req) => new Promise((resolve) => handlers.fetch({ request: req, respondWith: resolve }));
  assert.equal(await (await load(request)).text(), 'new release');
  online = false;
  assert.equal(await (await load(request)).text(), 'new release');
  assert.equal(requests, 2);
  const firebase = { ...request, url: 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js' };
  stored.set(firebase.url, new Response('immutable SDK'));
  assert.equal(await (await load(firebase)).text(), 'immutable SDK');
  assert.equal(requests, 2);
  let intercepted = false;
  handlers.fetch({ request: { ...request, destination: '', url: 'https://example.test/api/search-trial' }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
});
