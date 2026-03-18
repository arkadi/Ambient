'use strict';

// === CONFIGURATION ===
const CONFIG = {
    API_BASE: '/kiosk/api',
    REFRESH_WEATHER: 30 * 60 * 1000,
    REFRESH_FORECAST: 3 * 60 * 60 * 1000,
    REFRESH_TRAFFIC: 10 * 60 * 1000,
    CLOCK_INTERVAL: 1000,
    TIMEZONE: 'Asia/Tbilisi',
    OVERLAY_COUNTDOWN: 10,
    locale: (typeof window !== 'undefined' && window.__LOCALE__) ? window.__LOCALE__ : 'en',
    strings: (typeof window !== 'undefined' && window.__L10N__) ? window.__L10N__ : {},
    TRAFFIC_THRESHOLDS_DEFAULT: { green: 20, yellow: 40, red: 60 },
    traffic_thresholds: null,
};

var lastWeatherData = null;
var lastTrafficData = null;
var activeOverlay = null;
var overlayCountdown = 0;
var overlayCountdownTimerId = null;

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
            lastWeatherData = data;
            renderWeather(data);
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
    const temp = current.temperature_2m;
    const feels = current.apparent_temperature != null ? current.apparent_temperature : current.temperature_2m;
    const code = current.weather_code != null ? current.weather_code : 0;
    const now = new Date();
    const isNight = now.getHours() >= 20 || now.getHours() < 6;

    const tempEl = document.getElementById('temperature');
    const feelsEl = document.getElementById('feels-like');
    const iconEl = document.getElementById('weather-icon');

    function apply() {
        if (tempEl) tempEl.textContent = temp != null ? Math.round(temp) : '--';
        if (feelsEl) feelsEl.textContent = feels != null ? Math.round(feels) : '--';
        if (iconEl) iconEl.textContent = getWeatherIcon(code, isNight);
    }

    const section = document.getElementById('weather-section');
    if (section) {
        fadeUpdate(section, apply);
    } else {
        apply();
    }
}

function renderForecastOverlay(container) {
    if (!container || !lastWeatherData) return;
    const daily = lastWeatherData.daily || {};
    const times = daily.time || [];
    const codes = daily.weather_code || [];
    const maxT = daily.temperature_2m_max || [];
    const minT = daily.temperature_2m_min || [];
    const dayNames = new Intl.DateTimeFormat(localeForIntl(), { weekday: 'short', timeZone: CONFIG.TIMEZONE });

    var html = '';
    const count = Math.min(5, times.length);
    for (let i = 0; i < count; i++) {
        const date = new Date(times[i] + 'T12:00:00');
        const dayName = dayNames.format(date);
        const code = codes[i] != null ? codes[i] : 0;
        const max = maxT[i] != null ? Math.round(maxT[i]) : '--';
        const min = minT[i] != null ? Math.round(minT[i]) : '--';
        html +=
            '<div class="forecast-day">' +
            '<span class="day-name">' + dayName + '</span>' +
            '<span class="day-icon">' + getWeatherIcon(code, false) + '</span>' +
            '<span class="day-temp">' + max + '<span class="unit">°</span>/' + min + '<span class="unit">°</span></span>' +
            '</div>';
    }
    container.innerHTML = '<div class="overlay-forecast-grid">' + html + '</div>';
}

// === TRAFFIC ===
async function fetchTraffic() {
    try {
        const res = await fetch(apiUrlWithCacheBust(CONFIG.API_BASE + '/traffic.php'));
        const data = await res.json();
        if (data.success) {
            hideErrorIndicator();
            lastTrafficData = data;
        }
    } catch (_e) {
        showErrorIndicator();
    }
}

function getTrafficThresholds(routeKey) {
    const defaultTh = CONFIG.TRAFFIC_THRESHOLDS_DEFAULT;
    const th = CONFIG.traffic_thresholds?.[routeKey];
    return (th && typeof th.green === 'number' && typeof th.yellow === 'number' && typeof th.red === 'number')
        ? th
        : defaultTh;
}

