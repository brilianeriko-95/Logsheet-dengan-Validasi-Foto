// ============================================
// SERVICE WORKER - TURBINE LOGSHEET PRO
// Version: 2.0.0
// ============================================

// Ambil versi dari URL parameter (dikirim dari app.js saat registrasi)
const getVersionFromURL = () => {
    const url = new URL(self.location.href);
    return url.searchParams.get('v') || '1.0.0';
};

const VERSION = getVersionFromURL();
const CACHE_NAME = `turbine-logsheets-v${VERSION}`;

// Daftar assets yang wajib di-cache agar aplikasi bisa jalan offline
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/config.js',
    './js/ui-utils.js',
    './js/auth.js',
    './js/logsheet.js',
    './js/balancing.js',
    './js/tpm.js',
    './js/app.js',
    './logo.png' // Pastikan file logo ada di folder root
];

// ============================================
// INSTALL EVENT: Membuat Cache Baru
// ============================================
self.addEventListener('install', (event) => {
    console.log(`[SW] Installing version ${VERSION}...`);
    self.skipWaiting(); // Paksa SW baru untuk segera aktif

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log(`[SW] Caching all assets for version ${VERSION}`);
                return cache.addAll(ASSETS);
            })
            .catch((err) => {
                console.error('[SW] Failed to cache assets:', err);
            })
    );
});

// ============================================
// ACTIVATE EVENT: Menghapus Cache Lama
// ============================================
self.addEventListener('activate', (event) => {
    console.log(`[SW] Activating version ${VERSION}...`);

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Hapus cache yang versinya sudah tidak cocok
                    if (cacheName !== CACHE_NAME) {
                        console.log(`[SW] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log(`[SW] Version ${VERSION} is now active and controlling clients.`);
            return self.clients.claim();
        })
    );
});

// ============================================
// FETCH EVENT: Strategi Cache First, then Network
// ============================================
self.addEventListener('fetch', (event) => {
    // Hanya tangani GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Jika ada di cache, langsung kembalikan
                if (cachedResponse) {
                    // Update cache di background (stale-while-revalidate)
                    fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const cacheCopy = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
                        }
                    }).catch(() => {}); // Abaikan jika gagal (misal offline)
                    
                    return cachedResponse;
                }

                // Jika tidak ada di cache, ambil dari network
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const cacheCopy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
                    }
                    return networkResponse;
                });
            })
            .catch(() => {
                // Jika offline total dan file tidak ada di cache
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});

// ============================================
// MESSAGE EVENT: Komunikasi dengan app.js
// ============================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
