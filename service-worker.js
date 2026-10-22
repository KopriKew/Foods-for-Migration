/* ============================================================
   MUSOFIR TAOMLARI — Service Worker
   Offline rejim: barcha assetlar cache'ga olinadi
   ============================================================ */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = 'musofir-taomlari-' + CACHE_VERSION;

// Install paytida oldindan cache'ga olinadigan fayllar
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.json',
    './icon.svg',
    'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// ============================================================
// INSTALL — precache
// ============================================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                PRECACHE_URLS.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn('[SW] Precache xato:', url, err);
                    })
                )
            );
        }).then(() => {
            // Yangi versiya darhol faol bo'lsin
            return self.skipWaiting();
        })
    );
});

// ============================================================
// ACTIVATE — eski cache'larni tozalash
// ============================================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => {
                        console.log('[SW] Eski cache o\'chirildi:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => {
            // Barcha ochiq tablarga darhol xizmat qilsin
            return self.clients.claim();
        })
    );
});

// ============================================================
// FETCH — so'rovlarni ushlash
// ============================================================
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Faqat GET so'rovlarini cache qilamiz
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Faqat http(s) protokollari
    if (!url.protocol.startsWith('http')) return;

    // YouTube/VK/RuTube iframe va search — cache qilmaymiz
    if (
        url.hostname.includes('youtube.com') ||
        url.hostname.includes('youtu.be') ||
        url.hostname.includes('vk.com') ||
        url.hostname.includes('vkvideo.ru') ||
        url.hostname.includes('rutube.ru')
    ) {
        return;
    }

    // ---------- HTML navigatsiya: network-first, cache fallback ----------
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return res;
                })
                .catch(() => {
                    return caches.match('./index.html').then((cached) => {
                        return cached || caches.match('./');
                    });
                })
        );
        return;
    }

    // ---------- Boshqa assetlar: cache-first, background update ----------
    event.respondWith(
        caches.match(req).then((cached) => {
            const networkFetch = fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                    }
                    return res;
                })
                .catch(() => cached);

            return cached || networkFetch;
        })
    );
});

// ============================================================
// MESSAGE — cache'ni tozalash uchun qo'lda boshqaruv
// ============================================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            event.source.postMessage({ type: 'CACHE_CLEARED' });
        });
    }
});