<?php
/** @var string $pageTitle */
$pageTitle = $pageTitle ?? 'Zernio Scheduler';
$currentPage = basename($_SERVER['PHP_SELF']);
function nav_active(string $file, string $current): string
{
    return $file === $current ? ' class="active"' : '';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e($pageTitle) ?> &middot; Zernio Scheduler</title>
    <link rel="stylesheet" href="assets/style.css">
</head>
<body>
<header class="topbar">
    <div class="wrap">
        <a class="brand" href="index.php">
            <span class="brand-mark">Z</span> Zernio Scheduler
        </a>
        <nav>
            <a href="index.php"<?= nav_active('index.php', $currentPage) ?>>Dashboard</a>
            <a href="compose.php"<?= nav_active('compose.php', $currentPage) ?>>Compose</a>
            <a href="accounts.php"<?= nav_active('accounts.php', $currentPage) ?>>Accounts</a>
            <a href="profiles.php"<?= nav_active('profiles.php', $currentPage) ?>>Profiles</a>
            <a href="connections.php"<?= nav_active('connections.php', $currentPage) ?>>Connections</a>
        </nav>
    </div>
</header>
<main class="wrap">
<?php if ($flash = flash_get()): ?>
    <div class="flash flash-<?= e($flash['type']) ?>"><?= e($flash['message']) ?></div>
<?php endif; ?>
<?php if (isset($connectionsConfigured) && !$connectionsConfigured): ?>
    <div class="flash flash-warn">
        No Zernio connections yet. <a href="connections.php">Add an API key on the Connections page &rarr;</a>
    </div>
<?php endif; ?>
