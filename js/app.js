// LitePlank - Чистый JavaScript PWA приложение
class LitePlank {
constructor() {
this.history = [];
this.settings = {
defaultDuration: 60,
soundEnabled: true,
vibrationEnabled: true,
darkMode: false
};
this.currentSession = {
isRunning: false,
timeLeft: 0,
duration: 60,
timer: null
};
this.audioContext = null;
this.init();
}

showNotification(message, type = 'info') {
const container = document.getElementById('notification-container');
if (!container) return;

const notification = document.createElement('div');
notification.className = `notification notification-${type}`;
notification.innerHTML = `
<div class="notification-content">${message}</div>
<button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
`;
container.appendChild(notification);

// Автоматическое удаление через 3 секунды
setTimeout(() => {
if (notification.parentElement) {
notification.remove();
}
}, 3000);
}

async init() {
// Ждем загрузки i18n с сохраненным языком
const savedLang = window.i18n.getSavedLanguage();
await window.i18n.loadTranslations(savedLang);
window.i18n.applyTranslations();

// Устанавливаем значение селектора языка
this.setupLanguageSelector(savedLang);

this.loadSettings();
this.loadHistory();
this.setupEventListeners();
this.render();
this.setupServiceWorker();

// Скрыть загрузку и показать приложение
document.getElementById('loading').style.display = 'none';
document.getElementById('app').style.display = 'block';
}

setupLanguageSelector(currentLang) {
const languageSelect = document.getElementById('language-select');
if (languageSelect) {
languageSelect.value = currentLang;
languageSelect.addEventListener('change', (e) => {
this.changeLanguage(e.target.value);
});
}
}

changeLanguage(lang) {
window.i18n.setLanguage(lang).then(success => {
if (success) {
// Обновляем значение селектора после загрузки переводов
const languageSelect = document.getElementById('language-select');
if (languageSelect) {
languageSelect.value = lang;
}
// Показываем уведомление
const langNames = {
'ru': window.i18n.translate('language.ru'),
'en': window.i18n.translate('language.en')
};
this.showNotification(
window.i18n.translate('notifications.languageChanged', { lang: langNames[lang] }),
'success'
);
}
});
}

setupEventListeners() {
// Навигация
document.querySelectorAll('.tab-btn').forEach(btn => {
btn.addEventListener('click', (e) => {
this.switchTab(e.target.closest('.tab-btn').dataset.tab);
});
});

// Тема
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
themeToggle.addEventListener('click', () => {
this.toggleTheme();
});
}

// Таймер
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const finishBtn = document.getElementById('finish-btn');
const resetBtn = document.getElementById('reset-btn');
const durationInput = document.getElementById('duration-input');

if (startBtn) startBtn.addEventListener('click', () => this.startTimer());
if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseTimer());
if (finishBtn) finishBtn.addEventListener('click', () => this.finishEarly());
if (resetBtn) resetBtn.addEventListener('click', () => this.resetTimer());
if (durationInput) durationInput.addEventListener('change', (e) => {
this.currentSession.duration = Math.max(0, parseInt(e.target.value) || 0);
this.currentSession.timeLeft = this.currentSession.duration;
this.updateTimerDisplay();
});

// История
const clearHistoryBtn = document.getElementById('clear-history-btn');
if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => this.clearHistory());

// Делегирование событий для истории тренировок
const historyList = document.getElementById('history-list');
if (historyList) {
historyList.addEventListener('click', (e) => {
const deleteBtn = e.target.closest('[data-action="delete-session"]');
if (deleteBtn) {
const historyItem = deleteBtn.closest('.history-item');
if (historyItem) {
const index = parseInt(historyItem.dataset.sessionIndex);
this.deleteSession(index);
}
}
});
}

// Настройки пользовательских параметров
const saveUserSettingsBtn = document.getElementById('save-user-settings-btn');
if (saveUserSettingsBtn) saveUserSettingsBtn.addEventListener('click', () => this.saveUserSettings());

// Настройки
const defaultDuration = document.getElementById('default-duration');
const soundEnabled = document.getElementById('sound-enabled');
const vibrationEnabled = document.getElementById('vibration-enabled');
const exportBtn = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');
const clearAllBtn = document.getElementById('clear-all-btn');
const resetSettingsBtn = document.getElementById('reset-settings-btn');

