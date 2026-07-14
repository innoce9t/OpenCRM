<?php

/**
 * Shared bootstrap: loads connections, provides the Zernio client factory,
 * aggregation helpers, and small view helpers. Every page in public/
 * includes this first.
 */

declare(strict_types=1);

session_start();

require_once __DIR__ . '/../src/ZernioClient.php';
require_once __DIR__ . '/../src/ConnectionStore.php';

/**
 * Legacy single-key config (env var or config.php). Still supported: if the
 * connection store is empty on first run, we seed a connection from it so
 * existing setups keep working.
 */
function zernio_seed_config(): array
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

// Where the connections file lives (overridable for tests).
$dataFile = getenv('ZERNIO_DATA_FILE') ?: (__DIR__ . '/../data/connections.json');
$store    = new ConnectionStore($dataFile);

// One-time seed from the legacy single-key config.
if ($store->all() === []) {
    $seed = zernio_seed_config();
    if ($seed['api_key'] !== '' && $seed['api_key'] !== 'sk_replace_me') {
        try {
            $store->add('Default', $seed['api_key'], $seed['base_url']);
        } catch (Throwable $e) {
            // Non-fatal: the Connections page will surface the write error.
        }
    }
}

$connections           = $store->all();
$connectionsConfigured = $connections !== [];

/** Build a Zernio API client for a given connection record. */
function zernio_client(array $conn): ZernioClient
{
    return new ZernioClient($conn['apiKey'], $conn['baseUrl'] ?? 'https://zernio.com/api/v1');
}

/**
 * Run a client call against every connection and return a flat list of rows,
 * each tagged with the connection it came from, plus any per-connection
 * errors.
 *
 * @param callable(ZernioClient):array $call     Returns an API result array.
 * @param string                       $listKey  Key inside data holding the list (e.g. 'accounts').
 * @return array{rows:array<int,array>, errors:array<int,string>}
 */
function zernio_aggregate(array $connections, callable $call, string $listKey): array
{
    $rows   = [];
    $errors = [];
    foreach ($connections as $conn) {
        $res = $call(zernio_client($conn));
        if ($res['error']) {
            $errors[] = $conn['label'] . ': ' . $res['error'];
            continue;
        }
        $list = [];
        if (is_array($res['data'])) {
            $list = $res['data'][$listKey] ?? (array_is_list($res['data']) ? $res['data'] : []);
        }
        foreach ($list as $item) {
            if (is_array($item)) {
                $item['_connectionId']    = $conn['id'];
                $item['_connectionLabel'] = $conn['label'];
                $rows[] = $item;
            }
        }
    }
    return ['rows' => $rows, 'errors' => $errors];
}

/** Mask an API key for display: sk_abcd…wxyz. */
function mask_key(string $key): string
{
    if (strlen($key) <= 12) {
        return substr($key, 0, 3) . '…';
    }
    return substr($key, 0, 6) . '…' . substr($key, -4);
}

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

// ---- CSRF -------------------------------------------------------------

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

/** Platforms Zernio can publish to, keyed by the API's platform identifier. */
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
