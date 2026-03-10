# Ambient

A fullscreen ambient dashboard for tablet or browser (e.g. Safari, landscape) showing **time**, **weather** (Open-Meteo), and **traffic** (Google Directions). Built with vanilla HTML/CSS/JS and a minimal PHP backend. UI is available in **English** and **Georgian** (ქართული).

![Dashboard](https://img.shields.io/badge/platform-tablet%20%7C%20browser-blue) ![PHP 7.4+](https://img.shields.io/badge/PHP-7.4%2B-777BB4?logo=php) ![No frameworks](https://img.shields.io/badge/frontend-vanilla%20JS%20%7C%20CSS-yellow)

---

## Features

- **Clock** — Large 24h time (HH:MM:SS) and localized date (e.g. “Saturday, 8 March” in Georgian or English).
- **Weather** — Current conditions (temperature, feels-like, humidity, wind) and 5-day forecast; weather codes mapped to descriptions and icons.
- **Traffic** — Travel time and delay for configurable routes (e.g. to work / spouse’s office) via Google Directions API; only requested during configured “to work” / “from work” time windows.
- **Background** — Optional rotating background images (single or multiple with interval).
- **Offline behavior** — Last data stays on screen; a small “no connection” indicator appears until the next successful fetch.

---

## Tech Stack & Constraints

| Layer    | Choice |
|----------|--------|
| Frontend | HTML5, CSS3, vanilla JavaScript (no React, Vue, jQuery, Tailwind, Bootstrap) |
| Backend  | PHP 7.4+ (thin proxy only) |
| Weather  | [Open-Meteo](https://open-meteo.com/) (no API key) |
| Traffic  | [Google Maps Directions API](https://developers.google.com/maps/documentation/directions) |
| Platform | Tablet/browser, fullscreen, landscape; no geolocation — all coordinates from config |

Fonts and UI support **Georgian script** (Mkhedruli). HTML uses `lang="ka"` or `lang="en"`; date locale is `ka-GE` or `en` per config.

---

## Requirements

- PHP 7.4+ with `curl` and JSON
- Web server (Apache/Nginx) or PHP built-in server (see below)
- Google Maps API key (for traffic)
- Writable `cache/` directory for file-based cache

---

## Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/arkadi/Ambient.git
   cd Ambient
   ```

2. **Configure**
   - Copy the example config:  
     `cp config.example.php api/config.php`
   - Edit `api/config.php`: set `google_api_key`, `home_lat`/`home_lng`, and `traffic.routes` (labels and coordinates). Optionally set `locale` (`'en'` or `'ka'`) and `background_image`.

3. **Cache directory**
   - Ensure `cache/` exists and is writable by the web server:  
     `mkdir -p cache && chmod 755 cache`

4. **Run**
   - **PHP built-in server** (from project root):  
     `php -S localhost:8000 router.php`  
     Then open `http://localhost:8000` (router serves `public/` and routes `/api/*` to `api/*.php`).
   - **Apache/Nginx**  
     Set document root to `public/` and route `/api/*` to `api/` (e.g. `public/api` → `../api` or rewrite rules). Entry point: `public/index.php`.

---

## Installing as a PWA (iPad, Kindle Fire, Chrome)

You can install the dashboard as a Progressive Web App so it opens fullscreen like a native app and (on supported devices) appears on the home screen.

### iPad (Safari)

1. Open the dashboard in **Safari** (e.g. `https://your-server.com` or `http://your-local-ip:8000`).
2. Tap the **Share** button (square with arrow) at the top or bottom of the screen.
3. Scroll down and tap **“Add to Home Screen”**.
4. Optionally edit the name (e.g. “Ambient”), then tap **Add**.
5. An icon appears on the home screen. Tap it to open the dashboard in fullscreen (no Safari UI). Use it in **landscape** for the best layout.

**Tip:** For kiosk use, enable **Guided Access** (Settings → Accessibility → Guided Access) to lock the iPad to this app and prevent exiting.

### Kindle Fire (Amazon Fire tablet)

1. Open the dashboard in the **Silk** browser (or **Chrome** if installed from the Appstore).
2. Tap the **menu** (⋮ or three dots), then **Add to Home Screen** (or **Install app** / **Add page to** → **Home screen**, depending on browser and OS version).
3. Confirm the name (e.g. “Ambient”) and tap **Add**. An icon appears on the Fire home screen.
4. Open the icon to use the dashboard fullscreen. Use in **landscape** for the best layout.

**Note:** If the option is missing, ensure the site is loaded over **HTTPS**; some Fire OS versions only offer “Add to Home Screen” for secure origins.

### Chrome (desktop or Android)

1. Open the dashboard in **Chrome**.
2. In the address bar, click the **install** icon (⊕ or “Install app”), or use the menu (⋮) → **Install Ambient…** / **Add to Home screen**.
3. Confirm. The app runs in a standalone window (desktop) or as an icon on the home screen (Android).

---

## Configuration

Config is in `api/config.php` (do not commit; use `config.example.php` as a template).

| Key | Description |
|-----|-------------|
| `locale` | UI language: `'en'` or `'ka'` |
| `google_api_key` | Google Maps API key for Directions |
| `cache_weather` | Weather cache TTL in seconds (e.g. 1800 = 30 min) |
| `cache_traffic` | Traffic cache TTL in seconds (e.g. 600 = 10 min) |
| `home_lat`, `home_lng` | Home coordinates (weather and route origin) |
| `traffic.to_work` | Time window for “to work” (e.g. `['07:00', '12:00']`) |
| `traffic.from_work` | Time window for “from work” (e.g. `['17:00', '22:00']`) |
| `traffic.routes` | Keys like `route_1`, `route_2` with `label`, `lat`, `lng` |
| `background_image` | Optional array of `['url' => '...']` or with `'interval'` for rotation |

---

## Project Structure

```
Ambient/
├── public/                 # Document root
│   ├── index.php           # Main dashboard page
│   ├── css/style.css       # Styles (dark theme, fullscreen, CSS variables)
│   └── js/dashboard.js     # Clock, weather, traffic fetch & render
├── api/
│   ├── config.php          # Local config (not committed)
│   ├── weather.php         # Open-Meteo proxy + file cache
│   ├── traffic.php         # Google Directions proxy + file cache
│   ├── settings.php        # Shared helpers/settings
│   └── locales/
│       ├── en.php          # English UI strings
│       └── ka.php          # Georgian UI strings
├── cache/                  # File cache (writable)
│   └── .gitkeep
├── config.example.php      # Example config (committed)
├── router.php              # For PHP built-in server
├── .gitignore
└── README.md
```

---

## API Endpoints (PHP)

- **Weather**  
  `GET /api/weather.php`  
  Returns current weather and 5-day forecast (from Open-Meteo). Response includes `success`, `cached`, `city`, `current`, `daily`. Uses `cache_weather` and `cache/weather.json`.

- **Traffic**  
  `GET /api/traffic.php` — all routes  
  `GET /api/traffic.php?route=route_1` — single route  
  Returns travel time and traffic delay per route, or `off_hours: true` outside configured time windows. Uses `cache_traffic` and `cache/traffic_*.json`.

---

## Frontend Overview

- **Clock** — `Intl.DateTimeFormat` with locale from config and `Asia/Tbilisi` timezone; updates every second.
- **Weather** — Fetches `/api/weather.php`; maps WMO weather codes to descriptions and icons; shows current + 5-day forecast.
- **Traffic** — Fetches `/api/traffic.php`; shows “—” or “no data” when `off_hours`; otherwise shows travel time in minutes with color indicator (e.g. green &lt; 20 min, yellow 20–40, red &gt; 40).
- **Errors** — On fetch failure, existing data is kept and a small “no connection” message is shown until the next success.

---

## Design (CSS)

- Dark theme (e.g. `--bg-primary: #0a0a0f`), fullscreen (100vw/100vh, no scroll).
- Large clock font (~8rem), readable body font (~1.5rem), all with Georgian script support.
- CSS variables for colors and spacing; smooth opacity transitions when data updates.
- Optimized for landscape (e.g. 1024×768); no mobile breakpoints required.

---

## Caching

Only file-based cache is used (no Redis/Memcached/APCu). PHP writes JSON under `cache/` (e.g. `weather.json`, `traffic_route_1.json`). TTL is controlled by `cache_weather` and `cache_traffic` in config.

---

## .gitignore

Typical contents:

```
api/config.php
cache/*.json
.DS_Store
*.log
```

---

## License

Use and modify as you like. Attribution appreciated.

---

## Contributing

1. Follow existing style: strict PHP (`declare(strict_types=1)`), strict JS (`'use strict'`, `const`/`let` only).
2. Keep UI strings in `api/locales/` (en.php, ka.php).
3. Do not commit `api/config.php` or cache JSON files.
