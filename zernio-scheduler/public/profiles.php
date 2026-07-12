<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$pageTitle = 'Profiles';

// Handle profile creation.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) {
        flash_set('error', 'Invalid session token. Please try again.');
    } else {
        $name = trim($_POST['name'] ?? '');
        $desc = trim($_POST['description'] ?? '');
        if ($name === '') {
            flash_set('error', 'Profile name is required.');
        } else {
            $res = $zernio->createProfile($name, $desc);
            if ($res['error']) {
                flash_set('error', 'Could not create profile: ' . $res['error']);
            } else {
                flash_set('success', 'Profile "' . $name . '" created.');
            }
        }
    }
    header('Location: profiles.php');
    exit;
}

$profiles = [];
$loadError = null;
if ($zernioConfigured) {
    $res = $zernio->listProfiles();
    if ($res['error']) {
        $loadError = $res['error'];
    } elseif (is_array($res['data'])) {
        $profiles = $res['data']['profiles'] ?? (is_array($res['data']) ? $res['data'] : []);
    }
}

require __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <h1>Profiles</h1>
</div>
<p class="muted">Profiles group social accounts together — think "brands" or "projects".</p>

<?php if ($loadError): ?>
    <div class="flash flash-error"><?= e($loadError) ?></div>
<?php endif; ?>

<div class="grid-2">
    <section class="card">
        <h2>Your profiles</h2>
        <?php if (!$profiles): ?>
            <p class="muted">No profiles yet — create one to get started.</p>
        <?php else: ?>
            <table class="table">
                <thead><tr><th>Name</th><th>Description</th><th>ID</th></tr></thead>
                <tbody>
                <?php foreach ($profiles as $p): ?>
                    <tr>
                        <td><?= e($p['name'] ?? '') ?></td>
                        <td><?= e($p['description'] ?? '') ?></td>
                        <td><code><?= e($p['_id'] ?? '') ?></code></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </section>

    <section class="card">
        <h2>Create a profile</h2>
        <form method="post" action="profiles.php">
            <?= csrf_field() ?>
            <label>Name
                <input type="text" name="name" required placeholder="e.g. Personal Brand">
            </label>
            <label>Description
                <textarea name="description" rows="3" placeholder="Optional"></textarea>
            </label>
            <button class="btn btn-primary" type="submit" <?= $zernioConfigured ? '' : 'disabled' ?>>Create profile</button>
        </form>
    </section>
</div>

<?php require __DIR__ . '/../includes/footer.php'; ?>
