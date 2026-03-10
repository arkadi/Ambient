'use strict';

// === CONFIGURATION ===
const CONFIG = {
    API_BASE: '/kiosk/api',
    REFRESH_WEATHER: 30 * 60 * 1000,
    REFRESH_FORECAST: 3 * 60 * 60 * 1000,
    REFRESH_TRAFFIC: 10 * 60 * 1000,
    CLOCK_INTERVAL: 1000,
    TIMEZONE: 'Asia/Tbilisi',
    locale: (typeof window !== 'undefined' && window.__LOCALE__) ? window.__LOCALE__ : 'en',
    strings: (typeof window !== 'undefined' && window.__L10N__) ? window.__L10N__ : {},
    TRAFFIC_THRESHOLDS_DEFAULT: { green: 20, yellow: 40, red: 60 },
    traffic_thresholds: null,
};

function t(key) {
    return (CONFIG.strings && CONFIG.strings[key]) || key;
}

function localeForIntl() {
    return CONFIG.locale === 'ka' ? 'ka-GE' : 'en-GB';
}

/** Add random query parameter to URL to bypass browser cache */
function apiUrlWithCacheBust(url) {
    const sep = url.includes('?') ? '&' : '?';
    return url + sep + 'rnd=' + Date.now();
}

// === WMO WEATHER CODES → icon ===
const WEATHER_CODES = {
    0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
    51: '🌦️', 53: '🌦️', 55: '🌧️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
    66: '🌨️', 67: '🌨️', 71: '🌨️', 73: '❄️', 75: '❄️', 77: '❄️',
    80: '🌧️', 81: '🌧️', 82: '⛈️', 85: '🌨️', 86: '❄️',
    95: '⛈️', 96: '⛈️', 99: '⛈️',
};

function getWeatherIcon(code, isNight) {
    const icon = WEATHER_CODES[code] || WEATHER_CODES[0];
    if (code === 0 && isNight) return '🌙';
    return icon;
}

function degreesToDirection(deg) {
    const index = Math.round(deg / 45) % 8;
    return t('wind_' + index);
}

// === CLOCK ===
function updateClock() {
    const timeEl = document.getElementById('time');
    const dateEl = document.getElementById('date');
    if (!timeEl || !dateEl) return;

    const now = new Date();
    const loc = localeForIntl();
    const hmStr = now.toLocaleTimeString(loc, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: CONFIG.TIMEZONE,
    });
    const fullTimeStr = now.toLocaleTimeString('en-CA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: CONFIG.TIMEZONE,
    });
    const parts = fullTimeStr.split(':');
    const secStr = (parts[2] != null && parts[2].length >= 2) ? parts[2] : '00';
    const dateStr = now.toLocaleDateString(loc, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: CONFIG.TIMEZONE,
    });

    const hmEl = document.getElementById('time-hm');
    const secEl = document.getElementById('time-sec');
    if (hmEl) hmEl.textContent = hmStr;
    if (secEl) secEl.textContent = secStr;
    dateEl.textContent = dateStr;

    // Night mode: 23:00–06:00
    const hour = now.getHours();
    const nightMode = hour >= 23 || hour < 6;
    document.body.classList.toggle('night-mode', nightMode);
}

// === Smooth block update (fade out → update → fade in) ===
function fadeUpdate(element, updateFn) {
    if (!element) return;
    element.classList.add('fade-out');
    setTimeout(function () {
        updateFn();
        element.classList.remove('fade-out');
    }, 300);
}

// === WEATHER: fetch and render ===
async function fetchWeather() {
    try {
        const res = await fetch(apiUrlWithCacheBust(CONFIG.API_BASE + '/weather.php'));
        const data = await res.json();
        if (data.success) {
            hideErrorIndicator();
            renderWeather(data);
            renderForecast(data);
        }
    } catch (_e) {
        showErrorIndicator();
    }
}