if (defaultDuration) defaultDuration.addEventListener('change', (e) => {
this.settings.defaultDuration = parseInt(e.target.value);
this.saveSettings();
});
if (soundEnabled) soundEnabled.addEventListener('change', (e) => {
this.settings.soundEnabled = e.target.checked;
this.saveSettings();
});
if (vibrationEnabled) vibrationEnabled.addEventListener('change', (e) => {
this.settings.vibrationEnabled = e.target.checked;
this.saveSettings();
});
if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
if (importInput) importInput.addEventListener('change', (e) => this.importData(e));
if (clearAllBtn) clearAllBtn.addEventListener('click', () => this.clearAllData());
if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', () => this.resetSettings());
}

switchTab(tabName) {
// Обновляем активные табы
document.querySelectorAll('.tab-btn').forEach(btn => {
btn.classList.toggle('active', btn.dataset.tab === tabName);
});

// Показываем нужную секцию
document.querySelectorAll('.section').forEach(section => {
section.classList.toggle('active', section.id === `${tabName}-section`);
});
}

startTimer() {
if (this.currentSession.timeLeft <= 0) {
this.currentSession.timeLeft = this.currentSession.duration;
}
this.currentSession.isRunning = true;
this.updateTimerControls();

// Инициализируем AudioContext при первом взаимодействии пользователя
this.initializeAudioContext();

this.currentSession.timer = setInterval(() => {
if (this.currentSession.timeLeft > 0) {
this.currentSession.timeLeft--;
this.updateTimerDisplay();
} else {
this.completeTimer();
}
}, 1000);
}

initializeAudioContext() {
if (!this.audioContext) {
try {
this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
console.log('[Audio] AudioContext успешно инициализирован');
} catch (e) {
console.error('[Audio] Ошибка инициализации AudioContext:', e);
// Опционально: отключаем звук в настройках при ошибке
this.settings.soundEnabled = false;
this.saveSettings();
this.showNotification(window.i18n.translate('notifications.audioUnavailable'), 'warning');
}
}
}

pauseTimer() {
this.currentSession.isRunning = false;
if (this.currentSession.timer) {
clearInterval(this.currentSession.timer);
this.currentSession.timer = null;
}
this.updateTimerControls();
}

resetTimer() {
this.pauseTimer();
this.currentSession.timeLeft = this.currentSession.duration;
this.updateTimerDisplay();
}

finishEarly() {
this.pauseTimer();
const actualDuration = this.currentSession.duration - this.currentSession.timeLeft;
this.addSession(actualDuration);
this.playSound();
this.vibrate();
}

completeTimer() {
this.pauseTimer();
this.addSession(this.currentSession.duration);
this.playSound();
this.vibrate();
}

addSession(duration) {
const session = {
date: new Date().toISOString(),
duration: duration,
calories: this.calculateCalories(duration)
};
this.history.unshift(session);
this.saveHistory();
this.updateHistory();
}

calculateCalories(seconds) {
const weight = parseFloat(document.getElementById('userWeight')?.value || 70);
// Проверка на валидные числовые значения
if (isNaN(weight) || weight <= 0) {
return 0;
}
// MET для стандартной планки (можно сделать настраиваемым)
const met = 3.5;
const minutes = seconds / 60;
// Стандартная формула: (MET * 3.5 * вес в кг) / 200 * минуты
const caloriesPerMinute = (met * 3.5 * weight) / 200;
return caloriesPerMinute * minutes;
}

playSound() {
if (!this.settings.soundEnabled) return;
try {
// Проверяем наличие AudioContext
if (!this.audioContext) return;
// Проверяем, нужно ли разрешение на воспроизведение звука
if (this.audioContext.state === 'suspended') {
this.audioContext.resume();
}
const oscillator = this.audioContext.createOscillator();
const gainNode = this.audioContext.createGain();
oscillator.connect(gainNode);
gainNode.connect(this.audioContext.destination);
oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
oscillator.start(this.audioContext.currentTime);
oscillator.stop(this.audioContext.currentTime + 0.5);
} catch (e) {
// Игнорируем ошибки аудио
}
}

vibrate() {
if (!this.settings.vibrationEnabled || !navigator.vibrate) return;
navigator.vibrate([100, 50, 100]);
}

