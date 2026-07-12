<?php

/**
 * Shared bootstrap: loads config, builds the Zernio client, and provides a
 * handful of small view helpers. Every page in public/ includes this first.
 */

declare(strict_types=1);

session_start();

require_once __DIR__ . '/../src/ZernioClient.php';

/**
 * Resolve configuration from (in order of precedence):
 *   1. Environment variables (ZERNIO_API_KEY / ZERNIO_BASE_URL)
 *   2. config.php (copied from config.example.php)
 */
function zernio_config(): array
{
    $config = ['api_key' => '', 'base_url' => 'https://zernio.com/api/v1'];

    $configFile = __DIR__ . '/../config.php';
    if (is_file($configFile)) {
        $loaded = require $configFile;
        if (is_array($loaded)) {
            $config = array_merge($config, $loaded);
        }
    }

    $envKey = getenv('ZERNIO_API_KEY');
    if ($envKey !== false && $envKey !== '') {
        $config['api_key'] = $envKey;
    }

    $envBase = getenv('ZERNIO_BASE_URL');
    if ($envBase !== false && $envBase !== '') {
        $config['base_url'] = $envBase;
    }

    return $config;
}

$config = zernio_config();
$zernioConfigured = $config['api_key'] !== '' && $config['api_key'] !== 'sk_replace_me';
$zernio = new ZernioClient($config['api_key'], $config['base_url']);

/** Escape a value for safe HTML output. */
function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

/** Read + clear a one-shot flash message. */
function flash_get(): ?array
{
    if (!empty($_SESSION['flash'])) {
        $flash = $_SESSION['flash'];
        unset($_SESSION['flash']);
        return $flash;
    }
    return null;
}

/** Store a flash message for the next request. */
function flash_set(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

/**
 * CSRF token helpers. Any form that mutates state includes csrf_field() and
 * every POST handler calls csrf_check() before doing work.
 */
function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function csrf_check(): bool
{
    return isset($_POST['_csrf'])
        && is_string($_POST['_csrf'])
        && hash_equals(csrf_token(), $_POST['_csrf']);
}

/**
 * The list of platforms Zernio can publish to. Used to populate selects.
 * Keyed by the platform identifier the API expects.
 */
function zernio_platforms(): array
{
    return [
        'twitter'   => 'X (Twitter)',
        'linkedin'  => 'LinkedIn',
        'facebook'  => 'Facebook',
        'instagram' => 'Instagram',
        'threads'   => 'Threads',
        'bluesky'   => 'Bluesky',
        'mastodon'  => 'Mastodon',
        'tiktok'    => 'TikTok',
        'youtube'   => 'YouTube',
        'pinterest' => 'Pinterest',
    ];
}
