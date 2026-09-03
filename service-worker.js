importScripts('./asset-manifest.js?v=v106-safe-pwa-updates-config-925e766c1b907250', './service-worker-core.js');

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

self.addEventListener('message', event => {
  const reply = value => event.ports?.[0]?.postMessage(value);
  if (event.data?.type === 'GET_VERSION') {
    reply({ release: BIG_GAINS_ASSET_MANIFEST.release, deploymentVersion: BIG_GAINS_ASSET_MANIFEST.deploymentVersion });
  } else if (['SKIP_WAITING', 'PRUNE_CACHES'].includes(event.data?.type)) {
    event.waitUntil((async () => {
      // The page supplies explicit approval and its local guard. Never take over
      // another open window, including a legacy client with no safety protocol.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const scoped = clients.filter(client => client.url.startsWith(self.registration.scope));
      if (!event.source?.id || scoped.length !== 1 || scoped[0].id !== event.source.id) {
        reply({ ok: false, reason: 'other-clients' }); return;
      }
      if (event.data.type === 'PRUNE_CACHES') {
        if (event.data.deploymentVersion !== BIG_GAINS_ASSET_MANIFEST.deploymentVersion
            || self.registration.installing || self.registration.waiting) {
          reply({ ok: false, reason: 'not-current' }); return;
        }
        await runtime.prune();
      } else await self.skipWaiting();
      reply({ ok: true });
    })());
  }
});
