<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$pageTitle = 'Accounts';

$connectUrl      = null;
$connectConnLabel = null;

// Start an OAuth connection. The target select carries "connectionId::profileId".
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) {
        flash_set('error', 'Invalid session token. Please try again.');
        header('Location: accounts.php');
        exit;
    }
    $platform = trim($_POST['platform'] ?? '');
    $target   = $_POST['target'] ?? '';
    [$connectionId, $profileId] = array_pad(explode('::', $target, 2), 2, '');
    $conn = $store->get($connectionId);

    if ($platform === '' || !$conn || $profileId === '') {
        flash_set('error', 'Pick a platform and a profile.');
        header('Location: accounts.php');
        exit;
    }

    $res = zernio_client($conn)->getConnectUrl($platform, $profileId);
    if ($res['error']) {
        flash_set('error', 'Could not start connection: ' . $res['error']);
        header('Location: accounts.php');
        exit;
    }
    $connectUrl = is_array($res['data']) ? ($res['data']['authUrl'] ?? null) : null;
    if (!$connectUrl) {
        flash_set('error', 'The API did not return an authorization URL.');
        header('Location: accounts.php');
        exit;
    }
    $connectConnLabel = $conn['label'];
    // Fall through to render with the connect link shown.
}

$accounts = ['rows' => [], 'errors' => []];
$profiles = ['rows' => [], 'errors' => []];
if ($connectionsConfigured) {
    $accounts = zernio_aggregate($connections, fn (ZernioClient $c) => $c->listAccounts(), 'accounts');
    $profiles = zernio_aggregate($connections, fn (ZernioClient $c) => $c->listProfiles(), 'profiles');
}

require __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <h1>Accounts</h1>
</div>

<?php foreach ($accounts['errors'] as $err): ?>
    <div class="flash flash-error"><?= e($err) ?></div>
<?php endforeach; ?>

<?php if ($connectUrl): ?>
    <div class="flash flash-success">
        Authorization ready for <strong><?= e($connectConnLabel) ?></strong> —
        <a href="<?= e($connectUrl) ?>" target="_blank" rel="noopener">open this link</a>
        to authorize, then return here and refresh.
    </div>
<?php endif; ?>

<div class="grid-2">
    <section class="card">
        <h2>All connected accounts</h2>
        <?php if (!$accounts['rows']): ?>
            <p class="muted">No accounts connected yet.</p>
        <?php else: ?>
            <table class="table">
                <thead><tr><th>Account</th><th>Platform</th><th>Name</th><th>ID</th></tr></thead>
                <tbody>
                <?php foreach ($accounts['rows'] as $a): ?>
                    <tr>
                        <td><span class="tag"><?= e($a['_connectionLabel'] ?? '') ?></span></td>
                        <td><?= e($a['platform'] ?? '') ?></td>
                        <td><?= e($a['name'] ?? ($a['username'] ?? '')) ?></td>
                        <td><code><?= e($a['_id'] ?? '') ?></code></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </section>

    <section class="card">
        <h2>Connect an account</h2>
        <?php if (!$profiles['rows']): ?>
            <p class="muted">Create a <a href="profiles.php">profile</a> first — accounts belong to a profile.</p>
        <?php else: ?>
            <form method="post" action="accounts.php">
                <?= csrf_field() ?>
                <label>Profile
                    <select name="target" required>
                        <option value="">Select a profile…</option>
                        <?php foreach ($profiles['rows'] as $p): ?>
                            <option value="<?= e(($p['_connectionId'] ?? '') . '::' . ($p['_id'] ?? '')) ?>">
                                <?= e($p['name'] ?? '') ?> — <?= e($p['_connectionLabel'] ?? '') ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <label>Platform
                    <select name="platform" required>
                        <?php foreach (zernio_platforms() as $key => $label): ?>
                            <option value="<?= e($key) ?>"><?= e($label) ?></option>
                        <?php endforeach; ?>
                    </select>
                </label>
                <button class="btn btn-primary" type="submit">Get authorization link</button>
            </form>
        <?php endif; ?>
    </section>
</div>

<?php require __DIR__ . '/../includes/footer.php'; ?>
