/* BTIvectorPlans Service Worker v0.8.3 */
const CACHE_NAME = 'btivector-v0.8.3';

const STATIC_ASSETS = [
    './index.html',
    './app.css',
    './constants.js',
    './state.js',
    './g.js',
    './toast.js',
    './svg-primitives.js',
    './elements-on-line.js',
    './canvas-manager.js',
    './hierarchy.js',
    './shape-editor.js',
    './shape-transfer.js',
    './shape-transform.js',
    './coord-modal.js',
    './lines-panel.js',
    './quick-shape.js',
    './constructs.js',
    './main.js',
    './manifest.json',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

/* Network-first для CDN, cache-first для локальних ресурсів */
self.addEventListener('fetch', (e) => {
    const url = e.request.url;

    // CDN ресурси (tailwind, fa) — network-first, fallback cache
    if (url.includes('cdn.tailwindcss.com') || url.includes('cdnjs.cloudflare.com')) {
        e.respondWith(
            fetch(e.request)
                .then((r) => {
                    const clone = r.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
                    return r;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Локальні ресурси — cache-first
    e.respondWith(
        caches.match(e.request).then((cached) => {
            if (cached) return cached;
            return fetch(e.request).then((r) => {
                if (r && r.status === 200) {
                    const clone = r.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
                }
                return r;
            });
        })
    );
});
