// LitePlank Service Worker - Версионированная система кэширования
// Версия: liteplank-v2.1.2
const CACHE_NAME = 'liteplank-v2.1.60';
const baseUrl = self.location.origin + '/liteplank';
const urlsToCache = [
    baseUrl + '/',
    baseUrl + '/index.html',
    baseUrl + '/style.css', 
    baseUrl + '/manifest.json',
    baseUrl + '/icon-192.png',
    baseUrl + '/icon-512.png',
    baseUrl + '/js/app.js',
    baseUrl + '/js/i18b.js',
    baseUrl + '/js/planks.js',
    baseUrl + '/js/calendar.js',
    baseUrl + '/css/calendar.css',
    baseUrl + '/locales/ru.json',
    baseUrl + '/locales/en.json',
    baseUrl + '/planks/elbow_plank.json',
    baseUrl + '/planks/img/elbow_plank.jpg'
];


// Установка Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache)
                    .catch((error) => {
                        console.error('[SW] Cache installation failed:', error);
                        // Продолжаем установку даже при частичной неудаче
                    });
            })
    );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
    // Обрабатываем только GET-запросы
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                
                return fetch(event.request)
                    .then((response) => {
                        // Кэшируем ТОЛЬКО успешные ответы со статусом 200
                        if (!response || response.status !== 200) {
                            return response;
                        }
                        
                        // Кэшируем клон ответа
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            })
                            .catch((error) => {
                                console.warn('[SW] Failed to cache:', event.request.url, error);
                            });
                        
                        return response;
                    })
                    .catch(() => {
                        // Fallback: точная проверка пути через URL API
                        const url = new URL(event.request.url);
                        if (url.pathname === '/' || url.pathname === '/index.html') {
                            return caches.match(baseUrl + '/');
                        }
                        return caches.match(event.request);
                    });
            })
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log('[SW] Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => self.clients.claim()) // Немедленно активируем новый SW
    );
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting?.();
    }

});





