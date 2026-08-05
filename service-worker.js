const CACHE='big-gains-v33-state-persistence-api';
const CORE_ASSETS=[
  './',
  './index.html',
  './styles.css?v=18',
  './v2-shell.css?v=18',
  './profiles.css?v=18',
  './training-pet.css?v=20',
  './workout-controls.css?v=21',
  './design-v21.css?v=21',
  './moss-cards-v24.css?v=24',
  './alexa-contrast-v22.css?v=23',
  './session-selector-v26.css?v=28',
  './state-persistence.js?v=1',
  './profiles.js?v=19',
  './workout-controls.js?v=22',
  './notes.js?v=13',
  './progress.js?v=13',
  './app.js?v=23',
  './full-body.js?v=17',
  './v2-shell.js?v=18',
  './alexa-shell.js?v=18',
  './training-pet.js?v=20',
  './design-v21.js?v=21',
  './session-selector-v26.js?v=28',
  './sync-gateway.js?v=25',
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
