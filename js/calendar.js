// LitePlank - Calendar Module
class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.selectedDate = null;
        this.history = [];
        this.container = null;
        this.monthNames = {
            'ru': ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
            'en': ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
        };
        this.dayNames = {
            'ru': ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
            'en': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        };
    }

    init(history) {
        this.history = history || [];
        this.container = document.getElementById('calendar-container');
        this.render();
    }

    setHistory(history) {
        this.history = history || [];
    }

    getLocale() {
        return window.i18n ? window.i18n.getCurrentLang() : 'ru';
    }

    translate(key, params = {}) {
        return window.i18n ? window.i18n.translate(key, params) : key;
    }

    render() {
        if (!this.container) return;
        
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        this.container.innerHTML = `
            <div class="calendar-header">
                <button class="calendar-nav-btn" id="prev-month" title="${this.translate('calendar.prevMonth')}">◀</button>
                <h3 class="calendar-title">${this.monthNames[this.getLocale()][month]} ${year}</h3>
                <button class="calendar-nav-btn" id="next-month" title="${this.translate('calendar.nextMonth')}">▶</button>
            </div>
            <div class="calendar-grid">
                ${this.renderDayHeaders()}
                ${this.renderDays(year, month)}
            </div>
            <div class="calendar-month-stats">
                ${this.renderMonthStats(year, month)}
            </div>
            <div class="calendar-day-details" id="calendar-day-details">
                <p class="calendar-hint">${this.translate('calendar.selectDayHint')}</p>
            </div>
        `;

        this.setupEventListeners();
    }

    renderDayHeaders() {
        const days = this.dayNames[this.getLocale()];
        return days.map(day => `<div class="calendar-day-header">${day}</div>`).join('');
    }

    renderDays(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = (firstDay.getDay() + 6) % 7; // Понедельник = 0
        const totalDays = lastDay.getDate();
        
        let html = '';
        
        // Пустые ячейки до первого дня месяца
        for (let i = 0; i < startDay; i++) {
            html += '<div class="calendar-day empty"></div>';
        }
        
        // Дни месяца
        for (let day = 1; day <= totalDays; day++) {
            const dateStr = this.formatDateKey(year, month, day);
            const sessions = this.getSessionsByDate(dateStr);
            const hasSessions = sessions.length > 0;
            const isToday = this.isToday(year, month, day);
            const isSelected = this.selectedDate === dateStr;
            
            let classes = 'calendar-day';
            if (hasSessions) classes += ' has-sessions';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';
            
            html += `
                <div class="${classes}" data-date="${dateStr}">
                    <span class="day-number">${day}</span>
                    ${hasSessions ? `<span class="session-indicator"></span>` : ''}
                </div>
            `;
        }
        
        return html;
    }

    renderMonthStats(year, month) {
        const stats = this.getMonthStats(year, month);
        
        return `
            <h4 class="stats-title">${this.translate('calendar.monthStats')}</h4>
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-value">${stats.totalSessions}</span>
                    <span class="stat-label">${this.translate('calendar.sessionsCount')}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${this.formatDuration(stats.totalTime)}</span>
                    <span class="stat-label">${this.translate('calendar.totalTime')}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${stats.totalCalories.toFixed(1)} ${this.translate('units.kcal')}</span>
                    <span class="stat-label">${this.translate('calendar.caloriesBurned')}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${this.formatDuration(stats.avgTime)}</span>
                    <span class="stat-label">${this.translate('calendar.avgDuration')}</span>
                </div>
            </div>
        `;
    }

    renderDayDetails(dateStr) {
        const detailsContainer = document.getElementById('calendar-day-details');
        if (!detailsContainer) return;
        
        const sessions = this.getSessionsByDate(dateStr);
        
        if (sessions.length === 0) {
            detailsContainer.innerHTML = `
                <p class="no-sessions">${this.translate('calendar.noSessionsOnDay')}</p>
            `;
            return;
        }
        
        const date = new Date(dateStr);
        const locale = this.getLocale() === 'en' ? 'en-US' : 'ru-RU';
        const formattedDate = date.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Подсчет итогов за день
        const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
        const totalCalories = sessions.reduce((sum, s) => sum + s.calories, 0);
        
        let html = `
            <h4 class="day-details-title">📅 ${formattedDate}</h4>
            <div class="sessions-list">
        `;
        
        sessions.forEach((session, index) => {
            const plankName = session.plankId ? this.translate(`plank.${session.plankId}`) : this.translate('calendar.unknownPlank');
            const time = new Date(session.date).toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <div class="session-item">
                    <div class="session-header">
                        <span class="session-plank-name">⏱️ ${plankName}</span>
                        <span class="session-time">${time}</span>
                    </div>
                    <div class="session-details">
                        <span class="session-duration">${this.formatDuration(session.duration)}</span>
                        <span class="session-calories">${session.calories.toFixed(1)} ${this.translate('units.kcal')}</span>
                    </div>
                </div>
            `;
        });
        
        html += `
            </div>
            <div class="day-total">
                <span>${this.translate('calendar.dayTotal')}:</span>
                <span>${sessions.length} ${this.translate('calendar.trainings')}, ${this.formatDuration(totalDuration)}, ${totalCalories.toFixed(1)} ${this.translate('units.kcal')}</span>
            </div>
        `;
        
        detailsContainer.innerHTML = html;
    }

    setupEventListeners() {
        // Навигация по месяцам
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigateMonth(-1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigateMonth(1));
        }
        
        // Выбор дня
        this.container.querySelectorAll('.calendar-day:not(.empty)').forEach(day => {
            day.addEventListener('click', () => {
                const dateStr = day.dataset.date;
                this.selectDate(dateStr);
            });
        });
    }

    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.selectedDate = null;
        this.render();
    }

    selectDate(dateStr) {
        this.selectedDate = dateStr;
        
        // Обновляем визуальное выделение
        this.container.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
            if (day.dataset.date === dateStr) {
                day.classList.add('selected');
            }
        });
        
        // Показываем детали дня
        this.renderDayDetails(dateStr);
    }

    getSessionsByDate(dateStr) {
        return this.history.filter(session => {
            const sessionDate = new Date(session.date);
            const sessionDateStr = this.formatDateKey(
                sessionDate.getFullYear(),
                sessionDate.getMonth(),
                sessionDate.getDate()
            );
            return sessionDateStr === dateStr;
        });
    }

    getMonthStats(year, month) {
        const monthSessions = this.history.filter(session => {
            const sessionDate = new Date(session.date);
            return sessionDate.getFullYear() === year && sessionDate.getMonth() === month;
        });
        
        const totalSessions = monthSessions.length;
        const totalTime = monthSessions.reduce((sum, s) => sum + s.duration, 0);
        const totalCalories = monthSessions.reduce((sum, s) => sum + s.calories, 0);
        const avgTime = totalSessions > 0 ? Math.round(totalTime / totalSessions) : 0;
        
        return { totalSessions, totalTime, totalCalories, avgTime };
    }

    formatDateKey(year, month, day) {
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${year}-${m}-${d}`;
    }

    isToday(year, month, day) {
        const today = new Date();
        return today.getFullYear() === year && 
               today.getMonth() === month && 
               today.getDate() === day;
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) {
            return `${secs} ${this.translate('time.seconds')}`;
        }
        return `${mins} ${this.translate('time.minutes')} ${secs} ${this.translate('time.seconds')}`;
    }

    // Метод для обновления при изменении истории
    update() {
        this.render();
        if (this.selectedDate) {
            this.renderDayDetails(this.selectedDate);
        }
    }

    // Метод для обновления при смене языка
    updateLanguage() {
        this.render();
        if (this.selectedDate) {
            this.renderDayDetails(this.selectedDate);
        }
    }
}

// Создаем глобальный экземпляр
window.calendar = new Calendar();
