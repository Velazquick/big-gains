((scope) => {
  'use strict';

  function createRuntime({ manifest, cacheStorage, fetcher, baseUrl, clientApi }) {
    if (!manifest) throw new Error('Big Gains service worker requires an asset manifest.');

    const absoluteUrl = path => new URL(path, baseUrl).href;
    const coreUrls = new Set(manifest.coreAssets.map(absoluteUrl));
    const revisionedUrls = new Set([
      ...manifest.styles,
      ...manifest.scripts,
      ...(manifest.authSetupStyles || []),
      ...(manifest.authSetupScripts || [])
    ].map(absoluteUrl));
    const documentUrl = absoluteUrl('./index.html');
    const authSetupDocumentUrl = absoluteUrl('./auth-setup.html');
    const ownsCache = name => (
      name.startsWith(manifest.cachePrefix)
      || name.startsWith(manifest.runtimeCachePrefix)
      || manifest.legacyCacheNames.includes(name)
    );

    function reportUnavailable(request, clientId) {
      try {
        if(!clientId)return;
        const requested=new URL(request.url);const module=(manifest.coreAssets||[]).find(p=>new URL(p,baseUrl).pathname===requested.pathname);
        const moduleId=module?module.split('/').pop().split('?')[0]:'unknown';
        // No request URL, status body or exception leaves the worker.
        void Promise.resolve(clientApi.get?.(clientId)).then(client=>{
          client?.postMessage?.({type:'BG_RESOURCE_UNAVAILABLE',module_id:moduleId});
        }).catch(()=>{});
      }catch{}
    }
    async function fetchRequired(request) {
      const response = await fetcher(request);
      if (!response || !response.ok) {
        throw new Error(`Required asset request failed: ${request.url} (${response ? response.status : 'no response'})`);
      }
      return response;
    }

    async function precache() {
      const cache = await cacheStorage.open(manifest.cacheName);
      await Promise.all(manifest.coreAssets.map(async path => {
        const request = new Request(absoluteUrl(path), { cache: 'reload' });
        const response = await fetchRequired(request);
        await cache.put(request, response);
      }));
    }

    async function prune() {
      const names = await cacheStorage.keys();
      // CacheStorage order is creation order. Never delete a newer install that
      // starts while cleanup is awaiting I/O; unknown ordering fails closed.
      const currentIndex = names.indexOf(manifest.cacheName);
      const older = currentIndex < 0 ? [] : names.slice(0, currentIndex);
      await Promise.all(older
        .filter(name => ownsCache(name) && name !== manifest.cacheName && name !== manifest.runtimeCacheName)
        .map(name => cacheStorage.delete(name)));
    }

    async function activate() {
      // A guarded takeover may still have a live page on prior assets. Retain
      // those caches until a client-free activation; never break its offline use.
      const live = clientApi.matchAll
        ? await clientApi.matchAll({ type: 'window', includeUncontrolled: true }) : [];
      const hasLiveApp = live.some(client => client.url.startsWith(absoluteUrl('./')));
      if (!hasLiveApp) await prune();
      await clientApi.claim();
    }

    async function findCurrent(requestOrUrl) {
      const shell = await cacheStorage.open(manifest.cacheName);
      const shellMatch = await shell.match(requestOrUrl);
      if (shellMatch) return shellMatch;
      const runtime = await cacheStorage.open(manifest.runtimeCacheName);
      return runtime.match(requestOrUrl);
    }

    async function navigationResponse(request, clientId) {
      try {
        return await fetchRequired(new Request(request, { cache: 'no-store' }));
      } catch (error) {
        const requested = new URL(request.url);
        const fallbackUrl = requested.pathname.endsWith('/auth-setup.html') ? authSetupDocumentUrl : documentUrl;
        const cached = await findCurrent(fallbackUrl);
        if (cached) return cached;
        reportUnavailable(request, clientId);
        throw error;
      }
    }

    async function assetResponse(request, clientId) {
      try {
        const response = await fetchRequired(new Request(request, { cache: 'reload' }));
        const requestUrl = new URL(request.url).href;
        if (revisionedUrls.has(requestUrl)) {
          const cache = await cacheStorage.open(manifest.cacheName);
          await cache.put(request, response.clone());
        } else if (!coreUrls.has(requestUrl)) {
          const cache = await cacheStorage.open(manifest.runtimeCacheName);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await findCurrent(request);
        if (cached) return cached;
        reportUnavailable(request, clientId);
        throw error;
      }
    }

    function handle(request, clientId) {
      if (request.method !== 'GET') return null;
      const requestUrl = new URL(request.url);
      if (request.mode === 'navigate') return navigationResponse(request, clientId);
      if (requestUrl.origin !== new URL(baseUrl).origin) return null;
      return assetResponse(request, clientId);
    }

    return Object.freeze({ activate, handle, ownsCache, precache, prune });
  }

  Object.defineProperty(scope, 'BigGainsServiceWorkerCore', {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ createRuntime }),
    writable: false
  });
})(typeof self === 'object' ? self : globalThis);
