// i18n.js - Система интернационализации для LitePlank
class I18n {
    constructor() {
        this.translations = {};
        this.currentLang = 'ru';
        this.fallbackLang = 'ru';
        this.supportedLangs = ['ru', 'en'];
        this.isLoaded = false;
    }

    // Загрузка переводов из JSON файла
    async loadTranslations(lang = 'ru') {
        try {
            const response = await fetch(`locales/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load translations for ${lang}`);
            }
            this.translations = await response.json();
            this.currentLang = lang;
            this.isLoaded = true;
            console.log(`[i18n] Переводы загружены для языка: ${lang}`);
            return true;
        } catch (error) {
            console.error(`[i18n] Ошибка загрузки переводов для ${lang}:`, error);
            // Используем fallback переводы
            this.translations = this.getFallbackTranslations();
            this.currentLang = this.fallbackLang;
            this.isLoaded = true;
            return false;
        }
    }

    // Fallback переводы на русский (встроенные в код)
    getFallbackTranslations() {
        return {
            app: {
                title: "LitePlank - Планка трекер",
                description: "PWA приложение для тренировок планки",
                loading: "Загрузка...",
                brand: {
                    title: "LitePlank",
                    subtitle: "Планка трекер"
                }
            },
            tabs: {
                timer: "Таймер",
                history: "История",
                settings: "Настройки"
            },
            theme: {
                dark: "Темная тема",
                light: "Светлая тема"
            },
            language: {
                title: "Язык",
                ru: "Русский",
                en: "English"
            },
            timer: {
                start: "Старт",
                pause: "Пауза",
                finish: "Завершить",
                reset: "Сброс",
                duration: "Время (сек)"
            },
            history: {
                title: "История тренировок",
                totalSessions: "Всего тренировок:",
                totalTime: "Общее время:",
                totalCalories: "Сожжено калорий:",
                totalWeight: "Удержано кг:",
                avgTime: "Среднее время:",
                hint: "Расчет: Вес × Количество тренировок",
                emptyState: "История тренировок пуста",
                emptyHint: "Начните первую тренировку, чтобы увидеть здесь результаты",
                clearHistory: "Очистить историю",
                deleteSession: "Удалить тренировку"
            },
            settings: {
                title: "Настройки",
                subtitle: "Персонализируйте свое приложение",
                basicSettings: "⚙️ Основные настройки",
                gender: "Пол",
                genderMale: "Мужской",
                genderFemale: "Женский",
                weight: "Вес (кг)",
                height: "Рост (см)",
                age: "Возраст",
                saveSettings: "💾 Сохранить параметры",
                defaultDuration: "Время по умолчанию (сек)",
                soundEnabled: "Звуковой сигнал",
                vibrationEnabled: "Вибрация",
                data: "💾 Данные",
                exportData: "Экспорт данных",
                importData: "Импорт данных",
                exportInfo: "Экспорт сохранит все ваши тренировки и настройки в файл JSON.",
                importInfo: "Импорт заменит все текущие данные на данные из файла.",
                reset: "🔧 Сброс",
                clearAll: "Очистить все данные",
                resetSettings: "Сбросить настройки",
                warning: "Внимание:",
                clearWarning: "Очистка данных удалит всю историю тренировок и сбросит настройки.",
                cannotUndo: "Это действие нельзя отменить."
            },
            notifications: {
                info: "Информация",
                success: "Успешно",
                error: "Ошибка",
                warning: "Предупреждение",
                sessionDeleted: "Тренировка удалена",
                historyCleared: "История тренировок очищена",
                allDataCleared: "Все данные удалены",
                settingsReset: "Настройки сброшены",
                userSettingsSaved: "Параметры пользователя сохранены",
                invalidInput: "Пожалуйста, введите корректные значения веса, роста и возраста",
                audioUnavailable: "Аудио недоступно. Звук отключен.",
                updateAvailable: "Доступно обновление приложения",
                dataExported: "Данные успешно экспортированы!",
                dataImported: "Данные успешно импортированы!",
                invalidFile: "Некорректный формат файла",
                fileReadError: "Ошибка при чтении файла",
                languageChanged: "Язык изменен на {{lang}}"
            },
            confirmations: {
                deleteSession: "Удалить эту тренировку?",
                clearHistory: "Очистить всю историю тренировок?",
                clearAllData: "Вы уверены, что хотите удалить все данные? Это действие нельзя отменить.",
                importData: "Это заменит все текущие данные. Продолжить?",
                updateApp: "Доступно обновление приложения. Применить обновление?"
            },
            time: {
                seconds: "сек",
                minutes: "мин",
                second: "сек",
                minute: "мин"
            },
            units: {
                kg: "кг",
                kcal: "ккал"
            }
        };
    }

    // Получение перевода по ключу
    translate(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Ключ не найден, возвращаем ключ или fallback
                console.warn(`[i18n] Ключ не найден: ${key}`);
                return key;
            }
        }

        // Замена параметров в строке (например, {{name}})
        if (typeof value === 'string') {
            Object.keys(params).forEach(param => {
                value = value.replace(`{{${param}}}`, params[param]);
            });
        }

        return value || key;
    }

    // Применение переводов ко всем элементам с data-i18n
    applyTranslations() {
        if (!this.isLoaded) {
            console.warn('[i18n] applyTranslations вызван до загрузки переводов');
            return;
        }

        // Текстовые элементы
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const text = this.translate(key);

            // Для input и select обрабатываем по-разному
            if (element.tagName === 'INPUT' && element.type !== 'checkbox' && element.type !== 'radio') {
                element.placeholder = text;
            } else if (element.tagName === 'OPTION') {
                element.textContent = text;
            } else {
                element.textContent = text;
            }
        });

        // Элементы с data-i18n-title (для title атрибута)
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.setAttribute('title', this.translate(key));
        });

        // Элементы с data-i18n-content (для content атрибута meta)
        document.querySelectorAll('[data-i18n-content]').forEach(element => {
            const key = element.getAttribute('data-i18n-content');
            element.setAttribute('content', this.translate(key));
        });

        // Обновляем заголовок страницы
        document.title = this.translate('app.title');

        // Обновляем html lang атрибут
        document.documentElement.lang = this.currentLang;
    }

    // Установка языка с сохранением в localStorage
    setLanguage(lang) {
        if (!this.supportedLangs.includes(lang)) {
            console.warn(`[i18n] Язык ${lang} не поддерживается`);
            return false;
        }

        // Сохраняем выбранный язык в localStorage
        localStorage.setItem('liteplank-language', lang);

        // Загружаем переводы для нового языка
        return this.loadTranslations(lang).then(success => {
            if (success) {
                this.applyTranslations();
                console.log(`[i18n] Язык установлен: ${lang}`);
            }
            return success;
        });
    }

    // Получение текущего языка
    getCurrentLang() {
        return this.currentLang;
    }

    // Получение сохраненного языка из localStorage
    getSavedLanguage() {
        return localStorage.getItem('liteplank-language') || 'ru';
    }

    // Проверка загруженности переводов
    isReady() {
        return this.isLoaded;
    }

    // Получение списка поддерживаемых языков
    getSupportedLangs() {
        return this.supportedLangs;
    }
}

// Экспортируем глобальный экземпляр
window.i18n = new I18n();