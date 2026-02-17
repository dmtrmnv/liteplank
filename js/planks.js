// LitePlank - Модуль управления планками
class PlanksManager {
    constructor() {
        this.planks = [];
        this.currentPlank = null;
        this.planksDir = 'planks';
        this.storageKey = 'liteplank-selected-plank';
    }

    // Загрузка всех планок
    async loadPlanks() {
        const plankFiles = [
            'elbow_plank.json',
            'high_plank.json',
            'knee_plank.json',
            'raised_leg_plank.json',
            'side_plank.json'
        ];

        try {
            const loadPromises = plankFiles.map(async (file) => {
                try {
                    const response = await fetch(`${this.planksDir}/${file}`);
                    if (!response.ok) throw new Error(`Failed to load ${file}`);
                    return await response.json();
                } catch (error) {
                    console.warn(`Could not load plank: ${file}`, error);
                    return null;
                }
            });

            const results = await Promise.all(loadPromises);
            this.planks = results.filter(plank => plank !== null);
            
            // Загружаем сохраненную планку или выбираем первую
            const savedPlankId = localStorage.getItem(this.storageKey);
            if (savedPlankId) {
                this.currentPlank = this.planks.find(p => p.id === savedPlankId) || this.planks[0];
            } else {
                this.currentPlank = this.planks[0];
            }
            
            return this.planks;
        } catch (error) {
            console.error('Error loading planks:', error);
            return [];
        }
    }

    // Получить текущую планку
    getCurrentPlank() {
        return this.currentPlank;
    }

    // Получить MET текущей планки
    getCurrentMet() {
        return this.currentPlank ? this.currentPlank.met : 3.5;
    }

    // Выбрать планку по ID
    selectPlank(plankId) {
        const plank = this.planks.find(p => p.id === plankId);
        if (plank) {
            this.currentPlank = plank;
            localStorage.setItem(this.storageKey, plankId);
            return plank;
        }
        return null;
    }

    // Получить название планки через систему локализации
    getPlankName(plank) {
        if (!plank) return '';
        // Используем i18n для получения перевода
        return window.i18n ? window.i18n.translate(`plank.${plank.id}`) : plank.id;
    }

// Получить путь к изображению планки
    getPlankImagePath(plank) {
        if (!plank || !plank.image) return null;
        return `${this.planksDir}/img/${plank.image}`;
    }

    // Создать HTML для селектора планок
    renderPlankSelector(containerId) {
        const container = document.getElementById(containerId);
        if (!container || this.planks.length === 0) return;

        container.innerHTML = `
            <div class="plank-selector-container">
                <div class="plank-selector-header">
                    <span class="plank-selector-label" data-i18n="plank.selectPlank">${this.getSelectPlankLabel()}</span>
                </div>
                <div class="plank-selector">
                    <select id="plank-select" class="plank-select">
                        ${this.planks.map(plank => `
                            <option value="${plank.id}" ${plank.id === this.currentPlank.id ? 'selected' : ''}>
                                ${this.getPlankName(plank)}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="plank-preview" id="plank-preview">
                    <div class="plank-image-container" id="plank-image-container">
                        <img src="${this.getPlankImagePath(this.currentPlank)}" 
                             alt="${this.getPlankName(this.currentPlank)}" 
                             class="plank-image"
                             id="plank-image"
                             onerror="this.style.display='none'">
                    </div>
                    <div class="plank-info">
                        <span class="plank-name" id="plank-name">${this.getPlankName(this.currentPlank)}</span>
                        <span class="plank-met">MET: <span id="plank-met-value">${this.currentPlank.met}</span></span>
                    </div>
                </div>
            </div>
        `;

        // Добавляем обработчик изменения селекта
        const select = document.getElementById('plank-select');
        if (select) {
            select.addEventListener('change', (e) => {
                const selectedPlank = this.selectPlank(e.target.value);
                if (selectedPlank) {
                    this.updatePlankPreview(selectedPlank);
                    // Отправляем событие об изменении планки
                    document.dispatchEvent(new CustomEvent('plankChanged', { 
                        detail: { plank: selectedPlank } 
                    }));
                }
            });
        }
    }

    // Получить label для выбора планки
    getSelectPlankLabel() {
        return window.i18n ? window.i18n.translate('plank.selectPlank') : 'Выберите планку:';
    }

    // Обновить превью планки
    updatePlankPreview(plank) {
        const nameEl = document.getElementById('plank-name');
        const metEl = document.getElementById('plank-met-value');
        const imageEl = document.getElementById('plank-image');

        if (nameEl) nameEl.textContent = this.getPlankName(plank);
        if (metEl) metEl.textContent = plank.met;
        if (imageEl) {
            imageEl.src = this.getPlankImagePath(plank);
            imageEl.alt = this.getPlankName(plank);
            imageEl.style.display = 'block';
        }
    }

    // Обновить язык отображения
    updateLanguage() {
        const labelEl = document.querySelector('.plank-selector-label');
        const nameEl = document.getElementById('plank-name');
        const select = document.getElementById('plank-select');

        if (labelEl) {
            labelEl.textContent = this.getSelectPlankLabel();
        }

        if (nameEl && this.currentPlank) {
            nameEl.textContent = this.getPlankName(this.currentPlank);
        }

        if (select) {
            select.innerHTML = this.planks.map(plank => `
                <option value="${plank.id}" ${plank.id === this.currentPlank.id ? 'selected' : ''}>
                    ${this.getPlankName(plank)}
                </option>
            `).join('');
        }
    }
}

// Создаем глобальный экземпляр менеджера планок
window.planksManager = new PlanksManager();
