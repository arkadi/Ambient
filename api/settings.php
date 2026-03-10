<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    echo json_encode([
        'success' => false,
        'error' => 'Configuration not found',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$config = require $configFile;

$locale = isset($config['locale']) && in_array($config['locale'], ['en', 'ka'], true)
    ? $config['locale']
    : 'en';
$localeFile = __DIR__ . '/locales/' . $locale . '.php';
$strings = file_exists($localeFile) ? (require $localeFile) : [];

$backgroundImage = [];
if (isset($config['background_image']) && is_array($config['background_image'])) {
    foreach ($config['background_image'] as $item) {
        if (is_array($item) && !empty($item['url'])) {
            $entry = ['url' => (string) $item['url']];
            if (isset($item['interval']) && (int) $item['interval'] > 0) {
                $entry['interval'] = (int) $item['interval'];
            }
            $backgroundImage[] = $entry;
        }
    }
}

$settings = [
    'success' => true,
    'locale' => $locale,
    'strings' => $strings,
    'background_image' => $backgroundImage,
];

echo json_encode($settings, JSON_UNESCAPED_UNICODE);
