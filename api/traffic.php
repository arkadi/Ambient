<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate');

$debugMode = isset($_GET['debug']);

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

/**
 * Check: current time is within traffic working hours
 */
function isWithinTrafficHours(array $trafficHours): bool
{
    return getCurrentTrafficWindow($trafficHours) !== null;
}

/**
 * Current traffic window: 'morning' (home → work), 'evening' (work → home), or null
 */
function getCurrentTrafficWindow(array $trafficHours): ?string
{
    $tz = new DateTimeZone('Asia/Tbilisi');
    $now = new DateTime('now', $tz);
    $timeStr = $now->format('H:i');

    foreach ($trafficHours as $key => $window) {
        if (!is_array($window) || count($window) !== 2) {
            continue;
        }
        if (strcmp($timeStr, $window[0]) >= 0 && strcmp($timeStr, $window[1]) < 0) {
            return $key;
        }
    }
    return null;
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
$apiKey = $config['google_api_key'];
$cacheTtl = $config['cache_traffic'];

$homeLat = $config['home_lat'] ?? null;
$homeLng = $config['home_lng'] ?? null;
$traffic = $config['traffic'] ?? [];
$routes = $traffic['routes'] ?? [];
$trafficHours = [
    'to_work' => $traffic['to_work'] ?? ['07:00', '12:00'],
    'from_work' => $traffic['from_work'] ?? ['17:00', '22:00'],
];

$routeParam = isset($_GET['route']) ? trim((string) $_GET['route']) : '';
$routeKeys = [];
if ($routeParam !== '' && isset($routes[$routeParam])) {
    $routeKeys = [$routeParam];
} else {
    $routeKeys = array_keys($routes);
}

$currentWindow = getCurrentTrafficWindow($trafficHours);
if ($currentWindow === null) {
    $routesOnlyLabels = [];
    foreach ($routes as $key => $route) {
        $routesOnlyLabels[$key] = [
            'label' => $route['label'] ?? $key,
            'travel_time_min' => null,
            'traffic_delay_min' => null,
        ];
    }
    echo json_encode([
        'success' => true,
        'off_hours' => true,
        'message' => 'სამუშაო საათების გარეთ',
        'routes' => $routesOnlyLabels,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// from_work: work → home; to_work: home → work
$directionToHome = ($currentWindow === 'from_work');
$result = [
    'success' => true,
    'traffic_direction' => $directionToHome ? 'to_home' : 'to_work',
    'routes' => [],
];

foreach ($routeKeys as $key) {
    if (!isset($routes[$key])) {
        continue;
    }
    $route = $routes[$key];
    $workLat = $route['lat'];
    $workLng = $route['lng'];
    $label = $route['label'];

    $cacheKey = 'traffic_' . $key . ($directionToHome ? '_from_work' : '_to_work');
    $cached = getCache($cacheKey, $cacheTtl);
    if ($cached !== null) {
        $result['routes'][$key] = [
            'label' => $label,
            'travel_time_min' => $cached['travel_time_min'],
            'traffic_delay_min' => $cached['traffic_delay_min'],
            'total_time_sec' => $cached['total_time_sec'],
            'cached' => true,
        ];
        continue;
    }

    if ($directionToHome) {
        $originLat = $workLat;
        $originLng = $workLng;
        $destLat = $homeLat;
        $destLng = $homeLng;
    } else {
        $originLat = $homeLat;
        $originLng = $homeLng;
        $destLat = $workLat;
        $destLng = $workLng;
    }

    $url = sprintf(
        'https://maps.googleapis.com/maps/api/directions/json?origin=%s,%s&destination=%s,%s&departure_time=now&traffic_model=best_guess&key=%s',
        urlencode((string) $originLat),
        urlencode((string) $originLng),
        urlencode((string) $destLat),
        urlencode((string) $destLng),
        urlencode($apiKey)
    );

    $ch = curl_init($url);
    if ($ch === false) {
        $result['routes'][$key] = [
            'label' => $label,
            'travel_time_min' => null,
            'traffic_delay_min' => null,
            'total_time_sec' => null,
            'cached' => false,
            'error' => 'curl init failed',
        ];
        continue;
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($err !== '' || $response === false) {
        $result['routes'][$key] = [
            'label' => $label,
            'travel_time_min' => null,
            'traffic_delay_min' => null,
            'total_time_sec' => null,
            'cached' => false,
            'error' => $err ?: 'empty response',
        ];
        continue;
    }

    $data = json_decode($response, true);
    $travelTimeSec = 0;
    $trafficDelaySec = 0;
    $apiStatus = $data['status'] ?? 'NO_STATUS';
    $apiError = $data['error_message'] ?? null;

    if (is_array($data) && $apiStatus === 'OK' && !empty($data['routes'][0]['legs'][0])) {
        $leg = $data['routes'][0]['legs'][0];
        $baseDuration = (int) ($leg['duration']['value'] ?? 0);
        $travelTimeSec = (int) ($leg['duration_in_traffic']['value'] ?? $baseDuration);
        $trafficDelaySec = max(0, $travelTimeSec - $baseDuration);
    }

    $travelTimeMin = (int) ceil($travelTimeSec / 60);
    $trafficDelayMin = (int) ceil($trafficDelaySec / 60);

    if ($apiStatus === 'OK') {
        setCache($cacheKey, [
            'travel_time_min' => $travelTimeMin,
            'traffic_delay_min' => $trafficDelayMin,
            'total_time_sec' => $travelTimeSec,
        ]);
    }

    $routeData = [
        'label' => $label,
        'travel_time_min' => $travelTimeMin,
        'traffic_delay_min' => $trafficDelayMin,
        'total_time_sec' => $travelTimeSec,
        'cached' => false,
    ];

    if ($apiStatus !== 'OK') {
        $routeData['api_status'] = $apiStatus;
        if ($apiError) {
            $routeData['api_error'] = $apiError;
        }
    }

    $result['routes'][$key] = $routeData;
}

echo json_encode($result, JSON_UNESCAPED_UNICODE);