updateTimerDisplay() {
const minutes = Math.floor(this.currentSession.timeLeft / 60);
const seconds = this.currentSession.timeLeft % 60;
const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
document.getElementById('timer-display').textContent = timeStr;
}

updateTimerControls() {
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const finishBtn = document.getElementById('finish-btn');

if (this.currentSession.isRunning) {
startBtn.style.display = 'none';
pauseBtn.style.display = 'inline-block';
finishBtn.style.display = 'inline-block';
} else {
startBtn.style.display = 'inline-block';
pauseBtn.style.display = 'none';
finishBtn.style.display = 'none';
}
}

updateHistory() {
const historyList = document.getElementById('history-list');
const emptyState = document.getElementById('empty-state');

if (this.history.length === 0) {
historyList.innerHTML = '';
emptyState.style.display = 'block';
return;
}

emptyState.style.display = 'none';

// Показываем последние 10 тренировок
const recentHistory = this.history.slice(0, 10);
historyList.innerHTML = recentHistory.map((session, index) => `
<div class="history-item" data-session-index="${index}">
<div class="session-info">
<div class="session-date">${this.formatDate(session.date)}</div>
<div class="session-duration">${this.formatTime(session.duration)}</div>
<div class="session-calories">${session.calories.toFixed(1)} ${window.i18n.translate('units.kcal')}</div>
</div>
<div class="session-actions">
<button class="btn-delete" data-action="delete-session" title="${window.i18n.translate('history.deleteSession')}">🗑️</button>
</div>
</div>
`).join('');

// Обновляем статистику
this.updateHistoryStats();
}

updateHistoryStats() {
const totalSessions = this.history.length;
const totalTime = this.history.reduce((sum, session) => sum + session.duration, 0);
const totalCalories = this.history.reduce((sum, session) => sum + session.calories, 0);
const avgTime = totalSessions > 0 ? Math.round(totalTime / totalSessions) : 0;

// Получаем вес пользователя
const userWeight = parseFloat(document.getElementById('userWeight')?.value || 70);

// Проверка на валидные числовые значения
if (isNaN(userWeight) || userWeight <= 0) {
document.getElementById('total-weight').textContent = `0 ${window.i18n.translate('units.kg')}`;
} else {
// Удержано кг = Вес × Количество тренировок
const totalWeight = userWeight * totalSessions;
document.getElementById('total-weight').textContent = `${totalWeight.toFixed(1)} ${window.i18n.translate('units.kg')}`;
}

document.getElementById('total-sessions').textContent = totalSessions;
document.getElementById('total-time').textContent = this.formatTotalTime(totalTime);
document.getElementById('total-calories').textContent = `${totalCalories.toFixed(1)} ${window.i18n.translate('units.kcal')}`;
document.getElementById('avg-time').textContent = this.formatAverageTime(avgTime);
}

deleteSession(index) {
if (confirm(window.i18n.translate('confirmations.deleteSession'))) {
this.history.splice(index, 1);
this.saveHistory();
this.updateHistory();
this.showNotification(window.i18n.translate('notifications.sessionDeleted'), 'success');
}
}

clearHistory() {
if (confirm(window.i18n.translate('confirmations.clearHistory'))) {
this.history = [];
this.saveHistory();
this.updateHistory();
this.showNotification(window.i18n.translate('notifications.historyCleared'), 'success');
}
}

toggleTheme() {
this.settings.darkMode = !this.settings.darkMode;
document.documentElement.setAttribute('data-theme', this.settings.darkMode ? 'dark' : 'light');
document.getElementById('theme-toggle').innerHTML = `<span>${this.settings.darkMode ? '☀️' : '🌙'}</span>`;

// Обновляем title атрибут
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
themeToggle.setAttribute('title', window.i18n.translate(this.settings.darkMode ? 'theme.light' : 'theme.dark'));
}

this.saveSettings();
}

exportData() {
const data = {
history: this.history,
settings: this.settings,
exportDate: new Date().toISOString()
};
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `liteplank-backup-${new Date().toISOString().slice(0, 10)}.json`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
this.showNotification(window.i18n.translate('notifications.dataExported'), 'success');
}

