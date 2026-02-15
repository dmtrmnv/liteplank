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
    console.log('Service Worker: ПЕРЕХВАЧЕН ЗАПРОС К version.json:', event.request.url);
    console.log('Service Worker: URL запроса:', event.request.url);
    console.log('Service Worker: Метод:', event.request.method);
    console.log('Service Worker: Headers:', event.request.headers);
    
    event.respondWith(
        Promise.all([
            // Получаем version.json из кэша
            caches.open(CACHE_NAME).then(cache => {
                console.log('Service Worker: Проверка кэша для version.json');
                return cache.match(event.request).then(response => 
                    response ? response.clone().json() : null
                );
            }),
            // Получаем version.json с сервера
            fetch(event.request, { cache: 'no-cache' }).then(response => {
                console.log('Service Worker: Запрос к серверу для version.json, статус:', response.status);
                return response.ok ? response.clone().json() : null;
            }).catch(error => {
                console.log('Service Worker: Ошибка запроса к серверу:', error);
                return null;
            })
        ]).then(([cachedVersion, serverVersion]) => {
            console.log('Service Worker: Сравнение версий:', {
                cached: cachedVersion?.version || 'отсутствует',
                server: serverVersion?.version || 'отсутствует'
            });
            
            // Если есть серверная версия
            if (serverVersion) {
                // Сравниваем версии
                if (!cachedVersion || cachedVersion.version !== serverVersion.version) {
                    console.log('Service Worker: ОБНАРУЖЕНО ОБНОВЛЕНИЕ version.json!', {
                        cached: cachedVersion?.version || 'отсутствует',
                        server: serverVersion.version
                    });
                    
                    // Удаляем старый version.json из кэша
                    caches.open(CACHE_NAME).then(cache => {
                        console.log('Service Worker: Удаление старого version.json из кэша');
                        cache.delete(event.request);
                    });
                    
                    // Загружаем и кэшируем новую версию
                    return fetch(event.request, { cache: 'no-cache' })
                        .then(response => {
                            if (response.ok) {
                                console.log('Service Worker: Загрузка новой версии version.json');
                                const responseToCache = response.clone();
                                caches.open(CACHE_NAME).then(cache => {
                                    console.log('Service Worker: Кэширование новой версии version.json');
                                    cache.put(event.request, responseToCache);
                                });
                                
                                // Загружаем сам version.json для получения списка файлов
                                response.clone().json().then(serverVersion => {
                                    console.log('Service Worker: ОБНАРУЖЕНО ОБНОВЛЕНИЕ version.json! Перестраиваю кэш с новыми файлами');
                                    console.log('Service Worker: Новая версия:', serverVersion.version);
                                    console.log('Service Worker: Файлы для кэширования:', serverVersion.files);
                                    
                                    // Немедленно перестраиваем кэш с новыми файлами
                                    updateCache(serverVersion).then(() => {
                                        console.log('Service Worker: Кэш успешно перестроен с новыми файлами!');
                                    }).catch(error => {
                                        console.error('Service Worker: Ошибка при перестройке кэша:', error);
                                    });
                                });
                            }
                            return response;
                        });
                } else {
                    console.log('Service Worker: Версии одинаковые, возвращаем серверную версию');
                    // Версии одинаковые, возвращаем серверную версию
                    return fetch(event.request, { cache: 'no-cache' });
                }
            } else if (cachedVersion) {
                console.log('Service Worker: Сервер недоступен, возвращаем из кэша');
                // Сервер недоступен, но есть кэш
                return caches.match(event.request);
            } else {
                console.log('Service Worker: Ни сервер, ни кэш недоступны');
                // Ни сервер, ни кэш недоступны
                throw new Error('version.json недоступен');
            }
        }).catch(error => {
            console.log('Service Worker: Ошибка в обработке version.json:', error);
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
        })
    );
});

// Функция обновления кэша
async function updateCache(serverVersion) {
    try {
        console.log('Service Worker: Начинаю перестройку кэша для версии:', serverVersion.version);
        
        // Создаем временный кэш для новой версии
        const tempCacheName = CACHE_NAME + '-temp-' + Date.now();
        const tempCache = await caches.open(tempCacheName);
        
        // Добавляем все файлы из нового version.json
        const filesToCache = serverVersion.files || [];
        
        // Также добавляем сам version.json
        if (!filesToCache.includes('liteplank/version.json')) {
            filesToCache.push('liteplank/version.json');
        }
        
        console.log('Service Worker: Файлы для кэширования:', filesToCache);
        
        // Кэшируем все файлы из version.json
        for (const file of filesToCache) {
            try {
                // Создаем абсолютный URL для каждого файла
                const absoluteUrl = new URL(file, location.origin).href;
                console.log('Service Worker: Кэширование файла:', file, '->', absoluteUrl);
                
                const response = await fetch(absoluteUrl, { cache: 'no-cache' });
                
                if (response.ok) {
                    await tempCache.put(absoluteUrl, response);
                    console.log('Service Worker: Файл успешно закэширован:', file);
                } else {
                    console.warn(`Service Worker: Не удалось загрузить файл: ${file}, статус: ${response.status}`);
                }
            } catch (error) {
                console.error(`Service Worker: Ошибка при загрузке файла ${file}:`, error);
            }
        }

        // Получаем все имена кэшей
        const cacheNames = await caches.keys();
        
        // Удаляем ВСЕ старые кэши (включая текущий)
        console.log('Service Worker: Удаление всех старых кэшей');
        await Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName !== tempCacheName) {
                    console.log('Service Worker: Удаление кэша:', cacheName);
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
        
        console.log('Service Worker: Копирование файлов во временный кэш в основной');
        for (const request of requests) {
            try {
                const response = await tempCache2.match(request);
                if (response) {
                    await mainCache.put(request, response);
                    console.log('Service Worker: Скопирован файл:', request.url);
                }
            } catch (error) {
                console.error(`Service Worker: Ошибка при копировании файла ${request.url}:`, error);
            }
        }
        
        // Удаляем временный кэш
        await caches.delete(tempCacheName);
        console.log('Service Worker: Временный кэш удален');
        
        console.log('Service Worker: Кэш успешно перестроен! Теперь содержит ТОЛЬКО файлы из version.json');
        
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
        console.error('Service Worker: Ошибка при перестройке кэша:', error);
        // В случае ошибки удаляем временный кэш
        const cacheNames = await caches.keys();
        cacheNames.forEach(cacheName => {
            if (cacheName.includes('-temp-')) {
                caches.delete(cacheName);
            }
        });
    }
}
