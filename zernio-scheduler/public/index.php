<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$pageTitle = 'Dashboard';

$profiles = [];
$accounts = [];
$posts    = [];
$errors   = [];

if ($zernioConfigured) {
    $res = $zernio->listProfiles();
    if ($res['error']) {
        $errors[] = 'Profiles: ' . $res['error'];
    } elseif (is_array($res['data'])) {
        $profiles = $res['data']['profiles'] ?? (is_array($res['data']) ? $res['data'] : []);
    }

    $res = $zernio->listAccounts();
    if ($res['error']) {
        $errors[] = 'Accounts: ' . $res['error'];
    } elseif (is_array($res['data'])) {
        $accounts = $res['data']['accounts'] ?? [];
    }

    $res = $zernio->listPosts();
    if ($res['error']) {
        $errors[] = 'Posts: ' . $res['error'];
    } elseif (is_array($res['data'])) {
        $posts = $res['data']['posts'] ?? [];
    }
}

require __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <h1>Dashboard</h1>
    <a class="btn btn-primary" href="compose.php">+ New post</a>
</div>

<?php foreach ($errors as $err): ?>
    <div class="flash flash-error"><?= e($err) ?></div>
<?php endforeach; ?>

<section class="stats">
    <a class="stat" href="profiles.php">
        <span class="stat-num"><?= count($profiles) ?></span>
        <span class="stat-label">Profiles</span>
    </a>
    <a class="stat" href="accounts.php">
        <span class="stat-num"><?= count($accounts) ?></span>
        <span class="stat-label">Connected accounts</span>
    </a>
    <div class="stat">
        <span class="stat-num"><?= count($posts) ?></span>
        <span class="stat-label">Posts</span>
    </div>
</section>

<section class="card">
    <h2>Recent posts</h2>
    <?php if (!$posts): ?>
        <p class="muted">No posts yet. <a href="compose.php">Schedule your first post &rarr;</a></p>
    <?php else: ?>
        <table class="table">
            <thead>
                <tr><th>Content</th><th>Status</th><th>Scheduled for</th><th>Platforms</th></tr>
            </thead>
            <tbody>
            <?php foreach (array_slice($posts, 0, 15) as $post): ?>
                <?php
                    $content   = $post['content'] ?? '';
                    $status    = $post['status'] ?? ($post['publishedAt'] ?? null ? 'published' : 'draft');
                    $scheduled = $post['scheduledFor'] ?? '';
                    $plats     = [];
                    foreach (($post['platforms'] ?? []) as $p) {
                        $plats[] = $p['platform'] ?? '';
                    }
                ?>
                <tr>
                    <td><?= e(mb_strimwidth($content, 0, 60, '…')) ?></td>
                    <td><span class="pill pill-<?= e($status) ?>"><?= e($status) ?></span></td>
                    <td><?= e($scheduled) ?></td>
                    <td><?= e(implode(', ', array_filter($plats))) ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</section>

<?php require __DIR__ . '/../includes/footer.php'; ?>