function formatSunTime(isoStr) {
    if (!isoStr || typeof isoStr !== 'string') return '--:--';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString(localeForIntl(), { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: CONFIG.TIMEZONE });
}

function formatAirQuality(aqi) {
    if (aqi == null || aqi < 0) return '--';
    var label = '';
    if (aqi <= 50) label = t('aqi_good');
    else if (aqi <= 100) label = t('aqi_moderate');
    else if (aqi <= 150) label = t('aqi_sensitive');
    else if (aqi <= 200) label = t('aqi_unhealthy');
    else if (aqi <= 300) label = t('aqi_very_unhealthy');
    else label = t('aqi_hazardous');
    return aqi + ' (' + label + ')';
}

function renderWeather(data) {
    const current = data.current || {};
    const daily = data.daily || {};
    const temp = current.temperature_2m;
    // Feels like: from API (apparent_temperature); if missing — show actual temperature
    const feels = current.apparent_temperature != null ? current.apparent_temperature : current.temperature_2m;
    const humidity = current.relative_humidity_2m;
    const windSpeed = current.wind_speed_10m;
    const windDir = current.wind_direction_10m;
    const code = current.weather_code != null ? current.weather_code : 0;
    const sunriseStr = (daily.sunrise && daily.sunrise[0]) ? daily.sunrise[0] : null;
    const sunsetStr = (daily.sunset && daily.sunset[0]) ? daily.sunset[0] : null;
    const usAqi = current.us_aqi != null ? current.us_aqi : null;

    const now = new Date();
    const hour = now.getHours();
    const isNight = hour >= 20 || hour < 6;

    const tempEl = document.getElementById('temperature');
    const feelsEl = document.getElementById('feels-like');
    const humidityEl = document.getElementById('humidity');
    const windSpeedEl = document.getElementById('wind-speed');
    const windDirEl = document.getElementById('wind-direction');
    const iconEl = document.getElementById('weather-icon');
    const airQualityEl = document.getElementById('air-quality');
    const sunriseEl = document.getElementById('sunrise');
    const sunsetEl = document.getElementById('sunset');

    function apply() {
        if (tempEl) tempEl.textContent = temp != null ? Math.round(temp) : '--';
        if (feelsEl) feelsEl.textContent = feels != null ? Math.round(feels) : '--';
        if (humidityEl) humidityEl.textContent = humidity != null ? humidity : '--';
        if (windSpeedEl) windSpeedEl.textContent = windSpeed != null ? windSpeed.toFixed(1) : '--';
        if (windDirEl) windDirEl.textContent = windDir != null ? degreesToDirection(windDir) : '--';
        if (iconEl) iconEl.textContent = getWeatherIcon(code, isNight);
        if (airQualityEl) airQualityEl.textContent = formatAirQuality(usAqi);
        if (sunriseEl) sunriseEl.textContent = formatSunTime(sunriseStr);
        if (sunsetEl) sunsetEl.textContent = formatSunTime(sunsetStr);
    }

    const section = document.getElementById('weather-section');
    if (section) {
        fadeUpdate(section, apply);
    } else {
        apply();
    }
}

function renderForecast(data) {
    const daily = data.daily || {};
    const times = daily.time || [];
    const codes = daily.weather_code || [];
    const maxT = daily.temperature_2m_max || [];
    const minT = daily.temperature_2m_min || [];

    const container = document.getElementById('forecast-section');
    if (!container) return;

    const dayNames = new Intl.DateTimeFormat(localeForIntl(), { weekday: 'short', timeZone: CONFIG.TIMEZONE });

    container.innerHTML = '';
    const count = Math.min(5, times.length);
    for (let i = 0; i < count; i++) {
        const date = new Date(times[i] + 'T12:00:00');
        const dayName = dayNames.format(date);
        const code = codes[i] != null ? codes[i] : 0;
        const max = maxT[i] != null ? Math.round(maxT[i]) : '--';
        const min = minT[i] != null ? Math.round(minT[i]) : '--';

        const card = document.createElement('div');
        card.className = 'forecast-day';
        card.innerHTML =
            '<span class="day-name">' + dayName + '</span>' +
            '<span class="day-icon">' + getWeatherIcon(code, false) + '</span>' +
            '<span class="day-temp">' + max + '<span class="unit">°</span>/' + min + '<span class="unit">°</span></span>';
        container.appendChild(card);
    }
}

