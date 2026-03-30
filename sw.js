// ============================================
// SERVICE WORKER - TURBINE LOGSHEET PRO
// ============================================
// CATATAN: Versi di sini akan otomatis tersinkron dengan app.js
// melalui URL parameter saat registrasi: sw.js?v=2.0.0
// ============================================

// Ambil versi dari URL parameter (dari app.js saat register)
const getVersionFromURL = () => {
    const url = new URL(self.location.href);
    return url.searchParams.get('v') || '1.0.0';
};

const VERSION = getVersionFromURL();
const CACHE_NAME = `turbine-logsheets-v${VERSION}`;

// Daftar assets yang akan di-cache
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './app.js'
];

// ============================================
// INSTALL EVENT - Cache assets
// ============================================
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing version ${VERSION}...`);

    // Skip waiting langsung agar SW baru segera aktif
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log(`[SW] Caching assets for version ${VERSION}`);
                return cache.addAll(ASSETS);
            })
            .catch((err) => {
                console.error('[SW] Failed to cache assets:', err);
            })
    );
});

// ============================================
// ACTIVATE EVENT - Bersihkan cache lama
// ============================================
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activating version ${VERSION}...`);

    event.waitUntil(
        // Ambil kendali semua clients segera
        clients.claim()
            .then(() => {
                // Bersihkan cache lama yang tidak sesuai versi
                return caches.keys().then((cacheNames) => {
                    return Promise.all(
                        cacheNames.map((cacheName) => {
                            // Hapus cache yang namanya tidak sama dengan CACHE_NAME saat ini
                            if (cacheName !== CACHE_NAME) {
                                console.log(`[SW] Deleting old cache: ${cacheName}`);
                                return caches.delete(cacheName);
                            }
                        })
                    );
                });
            })
            .then(() => {
                console.log(`[SW] Version ${VERSION} is now active!`);
                // Broadcast ke semua clients bahwa SW baru sudah aktif
                return clients.matchAll().then((clients) => {
                    clients.forEach((client) => {
                        client.postMessage({
                            type: 'SW_ACTIVATED',
                            version: VERSION
                        });
                    });
                });
            })
    );
});

// ============================================
// FETCH EVENT - Strategi Cache First, then Network
// ============================================
self.addEventListener('fetch', (event) => {
    // Hanya handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    const { request } = event;

    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                // Jika ada di cache, return segera
                if (cachedResponse) {
                    // Tetap fetch dari network untuk update cache di background
                    const fetchPromise = fetch(request)
                        .then((networkResponse) => {
                            // Update cache dengan response terbaru
                            if (networkResponse && networkResponse.status === 200) {
                                const cacheCopy = networkResponse.clone();
                                caches.open(CACHE_NAME).then((cache) => {
                                    cache.put(request, cacheCopy);
                                });
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            // Network error, ignore karena sudah return dari cache
                        });

                    // Return dari cache segera
                    return cachedResponse;
                }

                // Jika tidak ada di cache, fetch dari network
                return fetch(request)
                    .then((networkResponse) => {
                        // Cache response baru
                        if (networkResponse && networkResponse.status === 200) {
                            const cacheCopy = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, cacheCopy);
                            });
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('[SW] Fetch failed:', error);
                        // Return fallback jika ada
                        return new Response('Network error', { 
                            status: 408,
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    });
            })
    );
});

// ============================================
// MESSAGE EVENT - Handle pesan dari main thread
// ============================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Skip waiting triggered by client');
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'GET_VERSION') {
        event.source.postMessage({
            type: 'VERSION_INFO',
            version: VERSION
        });
    }
});
