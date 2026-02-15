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
// Для version.json всегда проверяем сервер и сравниваем версии
if (event.request.url.includes('version.json')) {
    event.respondWith(
        Promise.all([
            // Получаем version.json из кэша
            caches.open(CACHE_NAME).then(cache => cache.match(event.request)).then(response => 
                response ? response.clone().json() : null
            ),
            // Получаем version.json с сервера
            fetch(event.request, { cache: 'no-cache' }).then(response => 
                response.ok ? response.clone().json() : null
            )
        ]).then(([cachedVersion, serverVersion]) => {
            // Если есть серверная версия
            if (serverVersion) {
                // Сравниваем версии
                if (!cachedVersion || cachedVersion.version !== serverVersion.version) {
                    console.log('Обнаружено обновление version.json:', {
                        cached: cachedVersion?.version || 'отсутствует',
                        server: serverVersion.version
                    });
                    
                    // Удаляем старый version.json из кэша
                    caches.open(CACHE_NAME).then(cache => {
                        cache.delete(event.request);
                    });
                    
                    // Загружаем и кэшируем новую версию
                    return fetch(event.request, { cache: 'no-cache' })
                        .then(response => {
                            if (response.ok) {
                                const responseToCache = response.clone();
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                            }
                            return response;
                        });
                } else {
                    // Версии одинаковые, возвращаем серверную версию
                    return fetch(event.request, { cache: 'no-cache' });
                }
            } else if (cachedVersion) {
                // Сервер недоступен, но есть кэш
                return caches.match(event.request);
            } else {
                // Ни сервер, ни кэш недоступны
                throw new Error('version.json недоступен');
            }
        }).catch(() => {
            // При любой ошибке возвращаем из кэша
            return caches.match(event.request) || new Response('{"version":"0.0.0"}', {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        })
    );
    return;
}

    // Для остальных файлов - стандартная логика кэширования
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    (response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

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
        }).then(() => {
            // После очистки кэшей проверяем обновления
            return checkForUpdates();
        })
    );
});

// Функция проверки обновлений
async function checkForUpdates() {
    try {
        // Получаем version.json из кэша
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match('version.json');
        let cachedVersion = null;
        
        if (cachedResponse) {
            cachedVersion = await cachedResponse.json();
        }

        // Получаем version.json с сервера
        const networkResponse = await fetch('version.json', { cache: 'no-cache' });
        
        // Если version.json не найден на сервере, ничего не делаем
        if (!networkResponse.ok) {
            console.log('version.json не найден на сервере, обновление пропущено');
            return;
        }
        
        const serverVersion = await networkResponse.json();

        // Выводим версии в консоль
        console.log('Версия из кэша:', cachedVersion?.version || 'отсутствует');
        console.log('Версия с сервера:', serverVersion.version);

        // Если версии отличаются или кэш пуст
        if (!cachedVersion || cachedVersion.version !== serverVersion.version) {
            console.log('Обнаружено обновление:', {
                cached: cachedVersion?.version || 'отсутствует',
                server: serverVersion.version
            });

            // Обновляем кэш с новыми файлами
            await updateCache(serverVersion);
        }
    } catch (error) {
        console.log('Проверка обновлений не удалась (режим офлайн):', error);
    }
}

// Функция обновления кэша
async function updateCache(serverVersion) {
    try {
        // Создаем временный кэш для новой версии
        const tempCacheName = CACHE_NAME + '-temp-' + Date.now();
        const tempCache = await caches.open(tempCacheName);
        
        // Добавляем все файлы из нового version.json
        const filesToCache = serverVersion.files || [];
        
        // Также добавляем сам version.json
        if (!filesToCache.includes('liteplank/version.json')) {
            filesToCache.push('liteplank/version.json');
        }
        
        // Кэшируем все файлы
        for (const file of filesToCache) {
            try {
                // Создаем абсолютный URL для каждого файла
                const absoluteUrl = new URL(file, location.origin).href;
                const response = await fetch(absoluteUrl, { cache: 'no-cache' });
                
                if (response.ok) {
                    await tempCache.put(absoluteUrl, response);
                } else {
                    console.warn(`Не удалось загрузить файл: ${file}, статус: ${response.status}`);
                }
            } catch (error) {
                console.error(`Ошибка при загрузке файла ${file}:`, error);
            }
        }

        // Получаем все имена кэшей
        const cacheNames = await caches.keys();
        
        // Удаляем старые кэши
        await Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName !== tempCacheName) {
                    return caches.delete(cacheName);
                }
            })
        );

        // Переименовываем временный кэш в основной
        await caches.open(CACHE_NAME);
        const mainCache = await caches.open(CACHE_NAME);
        
        // Копируем содержимое временного кэша в основной
        const tempCache2 = await caches.open(tempCacheName);
        const requests = await tempCache2.keys();
        
        for (const request of requests) {
            try {
                const response = await tempCache2.match(request);
                if (response) {
                    await mainCache.put(request, response);
                }
            } catch (error) {
                console.error(`Ошибка при копировании файла ${request.url}:`, error);
            }
        }
        
        // Удаляем временный кэш
        await caches.delete(tempCacheName);
        
        console.log('Кэш успешно обновлен');
        
        // Уведомляем клиента об обновлении
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'UPDATE_AVAILABLE',
                    version: serverVersion.version
                });
            });
        });
        
    } catch (error) {
        console.error('Ошибка при обновлении кэша:', error);
        // В случае ошибки удаляем временный кэш
        const cacheNames = await caches.keys();
        cacheNames.forEach(cacheName => {
            if (cacheName.includes('-temp-')) {
                caches.delete(cacheName);
            }
        });
    }
}
