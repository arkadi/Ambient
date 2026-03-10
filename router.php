<?php

/**
 * Router for built-in PHP server: Document Root = public/, /api/* → api/*.php
 * Run: php -S localhost:8000 router.php
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (preg_match('#^/api/(.+\.php)$#', $uri, $m)) {
    $script = __DIR__ . '/api/' . $m[1];
    if (file_exists($script)) {
        require $script;
        return true;
    }
}

$path = __DIR__ . '/public' . $uri;
if ($uri === '/' || $uri === '') {
    $path = __DIR__ . '/public/index.html';
}
if (file_exists($path) && is_file($path)) {
    $ext = pathinfo($path, PATHINFO_EXTENSION);
    $mimes = ['html' => 'text/html', 'css' => 'text/css', 'js' => 'application/javascript', 'json' => 'application/json', 'ico' => 'image/x-icon', 'svg' => 'image/svg+xml'];
    if (isset($mimes[$ext])) {
        header('Content-Type: ' . $mimes[$ext] . '; charset=utf-8');
    }
    readfile($path);
    return true;
}

http_response_code(404);
echo '404 Not Found';
return true;
