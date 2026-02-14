// LitePlank Service Worker
const CACHE_NAME = 'liteplank-v1';

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

// Функция для получения текущей версии из localStorage
function getCurrentVersion() {
    try {
        return localStorage.getItem('liteplank-installed-version') || '1.0.0';
    } catch (error) {
        return '1.0.0';
    }
}

// Функция для сохранения версии в localStorage
function saveInstalledVersion(version) {
    try {
        localStorage.setItem('liteplank-installed-version', version);
    } catch (error) {
        console.log('Failed to save version to localStorage');
    }
}

// Функция для получения списка файлов для кэширования
async function getFilesToCache() {
    try {
        const response = await fetch('version.json', { cache: 'no-cache' });
        if (response.ok) {
            const versionData = await response.json();
            return versionData.files || [];
        }
    } catch (error) {
        console.log('Failed to fetch version.json, using default files');
    }
    
    // Файлы по умолчанию, если version.json недоступен
    return [
        '/liteplank/',
        '/liteplank/index.html',
        '/liteplank/style.css',
        '/liteplank/manifest.json',
        '/liteplank/icon-192.png',
        '/liteplank/icon-512.png'
    ];
}

// Функция для сравнения версий
function isNewerVersion(serverVersion, currentVersion) {
    const serverParts = serverVersion.split('.').map(Number);
    const currentParts = currentVersion.split('.').map(Number);
    
    for (let i = 0; i < Math.max(serverParts.length, currentParts.length); i++) {
        const serverPart = serverParts[i] || 0;
        const currentPart = currentParts[i] || 0;
        
        if (serverPart > currentPart) return true;
        if (serverPart < currentPart) return false;
    }
    
    return false;
}

// Функция для обновления кэша
async function updateCache(newVersion) {
    try {
        const filesToCache = await getFilesToCache();
        
        // Создаем временный кэш с новой версией
        const tempCacheName = CACHE_NAME + '-temp-' + Date.now();
        const cache = await caches.open(tempCacheName);
        
        // Добавляем все файлы в временный кэш
        await cache.addAll(filesToCache);
        
        // Получаем список всех кэшей
        const cacheNames = await caches.keys();
        
        // Удаляем старые кэши, оставляя только новый
        await Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName !== tempCacheName) {
                    return caches.delete(cacheName);
                }
            })
        );
        
        // Переименовываем временный кэш в основной
        await caches.rename(tempCacheName, CACHE_NAME);
        
        // Сохраняем новую версию
        saveInstalledVersion(newVersion);
        
        console.log('Cache updated to version:', newVersion);
    } catch (error) {
        console.error('Cache update failed:', error);
    }
}

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
        checkForUpdates()
    );
});

// Функция проверки обновлений
async function checkForUpdates() {
    try {
        // Получаем текущую установленную версию
        const currentVersion = getCurrentVersion();
        console.log('Current installed version:', currentVersion);
        
        // Получаем версию с сервера
        const response = await fetch('version.json', { cache: 'no-cache' });
        
        if (response.ok) {
            const serverVersionData = await response.json();
            const serverVersion = serverVersionData.version;
            
            console.log('Server version:', serverVersion);
            
            // Сравниваем версии
            if (isNewerVersion(serverVersion, currentVersion)) {
                console.log('New version available:', serverVersion);
                await updateCache(serverVersion);
                
                // Уведомляем main thread об обновлении
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'UPDATE_AVAILABLE',
                            version: serverVersion
                        });
                    });
                });
            } else {
                console.log('No update needed');
            }
        } else {
            console.log('Version check failed, using cached version');
        }
    } catch (error) {
        console.log('Version check failed (offline mode):', error);
    }
}

// Обработка сообщений от main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CHECK_FOR_UPDATES') {
        event.waitUntil(checkForUpdates());
    }
});