importData(event) {
const file = event.target.files[0];
if (!file) return;

const reader = new FileReader();
reader.onload = (e) => {
try {
const data = JSON.parse(e.target.result);
if (data.history && Array.isArray(data.history)) {
if (confirm(window.i18n.translate('confirmations.importData'))) {
this.history = data.history;
if (data.settings) {
this.settings = data.settings;
this.applySettings();
}
this.saveHistory();
this.saveSettings();
this.render();
this.showNotification(window.i18n.translate('notifications.dataImported'), 'success');
}
} else {
this.showNotification(window.i18n.translate('notifications.invalidFile'), 'error');
}
} catch (error) {
this.showNotification(window.i18n.translate('notifications.fileReadError'), 'error');
}
};
reader.readAsText(file);
event.target.value = '';
}

clearAllData() {
if (confirm(window.i18n.translate('confirmations.clearAllData'))) {
this.history = [];
this.resetSettings();
this.saveHistory();
this.render();
this.showNotification(window.i18n.translate('notifications.allDataCleared'), 'success');
}
}

resetSettings() {
this.settings = {
defaultDuration: 60,
soundEnabled: true,
vibrationEnabled: true,
darkMode: false
};
this.applySettings();
this.saveSettings();
this.showNotification(window.i18n.translate('notifications.settingsReset'), 'success');
}

applySettings() {
const defaultDurationEl = document.getElementById('default-duration');
const soundEnabledEl = document.getElementById('sound-enabled');
const vibrationEnabledEl = document.getElementById('vibration-enabled');
const themeToggleEl = document.getElementById('theme-toggle');

if (defaultDurationEl) defaultDurationEl.value = this.settings.defaultDuration;
if (soundEnabledEl) soundEnabledEl.checked = this.settings.soundEnabled;
if (vibrationEnabledEl) vibrationEnabledEl.checked = this.settings.vibrationEnabled;
document.documentElement.setAttribute('data-theme', this.settings.darkMode ? 'dark' : 'light');
if (themeToggleEl) {
themeToggleEl.innerHTML = `<span>${this.settings.darkMode ? '☀️' : '🌙'}</span>`;
themeToggleEl.setAttribute('title', window.i18n.translate(this.settings.darkMode ? 'theme.light' : 'theme.dark'));
}
}

saveSettings() {
localStorage.setItem('liteplank-settings', JSON.stringify(this.settings));
}

loadSettings() {
const saved = localStorage.getItem('liteplank-settings');
if (saved) {
this.settings = JSON.parse(saved);
this.applySettings();
}
// Загружаем пользовательские параметры
this.loadUserSettings();
}

saveUserSettings() {
const userSettings = {
gender: document.getElementById('userGender')?.value || 'male',
weight: parseFloat(document.getElementById('userWeight')?.value || 70),
height: parseFloat(document.getElementById('userHeight')?.value || 175),
age: parseInt(document.getElementById('userAge')?.value || 30)
};

// Проверка на валидные числовые значения
if (isNaN(userSettings.weight) || isNaN(userSettings.height) || isNaN(userSettings.age) ||
userSettings.weight <= 0 || userSettings.height <= 0 || userSettings.age <= 0) {
this.showNotification(window.i18n.translate('notifications.invalidInput'), 'error');
return;
}

// Загружаем предыдущие настройки для сравнения
const previousSettings = JSON.parse(localStorage.getItem('liteplank-user-settings') || '{}');
// Проверяем, изменился ли вес (только вес влияет на расчет калорий)
const weightChanged = previousSettings.weight !== userSettings.weight;

localStorage.setItem('liteplank-user-settings', JSON.stringify(userSettings));
this.showNotification(window.i18n.translate('notifications.userSettingsSaved'), 'success');

// Пересчитываем историю только если изменился вес
if (weightChanged) {
this.recalculateHistory();
}
}

loadUserSettings() {
const saved = localStorage.getItem('liteplank-user-settings');
if (saved) {
const userSettings = JSON.parse(saved);
const genderEl = document.getElementById('userGender');
const weightEl = document.getElementById('userWeight');
const heightEl = document.getElementById('userHeight');
const ageEl = document.getElementById('userAge');

if (genderEl) genderEl.value = userSettings.gender || 'male';
if (weightEl) weightEl.value = userSettings.weight || 70;
if (heightEl) heightEl.value = userSettings.height || 175;
if (ageEl) ageEl.value = userSettings.age || 30;
}
}

