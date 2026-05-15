const CACHE_NAME = 'price-tracker-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache).catch((error) => {
                console.log('Cache addAll error:', error);
                // بعض الملفات قد لا تكون متاحة, لكننا نتابع
            });
        })
    );
    self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Network First Strategy for API, Cache First for assets
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // تخطي البطلبات غير GET
    if (request.method !== 'GET') {
        return;
    }

    // API requests - Network First
    if (request.url.includes('api.') || request.url.includes('.com/v')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // كاش الاستجابة الناجحة
                    if (response && response.status === 200) {
                        const cache = caches.open(CACHE_NAME);
                        cache.then((c) => c.put(request, response.clone()));
                    }
                    return response;
                })
                .catch(() => {
                    // fallback للكاش إذا فشلت الشبكة
                    return caches.match(request);
                })
        );
    } else {
        // Static assets - Cache First
        event.respondWith(
            caches.match(request).then((response) => {
                return response || fetch(request);
            })
        );
    }
});

// Background Sync (معالجة البيانات عند عودة الاتصال)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-prices') {
        event.waitUntil(
            fetch('/api/prices')
                .then(() => {
                    self.clients.matchAll().then((clients) => {
                        clients.forEach((client) => {
                            client.postMessage({
                                type: 'PRICES_SYNCED'
                            });
                        });
                    });
                })
        );
    }
});

// Push Notifications
self.addEventListener('push', (event) => {
    let notificationData = {
        title: 'متتبع الأسعار 📊',
        body: 'تحديث جديد في الأسعار',
        badge: '📊'
    };

    if (event.data) {
        try {
            notificationData = event.data.json();
        } catch (e) {
            notificationData.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationData.title, {
            body: notificationData.body,
            badge: notificationData.badge,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%231a1a2e" width="192" height="192"/><text x="50%" y="50%" font-size="80" text-anchor="middle" dominant-baseline="middle">📊</text></svg>'
        })
    );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (let client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
