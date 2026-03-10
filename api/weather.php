<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

/**
 * File cache: path to cache file by key
 */
function getCacheFile(string $key): string
{
    return __DIR__ . '/../cache/' . $key . '.json';
}

/**
 * Read from cache; null if missing or expired
 */
function getCache(string $key, int $ttl): ?array
{
    $file = getCacheFile($key);
    if (!file_exists($file)) {
        return null;
    }
    if (time() - filemtime($file) > $ttl) {
        return null;
    }
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data) ? $data : null;
}

/**
 * Write to cache
 */
function setCache(string $key, array $data): void
{
    $file = getCacheFile($key);
    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE));
}

$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    echo json_encode([
        'success' => false,
        'error' => 'Configuration not found',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$config = require $configFile;
$homeLat = $config['home_lat'] ?? null;
$homeLng = $config['home_lng'] ?? null;
$cacheTtl = $config['cache_weather'];

$cached = getCache('weather', $cacheTtl);
if ($cached !== null) {
    $daily = $cached['daily'] ?? [];
    if (!isset($daily['sunrise'], $daily['sunset']) || empty($daily['sunrise']) || empty($daily['sunset'])) {
        $cached = null;
    }
}
if ($cached !== null) {
    echo json_encode([
        'success' => true,
        'cached' => true,
        'current' => $cached['current'] ?? [],
        'daily' => $cached['daily'] ?? [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$url = sprintf(
    'https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=Asia/Tbilisi&forecast_days=5&wind_speed_unit=ms',
    urlencode((string) $homeLat),
    urlencode((string) $homeLng)
);

$ch = curl_init($url);
if ($ch === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Open-Meteo API error: curl init failed',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
]);
$response = curl_exec($ch);
$err = curl_error($ch);
curl_close($ch);

if ($err !== '' || $response === false) {
    echo json_encode([
        'success' => false,
        'error' => 'Open-Meteo API error: ' . ($err ?: 'empty response'),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$data = json_decode($response, true);
if (!is_array($data) || !isset($data['current'], $data['daily'])) {
    echo json_encode([
        'success' => false,
        'error' => 'Open-Meteo API error: invalid response',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$current = $data['current'];

// Air quality — Open-Meteo Air Quality API
$aqUrl = sprintf(
    'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=%s&longitude=%s&hourly=us_aqi&timezone=Asia/Tbilisi',
    urlencode((string) $homeLat),
    urlencode((string) $homeLng)
);
$aqCh = curl_init($aqUrl);
if ($aqCh !== false) {
    curl_setopt_array($aqCh, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 8,
    ]);
    $aqResponse = curl_exec($aqCh);
    curl_close($aqCh);
    if ($aqResponse !== false) {
        $aqData = json_decode($aqResponse, true);
        if (is_array($aqData) && isset($aqData['hourly']['us_aqi']) && is_array($aqData['hourly']['us_aqi'])) {
            $aqis = $aqData['hourly']['us_aqi'];
            foreach ($aqis as $v) {
                if ($v !== null && $v !== '' && (is_int($v) || is_numeric($v))) {
                    $current['us_aqi'] = (int) round((float) $v);
                    break;
                }
            }
        }
    }
}

setCache('weather', [
    'current' => $current,
    'daily' => $data['daily'],
]);

echo json_encode([
    'success' => true,
    'cached' => false,
    'current' => $current,
    'daily' => $data['daily'],
], JSON_UNESCAPED_UNICODE);