// === TRAFFIC ===
async function fetchTraffic() {
    try {
        const res = await fetch(apiUrlWithCacheBust(CONFIG.API_BASE + '/traffic.php'));
        const data = await res.json();
        if (data.success) {
            hideErrorIndicator();
            renderTraffic(data);
        }
    } catch (_e) {
        showErrorIndicator();
    }
}

function renderTraffic(data) {
    const offHours = data.off_hours === true;
    const routes = data.routes || {};
    // Thresholds (green/yellow/red) come from traffic API per route
    if (routes && typeof routes === 'object') {
        Object.keys(routes).forEach(function (key) {
            const r = routes[key];
            if (r && r.thresholds && typeof r.thresholds === 'object') {
                if (!CONFIG.traffic_thresholds) CONFIG.traffic_thresholds = {};
                CONFIG.traffic_thresholds[key] = r.thresholds;
            }
        });
    }
    const sectionEl = document.getElementById('traffic-section');
    const dashboardEl = document.getElementById('dashboard');

    function setRoute(key, label, timeStr, colorClass) {
        const labelEl = document.getElementById('route-' + key + '-label');
        const timeEl = document.getElementById('route-' + key + '-time');
        const indEl = document.getElementById('route-' + key + '-indicator');
        if (labelEl) labelEl.textContent = (label != null && label !== '') ? label : '—';
        if (timeEl) timeEl.textContent = timeStr;
        if (indEl) {
            indEl.className = 'route-indicator ' + (colorClass || '');
            indEl.classList.toggle('hidden', !colorClass);
        }
    }

    if (offHours) {
        if (sectionEl) sectionEl.classList.add('hidden');
        if (dashboardEl) dashboardEl.classList.add('traffic-hidden');
        return;
    }

    if (sectionEl) sectionEl.classList.remove('hidden');
    if (dashboardEl) dashboardEl.classList.remove('traffic-hidden');

    const toHome = data.traffic_direction === 'to_home';
    const hintEl = document.getElementById('traffic-direction-hint');
    if (hintEl) {
        hintEl.classList.toggle('hidden', !toHome);
    }
    if (sectionEl) {
        sectionEl.classList.toggle('traffic-to-home', toHome);
    }
    const dirIcon = toHome ? '🏠' : '🚗';
    const iconMe = document.getElementById('route-me-icon');
    const iconWife = document.getElementById('route-wife-icon');
    if (iconMe) iconMe.textContent = dirIcon;
    if (iconWife) iconWife.textContent = dirIcon;

    const defaultTh = CONFIG.TRAFFIC_THRESHOLDS_DEFAULT;
    function getThresholds(routeKey) {
        const t = CONFIG.traffic_thresholds?.[routeKey];
        return (t && typeof t.green === 'number' && typeof t.yellow === 'number' && typeof t.red === 'number')
            ? t
            : defaultTh;
    }

    // First two routes from API map to left/right display slots (DOM ids)
    const routeKeys = Object.keys(routes);
    const slots = ['me', 'wife'];
    for (let i = 0; i < slots.length; i++) {
        const slotId = slots[i];
        const key = routeKeys[i];
        const r = key ? routes[key] : null;
        let timeStr = '—';
        let colorClass = '';
        if (r && r.travel_time_min != null) {
            timeStr = r.travel_time_min + t('minutes_short');
            const th = getThresholds(key);
            if (r.travel_time_min < th.green) colorClass = 'traffic-green';
            else if (r.travel_time_min <= th.yellow) colorClass = 'traffic-yellow';
            else colorClass = 'traffic-red';
        }
        setRoute(slotId, r ? r.label : null, timeStr, colorClass);
    }
}

