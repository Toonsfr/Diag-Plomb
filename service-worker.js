const CACHE_NAME = 'diag-plomb-cache-v1'
const PRECACHE = [
  '/',
  '/index.html'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  const req = event.request
  // try cache first, then network
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      // cache GET requests for navigation/static
      try{
        if (req.method === 'GET' && resp && resp.type !== 'opaque'){
          const respClone = resp.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(req, respClone))
        }
      }catch(e){/* ignore caching errors */}
      return resp
    }).catch(()=> caches.match('/index.html'))
  )
})
