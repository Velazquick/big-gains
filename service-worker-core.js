((scope) => {
  'use strict';

  function createRuntime({ manifest, cacheStorage, fetcher, baseUrl, clientApi }) {
    if (!manifest) throw new Error('Big Gains service worker requires an asset manifest.');

    const absoluteUrl = path => new URL(path, baseUrl).href;
    const coreUrls = new Set(manifest.coreAssets.map(absoluteUrl));
    const revisionedUrls = new Set([...manifest.styles, ...manifest.scripts].map(absoluteUrl));
    const documentUrl = absoluteUrl('./index.html');
    const ownsCache = name => (
      name.startsWith(manifest.cachePrefix)
      || name.startsWith(manifest.runtimeCachePrefix)
      || manifest.legacyCacheNames.includes(name)
    );

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

    async function activate() {
      const names = await cacheStorage.keys();
      await Promise.all(names
        .filter(name => ownsCache(name) && name !== manifest.cacheName && name !== manifest.runtimeCacheName)
        .map(name => cacheStorage.delete(name)));
      await clientApi.claim();
    }

    async function findCurrent(requestOrUrl) {
      const shell = await cacheStorage.open(manifest.cacheName);
      const shellMatch = await shell.match(requestOrUrl);
      if (shellMatch) return shellMatch;
      const runtime = await cacheStorage.open(manifest.runtimeCacheName);
      return runtime.match(requestOrUrl);
    }

    async function navigationResponse(request) {
      try {
        return await fetchRequired(new Request(request, { cache: 'no-store' }));
      } catch (error) {
        const cached = await findCurrent(documentUrl);
        if (cached) return cached;
        throw error;
      }
    }

    async function assetResponse(request) {
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
        throw error;
      }
    }

    function handle(request) {
      if (request.method !== 'GET') return null;
      const requestUrl = new URL(request.url);
      if (request.mode === 'navigate') return navigationResponse(request);
      if (requestUrl.origin !== new URL(baseUrl).origin) return null;
      return assetResponse(request);
    }

    return Object.freeze({ activate, handle, ownsCache, precache });
  }

  Object.defineProperty(scope, 'BigGainsServiceWorkerCore', {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ createRuntime }),
    writable: false
  });
})(typeof self === 'object' ? self : globalThis);
