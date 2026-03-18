<?php
$b = (string) round(microtime(true) * 1000);

$configFile = __DIR__ . '/../api/config.php';
$config = file_exists($configFile) ? (require $configFile) : [];
$locale = isset($config['locale']) && in_array($config['locale'], ['en', 'ka'], true)
    ? $config['locale']
    : 'en';
$localeFile = __DIR__ . '/../api/locales/' . $locale . '.php';
$L10N = file_exists($localeFile) ? (require $localeFile) : [];
$t = function ($key) use ($L10N) {
    return $L10N[$key] ?? $key;
};
$htmlLang = $locale === 'ka' ? 'ka' : 'en';
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($htmlLang) ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Ambient">
    <title>Ambient</title>
    <link rel="stylesheet" href="css/style.css?b=<?= htmlspecialchars($b) ?>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@300;400;600&family=JetBrains+Mono:wght@300&display=swap" rel="stylesheet">
</head>
<body>
    <div id="background-layer">
        <div class="bg-slide" id="bg-slide-0"></div>
        <div class="bg-slide" id="bg-slide-1"></div>
        <div id="background-overlay"></div>
    </div>
    <div id="dashboard">
        <div class="dashboard-center">
        <section id="clock-section">
            <div id="date">—</div>
            <div id="time"><span id="time-hm">00:00</span><span id="time-sec" class="time-seconds">:00</span></div>
            <div class="day-progress-container">
                <div class="day-progress-track">
                    <div class="day-progress-fill"></div>
                </div>
                <div class="day-progress-labels">
                    <span>00:00</span>
                    <span>24:00</span>
                </div>
            </div>
        </section>

        <section id="weather-section">
            <div class="weather-block-compact">
                <span class="weather-icon-compact" id="weather-icon"></span>
                <div class="weather-temp-wrap">
                    <span class="weather-temp-compact"><span id="temperature">--</span><span class="unit">°C</span></span>
                    <span class="weather-feels-inline"><?= htmlspecialchars($t('feels_like')) ?> <span id="feels-like">--</span><span class="unit">°C</span></span>
                </div>
            </div>
        </section>
        </div>

        <div class="buttons-row">
            <button type="button" class="action-btn" data-overlay="detail" aria-label="<?= htmlspecialchars($t('detail_weather')) ?>">
                <span class="btn-icon">🌡️</span>
                <span class="btn-label"><?= htmlspecialchars($t('detail_weather')) ?></span>
            </button>
            <button type="button" class="action-btn" data-overlay="forecast" aria-label="<?= htmlspecialchars($t('forecast_5days')) ?>">
                <span class="btn-icon">📅</span>
                <span class="btn-label"><?= htmlspecialchars($t('forecast_5days')) ?></span>
            </button>
            <button type="button" class="action-btn" data-overlay="traffic" aria-label="<?= htmlspecialchars($t('traffic')) ?>">
                <span class="btn-icon">🚗</span>
                <span class="btn-label"><?= htmlspecialchars($t('traffic')) ?></span>
            </button>
        </div>

        <div id="error-indicator" class="hidden"><?= htmlspecialchars($t('connection_error')) ?></div>
    </div>

    <div id="overlay-backdrop" class="hidden" aria-hidden="true">
        <div id="overlay-panel" role="dialog" aria-modal="true">
            <div class="overlay-countdown-track">
                <div class="overlay-countdown-fill" id="overlay-countdown-fill"></div>
            </div>
            <div class="overlay-header">
                <span class="overlay-title" id="overlay-title"></span>
                <div class="overlay-header-right">
                    <span class="overlay-countdown-text" id="overlay-countdown-text"></span>
                    <button type="button" class="overlay-close-btn" id="overlay-close-btn" aria-label="Close">✕</button>
                </div>
            </div>
            <div class="overlay-body">
                <div id="overlay-detail" class="overlay-content hidden"></div>
                <div id="overlay-forecast" class="overlay-content hidden"></div>
                <div id="overlay-traffic" class="overlay-content hidden"></div>
            </div>
        </div>
    </div>

    <script>
window.__LOCALE__ = <?= json_encode($locale, JSON_UNESCAPED_UNICODE) ?>;
window.__L10N__ = <?= json_encode($L10N, JSON_UNESCAPED_UNICODE) ?>;
</script>
<script src="js/dashboard.js?b=<?= htmlspecialchars($b) ?>"></script>
</body>
</html>
