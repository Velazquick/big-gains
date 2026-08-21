importScripts('./asset-manifest.js?v=v90-program-setup-ux-v2-plan-bridge-config-ab51ee79cd36825d', './service-worker-core.js');

const runtime = BigGainsServiceWorkerCore.createRuntime({
  manifest: BIG_GAINS_ASSET_MANIFEST,
  cacheStorage: caches,
  fetcher: request => fetch(request),
  baseUrl: self.location.href,
  clientApi: self.clients
});

self.addEventListener('install', event => {
  event.waitUntil(runtime.precache());
});

self.addEventListener('activate', event => {
  event.waitUntil(runtime.activate());
});

self.addEventListener('fetch', event => {
  const response = runtime.handle(event.request);
  if (response) event.respondWith(response);
});
