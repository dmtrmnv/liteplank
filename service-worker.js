// LitePlank Service Worker - Полностью переработанная система кэширования
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
});

// Функция обновления кэша при наличии сети
async function updateCache() {
    try {
        console.log('Начинаем обновление кэша...');
        
        // Создаем временный кэш для новой версии
        const tempCacheName = CACHE_NAME + '-temp-' + Date.now();
        const tempCache = await caches.open(tempCacheName);
        
        // Список всех возможных файлов приложения
        const allFiles = [
            '/liteplank/',
            '/liteplank/index.html',
            '/liteplank/style.css',
            '/liteplank/manifest.json',
            '/liteplank/icon-192.png',
            '/liteplank/icon-512.png',
            '/liteplank/service-worker.js'
        ];
        
        let filesUpdated = 0;
        let newFilesFound = 0;
        
        // Сначала кэшируем все файлы из списка
        for (const file of allFiles) {
            try {
                // Создаем абсолютный URL для каждого файла
                const absoluteUrl = new URL(file, location.origin).href;
                
                // Пытаемся получить файл с сервера
                const response = await fetch(absoluteUrl, { 
                    cache: 'no-cache',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (response.ok) {
                    // Проверяем, отличается ли файл от закэшированного
                    const cachedResponse = await caches.match(absoluteUrl);
                    let shouldUpdate = true;
                    
                    if (cachedResponse) {
                        // Сравниваем размеры файлов
                        const cachedSize = await cachedResponse.clone().blob().then(b => b.size);
                        const newSize = await response.clone().blob().then(b => b.size);
                        
                        // Если размеры совпадают, возможно файл не изменился
                        if (cachedSize === newSize) {
                            // Для надежности можно добавить проверку по etag или last-modified
                            const cachedEtag = cachedResponse.headers.get('etag');
                            const newEtag = response.headers.get('etag');
                            const cachedLastModified = cachedResponse.headers.get('last-modified');
                            const newLastModified = response.headers.get('last-modified');
                            
                            if (cachedEtag && newEtag && cachedEtag === newEtag) {
                                shouldUpdate = false;
                            } else if (cachedLastModified && newLastModified && cachedLastModified === newLastModified) {
                                shouldUpdate = false;
                            } else if (!cachedEtag && !newEtag && !cachedLastModified && !newLastModified) {
                                // Если нет заголовков, сравниваем содержимое
                                const cachedText = await cachedResponse.clone().text();
                                const newText = await response.clone().text();
                                shouldUpdate = cachedText !== newText;
                            }
                        }
                    } else {
                        // Файл не был закэширован ранее - это новый файл
                        newFilesFound++;
                        console.log(`Найден новый файл: ${file}`);
                    }
                    
                    if (shouldUpdate) {
                        await tempCache.put(absoluteUrl, response);
                        filesUpdated++;
                        console.log(`Файл обновлен: ${file}`);
                    } else {
                        // Копируем из старого кэша
                        const cachedResponse = await caches.match(absoluteUrl);
                        if (cachedResponse) {
                            await tempCache.put(absoluteUrl, cachedResponse);
                        }
                        console.log(`Файл не изменился: ${file}`);
                    }
                } else {
                    console.warn(`Не удалось загрузить файл: ${file}, статус: ${response.status}`);
                    // Копируем из старого кэша, если есть
                    const cachedResponse = await caches.match(absoluteUrl);
                    if (cachedResponse) {
                        await tempCache.put(absoluteUrl, cachedResponse);
                    }
                }
            } catch (error) {
                console.error(`Ошибка при загрузке файла ${file}:`, error);
                // Копируем из старого кэша, если есть
                const cachedResponse = await caches.match(absoluteUrl);
                if (cachedResponse) {
                    await tempCache.put(absoluteUrl, cachedResponse);
                }
            }
        }

        // Динамическое обнаружение новых файлов
        try {
            // Получаем все файлы, которые уже есть в кэше
            const allCachedRequests = await caches.keys().then(cacheNames => {
                return Promise.all(cacheNames.map(cacheName => caches.open(cacheName).then(cache => cache.keys())));
            }).then(requestArrays => requestArrays.flat());

            // Проверяем каждый файл из кэша на наличие обновлений
            for (const cachedRequest of allCachedRequests) {
                try {
                    const response = await fetch(cachedRequest.url, { 
                        cache: 'no-cache',
                        headers: {
                            'Cache-Control': 'no-cache'
                        }
                    });
                    
                    if (response.ok) {
                        const cachedResponse = await caches.match(cachedRequest.url);
                        let shouldUpdate = true;
                        
                        if (cachedResponse) {
                            const cachedSize = await cachedResponse.clone().blob().then(b => b.size);
                            const newSize = await response.clone().blob().then(b => b.size);
                            
                            if (cachedSize === newSize) {
                                const cachedEtag = cachedResponse.headers.get('etag');
                                const newEtag = response.headers.get('etag');
                                
                                if (cachedEtag && newEtag && cachedEtag === newEtag) {
                                    shouldUpdate = false;
                                }
                            }
                        } else {
                            // Файл не был закэширован ранее - это новый файл
                            newFilesFound++;
                            console.log(`Найден новый файл: ${cachedRequest.url}`);
                        }
                        
                        if (shouldUpdate) {
                            await tempCache.put(cachedRequest.url, response);
                            filesUpdated++;
                            console.log(`Файл обновлен: ${cachedRequest.url}`);
                        } else {
                            const cachedResponse = await caches.match(cachedRequest.url);
                            if (cachedResponse) {
                                await tempCache.put(cachedRequest.url, cachedResponse);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Ошибка при проверке файла ${cachedRequest.url}:`, error);
                }
            }
        } catch (error) {
            console.log('Ошибка при динамическом обнаружении файлов:', error);
        }

        if (filesUpdated > 0) {
            console.log(`Обновлено файлов: ${filesUpdated}`);
            
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
                        filesUpdated: filesUpdated
                    });
                });
            });
        } else {
            console.log('Нет обновлений для файлов');
            // Удаляем временный кэш
            await caches.delete(tempCacheName);
        }
        
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

// Проверка обновлений при активации
self.addEventListener('activate', (event) => {
    event.waitUntil(
        checkForUpdates()
    );
});

// Функция проверки обновлений
async function checkForUpdates() {
    try {
        console.log('Проверка обновлений...');
        
        // Проверяем наличие сети
        if (!navigator.onLine) {
            console.log('Нет подключения к сети, работа в офлайн режиме');
            return;
        }
        
        // Пытаемся обновить кэш
        await updateCache();
        
    } catch (error) {
        console.log('Проверка обновлений не удалась (режим офлайн):', error);
    }
}

// Проверка обновлений при каждом запросе (если есть сеть)
self.addEventListener('fetch', (event) => {
    // Проверяем, есть ли сеть и не является ли запрос кэшированным
    if (navigator.onLine && event.request.method === 'GET') {
        // Проверяем обновления раз в 10 минут
        const now = Date.now();
        const lastCheck = self.registration?.lastCheck || 0;
        
        if (now - lastCheck > 10 * 60 * 1000) {
            // Обновляем метку времени
            self.registration.lastCheck = now;
            
            // Асинхронно проверяем обновления
            event.waitUntil(updateCache());
        }
    }
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CHECK_FOR_UPDATES') {
        event.waitUntil(updateCache());
    }
});