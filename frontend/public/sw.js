const CACHE_VERSION = 'nhan-tin-shell-v1';
const APP_SHELL = [
    '/',
    '/manifest.webmanifest',
    '/favicon.svg?v=2',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/maskable-512.png',
    '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_VERSION)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (
        url.pathname.startsWith('/api/')
        || url.pathname.startsWith('/socket.io/')
        || url.pathname.startsWith('/uploads/')
    ) {
        return;
    }

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        void caches.open(CACHE_VERSION)
                            .then(cache => cache.put('/', copy));
                    }
                    return response;
                })
                .catch(async () => (
                    await caches.match(request)
                    || await caches.match('/')
                ))
        );
        return;
    }

    if (['style', 'script', 'image', 'font', 'manifest'].includes(request.destination)) {
        event.respondWith(
            caches.match(request).then(cached => (
                cached
                || fetch(request).then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        void caches.open(CACHE_VERSION)
                            .then(cache => cache.put(request, copy));
                    }
                    return response;
                })
            ))
        );
    }
});
