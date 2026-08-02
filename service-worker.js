const CACHE='big-gains-v16';
const CORE_ASSETS=[
  './',
  './index.html',
  './styles.css?v=8',
  './v2-shell.css?v=15',
  './app.js?v=12',
  './progress.js?v=12',
  './notes.js?v=12',
  './active-ui.js?v=14',
  './v2-shell.js?v=15',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE_ASSETS.map(url=>new Request(url,{cache:'reload'}))))
      .catch(error=>console.error('Big Gains install cache failed',error))
  );
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const requestUrl=new URL(event.request.url);
  const isNavigation=event.request.mode==='navigate';
  const isSameOrigin=requestUrl.origin===self.location.origin;

  if(isNavigation){
    event.respondWith(
      fetch(event.request,{cache:'no-store'})
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
          return response;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  if(!isSameOrigin) return;
  event.respondWith(
    fetch(event.request,{cache:'reload'})
      .then(response=>{
        if(!response||!response.ok) throw new Error(`Asset request failed: ${response&&response.status}`);
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      })
      .catch(()=>caches.match(event.request))
  );
});
