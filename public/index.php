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

        <section id="clock-section">
            <div id="time"><span id="time-hm">00:00</span><span id="time-sec" class="time-seconds">:00</span></div>
            <div id="date">—</div>
        </section>

        <section id="weather-section">
            <div class="weather-hero">
                <div class="weather-icon" id="weather-icon"></div>
                <div class="weather-temp-wrap">
                    <div class="weather-temp">
                        <span id="temperature">--</span><span class="unit">°C</span>
                    </div>
                    <div class="weather-feels-inline"><?= htmlspecialchars($t('feels_like')) ?> <span id="feels-like">--</span><span class="unit">°C</span></div>
                </div>
            </div>
            <div class="weather-details">
                <div class="detail-item">
                    <span class="detail-icon">💧</span>
                    <span id="humidity">--</span><span class="unit">%</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">💨</span>
                    <span id="wind-speed">--</span><span class="unit" id="wind-unit"><?= htmlspecialchars($t('wind_unit')) ?></span>
                    <span id="wind-direction" class="wind-dir">--</span>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">🫁</span>
                    <span id="air-quality">--</span>
                </div>
                <div class="sun-times">
                    <span class="sun-item sun-up"><span class="sun-symbol">↑</span> <span id="sunrise">--:--</span></span>
                    <span class="sun-item sun-down"><span class="sun-symbol">↓</span> <span id="sunset">--:--</span></span>
                </div>
            </div>
        </section>

        <section id="forecast-section">
            <!-- JS generates 5 .forecast-day elements -->
        </section>

        <section id="traffic-section">
            <div class="traffic-off-hours-msg hidden" id="traffic-off-hours-msg"></div>
           
            <div class="traffic-routes-wrap">
                <div class="traffic-route traffic-route-left" id="route-me">
                    <span class="route-icon route-icon-me" id="route-me-icon" aria-hidden="true">🚗</span>
                    <span class="route-label" id="route-me-label">—</span>
                    <span class="route-time" id="route-me-time">--</span>
                    <span class="route-indicator" id="route-me-indicator"></span>
                </div>
                <div class="traffic-route-spacer"></div>
                <div class="traffic-route traffic-route-right" id="route-wife">
                    <span class="route-icon route-icon-wife" id="route-wife-icon" aria-hidden="true">🚗</span>
                    <span class="route-label" id="route-wife-label">—</span>
                    <span class="route-time" id="route-wife-time">--</span>
                    <span class="route-indicator" id="route-wife-indicator"></span>
                </div>
            </div>
        </section>

        <div id="error-indicator" class="hidden"><?= htmlspecialchars($t('connection_error')) ?></div>
    </div>

    <script>
window.__LOCALE__ = <?= json_encode($locale, JSON_UNESCAPED_UNICODE) ?>;
window.__L10N__ = <?= json_encode($L10N, JSON_UNESCAPED_UNICODE) ?>;
</script>
<script src="js/dashboard.js?b=<?= htmlspecialchars($b) ?>"></script>
</body>
</html>
