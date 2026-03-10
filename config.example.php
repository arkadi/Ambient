<?php

declare(strict_types=1);

return [
    // UI language: 'en' (English) or 'ka' (Georgian)
    'locale' => 'en',

    // Google Maps Directions API ($200 free credit/month)
    'google_api_key' => 'YOUR_GOOGLE_MAPS_API_KEY',

    // Caching (seconds)
    'cache_weather' => 1800,   // 30 minutes
    'cache_traffic' => 600,    // 10 minutes

    // Home coordinates: used for weather and traffic
    'home_lat' => 41.XXXX,
    'home_lng' => 44.XXXX,

    // Traffic: hours (to work / from work), routes. Add any number of routes (e.g. 2 locations).
    'traffic' => [
        'to_work'  => ['07:00', '12:00'],
        'from_work' => ['17:00', '22:00'],
        'routes' => [
            'route_1' => [
                'label' => 'Office A',
                'lat' => 41.XXXX,
                'lng' => 44.XXXX,
            ],
            'route_2' => [
                'label' => 'Office B',
                'lat' => 41.XXXX,
                'lng' => 44.XXXX,
            ],
        ],
    ],

    // Dashboard background: array of images. One item = single image without rotation; multiple = rotate by interval (seconds)
    'background_image' => [
        ['url' => 'https://example.com/your-background.jpg'],
        // Multiple with interval: ['url' => 'https://example.com/bg2.jpg', 'interval' => 30],
    ],
];