saveHistory() {
localStorage.setItem('liteplank-history', JSON.stringify(this.history));
}

loadHistory() {
const saved = localStorage.getItem('liteplank-history');
if (saved) {
this.history = JSON.parse(saved);
}
}

recalculateHistory() {
// Проверяем корректность веса перед пересчетом
const weight = parseFloat(document.getElementById('userWeight')?.value || 70);
if (isNaN(weight) || weight <= 0) {
return;
}

// Пересчитываем калории для всех тренировок с новыми параметрами
this.history.forEach(session => {
session.calories = this.calculateCalories(session.duration);
});

// Сохраняем обновленную историю
this.saveHistory();
// Обновляем отображение
this.updateHistory();
}

render() {
this.currentSession.duration = this.settings.defaultDuration;
this.currentSession.timeLeft = this.currentSession.duration;
this.updateTimerDisplay();
this.updateTimerControls();
this.updateHistory();
}

formatTime(seconds) {
const secondsText = window.i18n.translate('time.seconds');
const minutesText = window.i18n.translate('time.minutes');

if (seconds < 60) return `${seconds} ${secondsText}`;
const mins = Math.floor(seconds / 60);
const secs = seconds % 60;
return `${mins} ${minutesText} ${secs} ${secondsText}`;
}

formatTotalTime(seconds) {
const secondsText = window.i18n.translate('time.seconds');
const minutesText = window.i18n.translate('time.minutes');

if (seconds < 60) return `${seconds} ${secondsText}`;
const mins = Math.floor(seconds / 60);
const secs = seconds % 60;
return `${mins} ${minutesText} ${secs} ${secondsText}`;
}

formatAverageTime(seconds) {
const secondsText = window.i18n.translate('time.seconds');
const minutesText = window.i18n.translate('time.minutes');

if (seconds < 60) return `${Math.round(seconds)} ${secondsText}`;
const mins = Math.floor(seconds / 60);
const secs = Math.round(seconds % 60);
return `${mins} ${minutesText} ${secs} ${secondsText}`;
}

formatDate(dateString) {
const date = new Date(dateString);
const currentLang = window.i18n.getCurrentLang();
const locale = currentLang === 'en' ? 'en-US' : 'ru-RU';
return date.toLocaleDateString(locale, {
year: 'numeric',
month: 'long',
day: 'numeric',
hour: '2-digit',
minute: '2-digit'
});
}

async setupServiceWorker() {
if ('serviceWorker' in navigator) {
try {
const registration = await navigator.serviceWorker.register('/liteplank/service-worker.js');
console.log('SW registered');

// Сохраняем ссылку на нового воркера
let newWorker = null;

// Стандартный механизм обнаружения обновлений
registration.addEventListener('updatefound', () => {
newWorker = registration.installing;
newWorker.addEventListener('statechange', () => {
if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
// Доступно обновление
this.handleUpdateAvailable(newWorker);
}
});
});

// Проверка активного сервис-воркера на наличие обновлений
if (registration.waiting) {
this.handleUpdateAvailable(registration.waiting);
}

// Автоматическая перезагрузка после активации нового воркера
const reloadHandler = () => {
navigator.serviceWorker.removeEventListener('controllerchange', reloadHandler);
window.location.reload();
};
navigator.serviceWorker.addEventListener('controllerchange', reloadHandler);
} catch (error) {
console.log('SW registration failed:', error);
}
}
}

handleUpdateAvailable(worker) {
// Защита от вызова без параметра
if (!worker) {
console.warn('handleUpdateAvailable вызван без параметра worker');
return;
}

console.log('Service Worker сообщает об обновлении');
this.showNotification(window.i18n.translate('notifications.updateAvailable'), 'info');

// Запрашиваем подтверждение пользователя перед перезагрузкой
if (confirm(window.i18n.translate('confirmations.updateApp'))) {
// Активируем нового сервис-воркера
worker.postMessage({ type: 'SKIP_WAITING' });
// Перезагрузка произойдёт автоматически через controllerchange
}
}
}

// Инициализация приложения
const litePlank = new LitePlank();