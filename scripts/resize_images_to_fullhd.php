<?php
/**
 * One-time script: scale all images in public/img to Full HD (1920×1080).
 * Uses "cover" mode: scale so image fills 1920×1080, then crop center.
 * Overwrites files in place. Run from project root: php scripts/resize_images_to_fullhd.php
 */

declare(strict_types=1);

const FULLHD_W = 1920;
const FULLHD_H = 1080;
const IMG_DIR = __DIR__ . '/../public/img';
const EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

if (!extension_loaded('gd')) {
    fwrite(STDERR, "Error: PHP GD extension is required.\n");
    exit(1);
}

$imgDir = realpath(IMG_DIR);
if (!$imgDir || !is_dir($imgDir)) {
    fwrite(STDERR, "Error: Image directory not found: " . IMG_DIR . "\n");
    exit(1);
}

$files = [];
foreach (scandir($imgDir) as $name) {
    if ($name === '.' || $name === '..') continue;
    $path = $imgDir . DIRECTORY_SEPARATOR . $name;
    if (!is_file($path)) continue;
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (in_array($ext, EXTENSIONS, true)) {
        $files[] = ['path' => $path, 'name' => $name, 'ext' => $ext];
    }
}

if (empty($files)) {
    echo "No images found in " . IMG_DIR . "\n";
    exit(0);
}

echo "Resizing " . count($files) . " image(s) to " . FULLHD_W . "×" . FULLHD_H . " (cover, center crop).\n";

foreach ($files as $file) {
    $path = $file['path'];
    $name = $file['name'];
    $ext = $file['ext'];

    $image = loadImage($path, $ext);
    if (!$image) {
        echo "  [SKIP] $name - could not load\n";
        continue;
    }

    $w = imagesx($image);
    $h = imagesy($image);
    if ($w === FULLHD_W && $h === FULLHD_H) {
        imagedestroy($image);
        echo "  [OK]   $name - already " . FULLHD_W . "×" . FULLHD_H . "\n";
        continue;
    }

    // Scale to cover 1920×1080, then crop center
    $scale = max(FULLHD_W / $w, FULLHD_H / $h);
    $srcW = (int) round(FULLHD_W / $scale);
    $srcH = (int) round(FULLHD_H / $scale);
    $srcX = (int) round(($w - $srcW) / 2);
    $srcY = (int) round(($h - $srcH) / 2);

    $out = imagecreatetruecolor(FULLHD_W, FULLHD_H);
    if (!$out) {
        imagedestroy($image);
        echo "  [SKIP] $name - could not create output image\n";
        continue;
    }

    $ok = imagecopyresampled(
        $out, $image,
        0, 0, $srcX, $srcY,
        FULLHD_W, FULLHD_H, $srcW, $srcH
    );
    imagedestroy($image);
    if (!$ok) {
        imagedestroy($out);
        echo "  [SKIP] $name - resize failed\n";
        continue;
    }

    $saved = saveImage($out, $path, $ext);
    imagedestroy($out);
    if ($saved) {
        echo "  [OK]   $name - resized to " . FULLHD_W . "×" . FULLHD_H . "\n";
    } else {
        echo "  [SKIP] $name - could not save\n";
    }
}

echo "Done.\n";

function loadImage(string $path, string $ext): \GdImage|false
{
    switch ($ext) {
        case 'jpg':
        case 'jpeg':
            return @imagecreatefromjpeg($path);
        case 'png':
            $im = @imagecreatefrompng($path);
            if ($im) {
                imagealphablending($im, true);
                imagesavealpha($im, true);
            }
            return $im;
        case 'gif':
            return @imagecreatefromgif($path);
        case 'webp':
            return @imagecreatefromwebp($path);
        default:
            return false;
    }
}

function saveImage(\GdImage $image, string $path, string $ext): bool
{
    switch ($ext) {
        case 'jpg':
        case 'jpeg':
            return imagejpeg($image, $path, 90);
        case 'png':
            return imagepng($image, $path, 6);
        case 'gif':
            return imagegif($image, $path);
        case 'webp':
            return imagewebp($image, $path, 90);
        default:
            return false;
    }
}
