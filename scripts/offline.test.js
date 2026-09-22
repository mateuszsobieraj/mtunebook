// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { offlineBuild } from './offline-build.mjs';

const template = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const scope = 'https://example.com/mtunebook/';
const prefix = 'mtunebook:/mtunebook/:';

function worker() {
  const listeners = {};
  const entries = new Map();
  const keyOf = (key) => typeof key === 'string' ? key : key.url;
  const cache = {
    addAll: vi.fn(async (urls) => urls.forEach((url) => entries.set(url, new Response(url)))),
    match: vi.fn(async (key) => entries.get(keyOf(key))),
    put: vi.fn(async (key, response) => entries.set(keyOf(key), response))
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => [prefix + 'old', prefix + 'test', 'another-app', 'mtunebook:/other/:old']),
    delete: vi.fn(async () => true)
  };
  const network = vi.fn(async () => new Response('soundfont'));
  const claim = vi.fn(async () => {});
  const source = template.replace('"__BUILD_VERSION__"', '"test"').replace('["__PRECACHE_FILES__"]',
    JSON.stringify(['./index.html', './assets/app.js', './assets/detail.js', './assets/app.css', './tunes/test.abc']));
  vm.runInNewContext(source, { URL, caches, fetch: network,
    self: { registration: { scope }, clients: { claim }, addEventListener: (type, listener) => { listeners[type] = listener; } }
  });
  const lifecycle = async (type) => {
    let pending;
    listeners[type]({ waitUntil: (promise) => { pending = promise; } });
    await pending;
  };
  const request = (url, mode = 'cors') => {
    let response;
    listeners.fetch({ request: { url, method: 'GET', mode }, respondWith: (promise) => { response = promise; } });
    return response;
  };
  return { cache, caches, network, claim, lifecycle, request };
}

it('precaches notation and lazy assets before the first offline visit', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  sw.network.mockRejectedValue(new Error('offline'));
  for (const file of ['assets/app.js', 'assets/detail.js', 'assets/app.css', 'tunes/test.abc']) {
    expect(await (await sw.request(scope + file)).text()).toBe(scope + file);
  }
  expect(await (await sw.request(scope + '?source=bookmark', 'navigate')).text()).toBe(scope + 'index.html');
  expect(sw.network).not.toHaveBeenCalled();
});

it('cleans only previous versions belonging to the same app scope', async () => {
  const sw = worker();
  await sw.lifecycle('activate');
  expect(sw.caches.delete).toHaveBeenCalledOnce();
  expect(sw.caches.delete).toHaveBeenCalledWith(prefix + 'old');
  expect(sw.claim).toHaveBeenCalledOnce();
});

it('ignores unrelated apps and caches downloaded soundfonts for offline playback', async () => {
  const sw = worker();
  expect(sw.request('https://example.com/other-app/')).toBeUndefined();
  expect(sw.request('https://unrelated.example/test')).toBeUndefined();
  const sample = 'https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3/C4.mp3';
  expect(await (await sw.request(sample)).text()).toBe('soundfont');
  sw.network.mockRejectedValue(new Error('offline'));
  expect(await (await sw.request(sample)).clone().text()).toBe('soundfont');
  expect(sw.network).toHaveBeenCalledOnce();
});

it('serves network responses even when runtime cache writes fail', async () => {
  const sw = worker();
  sw.cache.put.mockRejectedValue(new Error('quota'));
  expect(await (await sw.request(scope + 'extra.abc')).text()).toBe('soundfont');
});

it('generates a complete build precache and changes its version when a tune changes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mtunebook-offline-test-'));
  try {
    const out = path.join(root, 'dist');
    fs.mkdirSync(path.join(out, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(out, 'tunes'));
    const files = ['index.html', 'assets/app.js', 'assets/detail.js', 'assets/app.css', 'tunes/a tune.abc'];
    files.forEach((file) => fs.writeFileSync(path.join(out, file), file));
    const build = () => {
      fs.writeFileSync(path.join(out, 'sw.js'), template);
      const plugin = offlineBuild();
      plugin.configResolved({ root, build: { outDir: 'dist' } });
      plugin.closeBundle();
      return fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
    };
    const first = build();
    expect(first).not.toContain('__BUILD_VERSION__');
    expect(first).not.toContain('__PRECACHE_FILES__');
    files.forEach((file) => expect(first).toContain('./' + file.replace(' ', '%20')));
    expect(build()).toBe(first);
    fs.writeFileSync(path.join(out, 'tunes/a tune.abc'), 'changed notation');
    expect(build()).not.toBe(first);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
