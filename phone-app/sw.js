// MPG Garage offline support.
// Keeps a copy of the app's own files so it opens with no signal. Each launch
// serves the saved copy instantly and quietly fetches any newer version for
// next time. Exchange-rate requests always go to the network (the app copes
// when offline). build.sh stamps VERSION so a new upload replaces old files.
const VERSION = '20261112115738';
const CACHE = 'mpg-garage-' + VERSION;
const FILES = [
  './', 'index.html', 'styles.css', 'cars.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('mpg-garage-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // rates etc: network only
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(cached => {
        const fresh = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