// === Network error indicator ===
function showErrorIndicator() {
    const el = document.getElementById('error-indicator');
    if (el) el.classList.remove('hidden');
}

function hideErrorIndicator() {
    const el = document.getElementById('error-indicator');
    if (el) el.classList.add('hidden');
}

// === Background: array of images from config, crossfade (single — no rotation, multiple — rotate by interval) ===
var backgroundImageTimerId = null;

function applyBackground(data) {
    const layer = document.getElementById('background-layer');
    const slide0 = document.getElementById('bg-slide-0');
    const slide1 = document.getElementById('bg-slide-1');
    if (!layer || !slide0 || !slide1) return;

    if (backgroundImageTimerId) {
        clearTimeout(backgroundImageTimerId);
        backgroundImageTimerId = null;
    }
    slide0.style.backgroundImage = '';
    slide1.style.backgroundImage = '';
    slide0.classList.remove('active');
    slide1.classList.remove('active');
    const existingIframe = layer.querySelector('iframe');
    if (existingIframe) existingIframe.remove();

    const images = (data && Array.isArray(data.background_image)) ? data.background_image : [];
    const list = images.filter(function (item) { return item && item.url && typeof item.url === 'string'; });

    if (list.length === 0) return;

    function setSlideBg(el, url) {
        el.style.backgroundImage = 'url("' + String(url).trim().replace(/"/g, '%22') + '")';
    }

    if (list.length === 1) {
        setSlideBg(slide0, list[0].url);
        slide0.classList.add('active');
        return;
    }

    var imgIndex = 0;
    var activeSlide = 0;
    var defaultInterval = 10;
    var slides = [slide0, slide1];

    setSlideBg(slides[0], list[0].url);
    slides[0].classList.add('active');

    function next() {
        imgIndex = (imgIndex + 1) % list.length;
        var nextSlide = 1 - activeSlide;
        setSlideBg(slides[nextSlide], list[imgIndex].url);
        slides[nextSlide].classList.add('active');
        slides[activeSlide].classList.remove('active');
        activeSlide = nextSlide;

        var sec = (list[imgIndex].interval > 0) ? list[imgIndex].interval : defaultInterval;
        backgroundImageTimerId = setTimeout(function () {
            backgroundImageTimerId = null;
            next();
        }, sec * 1000);
    }

    var firstInterval = (list[0].interval > 0) ? list[0].interval : defaultInterval;
    backgroundImageTimerId = setTimeout(function () {
        backgroundImageTimerId = null;
        next();
    }, firstInterval * 1000);
}

async function fetchSettings() {
    try {
        const res = await fetch(apiUrlWithCacheBust(CONFIG.API_BASE + '/settings.php'));
        const data = await res.json();
        if (data && data.success) {
            if (data.locale && (data.locale === 'en' || data.locale === 'ka')) {
                CONFIG.locale = data.locale;
            }
            if (data.strings && typeof data.strings === 'object') {
                CONFIG.strings = data.strings;
            }
            applyBackground(data);
        }
    } catch (_e) {
        // background remains default
    }
}

// === WAKE LOCK (screen stays on in Safari fullscreen) ===
let wakeLockSentinel = null;

async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', function () {
            wakeLockSentinel = null;
        });
    } catch (err) {
        console.warn('Wake Lock:', err.message || err);
    }
}

document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
        requestWakeLock();
    }
});

// === INITIALIZATION ===
function init() {
    updateClock();
    setInterval(updateClock, CONFIG.CLOCK_INTERVAL);

    requestWakeLock();

    fetchSettings().then(function () {
        Promise.all([fetchWeather(), fetchTraffic()]).catch(function () {
            showErrorIndicator();
        });
        setInterval(fetchWeather, CONFIG.REFRESH_WEATHER);
        setInterval(fetchTraffic, CONFIG.REFRESH_TRAFFIC);
    });
}

document.addEventListener('DOMContentLoaded', init);
