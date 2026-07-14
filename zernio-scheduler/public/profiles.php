<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$pageTitle = 'Profiles';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) {
        flash_set('error', 'Invalid session token. Please try again.');
    } else {
        $name         = trim($_POST['name'] ?? '');
        $desc         = trim($_POST['description'] ?? '');
        $connectionId = $_POST['connectionId'] ?? '';
        $conn         = $store->get($connectionId);

        if ($name === '') {
            flash_set('error', 'Profile name is required.');
        } elseif (!$conn) {
            flash_set('error', 'Pick which connection to create the profile under.');
        } else {
            $res = zernio_client($conn)->createProfile($name, $desc);
            if ($res['error']) {
                flash_set('error', 'Could not create profile: ' . $res['error']);
            } else {
                flash_set('success', 'Profile "' . $name . '" created under ' . $conn['label'] . '.');
            }
        }
    }
    header('Location: profiles.php');
    exit;
}

$profiles = ['rows' => [], 'errors' => []];
if ($connectionsConfigured) {
    $profiles = zernio_aggregate($connections, fn (ZernioClient $c) => $c->listProfiles(), 'profiles');
}

require __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <h1>Profiles</h1>
</div>
<p class="muted">Profiles group social accounts together — think "brands" or "projects".</p>

<?php foreach ($profiles['errors'] as $err): ?>
    <div class="flash flash-error"><?= e($err) ?></div>
<?php endforeach; ?>

<div class="grid-2">
    <section class="card">
        <h2>All profiles</h2>
        <?php if (!$profiles['rows']): ?>
            <p class="muted">No profiles yet — create one to get started.</p>
        <?php else: ?>
            <table class="table">
                <thead><tr><th>Account</th><th>Name</th><th>Description</th><th>ID</th></tr></thead>
                <tbody>
                <?php foreach ($profiles['rows'] as $p): ?>
                    <tr>
                        <td><span class="tag"><?= e($p['_connectionLabel'] ?? '') ?></span></td>
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
        <?php if (!$connections): ?>
            <p class="muted">Add a <a href="connections.php">connection</a> first.</p>
        <?php else: ?>
            <form method="post" action="profiles.php">
                <?= csrf_field() ?>
                <label>Connection
                    <select name="connectionId" required>
                        <?php foreach ($connections as $conn): ?>
                            <option value="<?= e($conn['id']) ?>"><?= e($conn['label']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <label>Name
                    <input type="text" name="name" required placeholder="e.g. Personal Brand">
                </label>
                <label>Description
                    <textarea name="description" rows="3" placeholder="Optional"></textarea>
                </label>
                <button class="btn btn-primary" type="submit">Create profile</button>
            </form>
        <?php endif; ?>
    </section>
</div>

<?php require __DIR__ . '/../includes/footer.php'; ?>
