// LitePlank Service Worker
const CACHE_NAME = 'liteplank-v1';
const urlsToCache = [
    '/liteplank/',
    '/liteplank/index.html',
    '/liteplank/style.css',
    '/liteplank/manifest.json',
    '/liteplank/icon-192.png',
    '/liteplank/icon-512.png'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Возвращаем закэшированный ресурс или делаем запрос
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    (response) => {
                        // Проверяем, что ответ валидный
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Кэшируем ответ
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
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
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Проверка обновлений при активации нового сервис-воркера
    event.waitUntil(
        // Проверяем наличие нового файла версии
        fetch('/version.json', { cache: 'no-cache' })
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('No version file');
            })
            .then(serverVersion => {
                // Если версия на сервере новее, обновляем кэш
                if (serverVersion.version !== '1.0.3') {
                    return caches.open(CACHE_NAME + '-temp')
                        .then(cache => cache.addAll(urlsToCache))
                        .then(() => caches.keys())
                        .then(cacheNames => {
                            return Promise.all(
                                cacheNames.map(cacheName => {
                                    if (cacheName !== CACHE_NAME + '-temp') {
                                        return caches.delete(cacheName);
                                    }
                                })
                            );
                        })
                        .then(() => caches.rename(CACHE_NAME + '-temp', CACHE_NAME));
                }
            })
            .catch(() => {
                // Игнорируем ошибки - приложение должно работать офлайн
                console.log('Version check failed (offline mode)');
            })
    );
});
