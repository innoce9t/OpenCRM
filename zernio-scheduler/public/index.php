<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$pageTitle = 'Dashboard';

$errors   = [];
$profiles = ['rows' => [], 'errors' => []];
$accounts = ['rows' => [], 'errors' => []];
$posts    = ['rows' => [], 'errors' => []];

if ($connectionsConfigured) {
    $profiles = zernio_aggregate($connections, fn (ZernioClient $c) => $c->listProfiles(), 'profiles');
    $accounts = zernio_aggregate($connections, fn (ZernioClient $c) => $c->listAccounts(), 'accounts');
    $posts    = zernio_aggregate($connections, fn (ZernioClient $c) => $c->listPosts(), 'posts');
    $errors   = array_merge($profiles['errors'], $accounts['errors'], $posts['errors']);
}

require __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <h1>Dashboard</h1>
    <a class="btn btn-primary" href="compose.php">+ New post</a>
</div>
<?php if ($connectionsConfigured): ?>
    <p class="muted">Combining <?= count($connections) ?> Zernio connection<?= count($connections) === 1 ? '' : 's' ?>.</p>
<?php endif; ?>

<?php foreach ($errors as $err): ?>
    <div class="flash flash-error"><?= e($err) ?></div>
<?php endforeach; ?>

<section class="stats">
    <a class="stat" href="connections.php">
        <span class="stat-num"><?= count($connections) ?></span>
        <span class="stat-label">Connections</span>
    </a>
    <a class="stat" href="profiles.php">
        <span class="stat-num"><?= count($profiles['rows']) ?></span>
        <span class="stat-label">Profiles</span>
    </a>
    <a class="stat" href="accounts.php">
        <span class="stat-num"><?= count($accounts['rows']) ?></span>
        <span class="stat-label">Connected accounts</span>
    </a>
    <div class="stat">
        <span class="stat-num"><?= count($posts['rows']) ?></span>
        <span class="stat-label">Posts</span>
    </div>
</section>

<section class="card">
    <h2>Recent posts</h2>
    <?php if (!$posts['rows']): ?>
        <p class="muted">No posts yet. <a href="compose.php">Schedule your first post &rarr;</a></p>
    <?php else: ?>
        <table class="table">
            <thead>
                <tr><th>Account</th><th>Content</th><th>Status</th><th>Scheduled for</th><th>Platforms</th></tr>
            </thead>
            <tbody>
            <?php foreach (array_slice($posts['rows'], 0, 20) as $post): ?>
                <?php
                    $content   = $post['content'] ?? '';
                    $status    = $post['status'] ?? (!empty($post['publishedAt']) ? 'published' : 'draft');
                    $scheduled = $post['scheduledFor'] ?? '';
                    $plats     = [];
                    foreach (($post['platforms'] ?? []) as $p) {
                        $plats[] = $p['platform'] ?? '';
                    }
                ?>
                <tr>
                    <td><span class="tag"><?= e($post['_connectionLabel'] ?? '') ?></span></td>
                    <td><?= e(mb_strimwidth($content, 0, 55, '…')) ?></td>
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