function renderTrafficOverlay(container) {
    if (!container) return;
    if (!lastTrafficData) {
        container.innerHTML = '';
        return;
    }
    const offHours = lastTrafficData.off_hours === true;
    const routes = lastTrafficData.routes || {};
    if (routes && typeof routes === 'object') {
        Object.keys(routes).forEach(function (key) {
            const r = routes[key];
            if (r && r.thresholds && typeof r.thresholds === 'object') {
                if (!CONFIG.traffic_thresholds) CONFIG.traffic_thresholds = {};
                CONFIG.traffic_thresholds[key] = r.thresholds;
            }
        });
    }
    if (offHours) {
        container.innerHTML = '<div class="overlay-traffic-off-hours">' + t('traffic_off_hours') + '</div>';
        return;
    }
    const routeKeys = Object.keys(routes);
    var html = '<div class="overlay-traffic-list">';
    routeKeys.forEach(function (key) {
        const r = routes[key];
        let timeStr = '—';
        let colorClass = '';
        if (r && r.travel_time_min != null) {
            timeStr = r.travel_time_min + t('minutes_short');
            const th = getTrafficThresholds(key);
            if (r.travel_time_min < th.green) colorClass = 'traffic-green';
            else if (r.travel_time_min <= th.yellow) colorClass = 'traffic-yellow';
            else colorClass = 'traffic-red';
        }
        const label = (r && r.label) ? r.label : '—';
        html +=
            '<div class="overlay-traffic-card">' +
            '<div class="overlay-traffic-left">' +
            '<span style="font-size:36px">🚗</span>' +
            '<div><div class="overlay-traffic-name">' + label + '</div></div>' +
            '</div>' +
            '<div class="overlay-traffic-right">' +
            '<div class="overlay-traffic-duration ' + colorClass + '">' + timeStr + '</div>' +
            '</div></div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

// === OVERLAY (popups) ===
function renderDetailOverlay(container) {
    if (!container || !lastWeatherData) return;
    const current = lastWeatherData.current || {};
    const daily = lastWeatherData.daily || {};
    const temp = current.temperature_2m;
    const feels = current.apparent_temperature != null ? current.apparent_temperature : current.temperature_2m;
    const humidity = current.relative_humidity_2m;
    const windSpeed = current.wind_speed_10m;
    const windDir = current.wind_direction_10m;
    const usAqi = current.us_aqi != null ? current.us_aqi : null;
    const sunriseStr = (daily.sunrise && daily.sunrise[0]) ? daily.sunrise[0] : null;
    const sunsetStr = (daily.sunset && daily.sunset[0]) ? daily.sunset[0] : null;
    const windStr = (windSpeed != null && windDir != null)
        ? (windSpeed.toFixed(1) + t('wind_unit') + ' ' + degreesToDirection(windDir))
        : '--';

    var items = [
        { icon: '🌡️', label: t('temperature'), value: (temp != null ? Math.round(temp) : '--') + '°C' },
        { icon: '🤔', label: t('feels_like'), value: (feels != null ? Math.round(feels) : '--') + '°C' },
        { icon: '💧', label: t('humidity'), value: (humidity != null ? humidity : '--') + '%' },
        { icon: '💨', label: t('wind'), value: windStr },
        { icon: '🫁', label: t('air_quality'), value: formatAirQuality(usAqi) },
        { icon: '🌅', label: t('sunrise'), value: formatSunTime(sunriseStr) },
        { icon: '🌇', label: t('sunset'), value: formatSunTime(sunsetStr) },
    ];
    var html = '<div class="overlay-detail-grid">';
    items.forEach(function (item) {
        html +=
            '<div class="overlay-detail-card">' +
            '<span class="detail-icon">' + item.icon + '</span>' +
            '<span class="detail-label">' + item.label + '</span>' +
            '<span class="detail-value">' + item.value + '</span>' +
            '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function stopOverlayCountdown() {
    if (overlayCountdownTimerId) {
        clearInterval(overlayCountdownTimerId);
        overlayCountdownTimerId = null;
    }
    overlayCountdown = 0;
}

function startOverlayCountdown() {
    stopOverlayCountdown();
    overlayCountdown = CONFIG.OVERLAY_COUNTDOWN;
    var fillEl = document.getElementById('overlay-countdown-fill');
    var textEl = document.getElementById('overlay-countdown-text');
    function updateCountdownDisplay() {
        if (fillEl) fillEl.style.width = (overlayCountdown / CONFIG.OVERLAY_COUNTDOWN) * 100 + '%';
        if (textEl) textEl.textContent = overlayCountdown + ' ' + t('seconds_short');
    }
    updateCountdownDisplay();
    overlayCountdownTimerId = setInterval(function () {
        overlayCountdown--;
        updateCountdownDisplay();
        if (overlayCountdown <= 0) {
            stopOverlayCountdown();
            closeOverlay();
        }
    }, 1000);
}

function closeOverlay() {
    activeOverlay = null;
    stopOverlayCountdown();
    var backdrop = document.getElementById('overlay-backdrop');
    if (backdrop) {
        backdrop.classList.add('hidden');
        backdrop.setAttribute('aria-hidden', 'true');
    }
    document.querySelectorAll('.action-btn').forEach(function (btn) {
        btn.classList.remove('active');
    });
}

function openOverlay(type) {
    if (activeOverlay === type) {
        closeOverlay();
        return;
    }
    activeOverlay = type;
    var backdrop = document.getElementById('overlay-backdrop');
    var titleEl = document.getElementById('overlay-title');
    var detailEl = document.getElementById('overlay-detail');
    var forecastEl = document.getElementById('overlay-forecast');
    var trafficEl = document.getElementById('overlay-traffic');
    if (!backdrop || !titleEl || !detailEl || !forecastEl || !trafficEl) return;

    detailEl.classList.add('hidden');
    forecastEl.classList.add('hidden');
    trafficEl.classList.add('hidden');

    if (type === 'detail') {
        titleEl.textContent = '🌡️ ' + t('detail_weather');
        renderDetailOverlay(detailEl);
        detailEl.classList.remove('hidden');
    } else if (type === 'forecast') {
        titleEl.textContent = '📅 ' + t('forecast_5days');
        renderForecastOverlay(forecastEl);
        forecastEl.classList.remove('hidden');
    } else if (type === 'traffic') {
        titleEl.textContent = '🚗 ' + t('traffic');
        renderTrafficOverlay(trafficEl);
        trafficEl.classList.remove('hidden');
    }

    backdrop.classList.remove('hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    document.querySelectorAll('.action-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-overlay') === type);
    });
    startOverlayCountdown();
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

    var backdrop = document.getElementById('overlay-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', function (e) {
            if (e.target === backdrop) {
                closeOverlay();
            }
        });
    }
    var closeBtn = document.getElementById('overlay-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeOverlay);
    }
    var panel = document.getElementById('overlay-panel');
    if (panel) {
        panel.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }
    document.querySelectorAll('.action-btn').forEach(function (btn) {
        var type = btn.getAttribute('data-overlay');
        if (type) {
            btn.addEventListener('click', function () {
                openOverlay(type);
            });
        }
    });

    fetchSettings().then(function () {
        Promise.all([fetchWeather(), fetchTraffic()]).catch(function () {
            showErrorIndicator();
        });
        setInterval(fetchWeather, CONFIG.REFRESH_WEATHER);
        setInterval(fetchTraffic, CONFIG.REFRESH_TRAFFIC);
    });
}

document.addEventListener('DOMContentLoaded', init);
