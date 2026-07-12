<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$pageTitle = 'Accounts';

$connectUrl = null;

// Handle "connect account" — fetches an OAuth authorization URL to open.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) {
        flash_set('error', 'Invalid session token. Please try again.');
        header('Location: accounts.php');
        exit;
    }
    $platform  = trim($_POST['platform'] ?? '');
    $profileId = trim($_POST['profileId'] ?? '');
    if ($platform === '' || $profileId === '') {
        flash_set('error', 'Pick both a platform and a profile.');
        header('Location: accounts.php');
        exit;
    }
    $res = $zernio->getConnectUrl($platform, $profileId);
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
    // Fall through to render the page with the connect link shown.
}

$accounts = [];
$profiles = [];
$loadError = null;
if ($zernioConfigured) {
    $res = $zernio->listAccounts();
    if ($res['error']) {
        $loadError = $res['error'];
    } elseif (is_array($res['data'])) {
        $accounts = $res['data']['accounts'] ?? [];
    }

    $res = $zernio->listProfiles();
    if (!$res['error'] && is_array($res['data'])) {
        $profiles = $res['data']['profiles'] ?? (is_array($res['data']) ? $res['data'] : []);
    }
}

require __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <h1>Accounts</h1>
</div>

<?php if ($loadError): ?>
    <div class="flash flash-error"><?= e($loadError) ?></div>
<?php endif; ?>

<?php if ($connectUrl): ?>
    <div class="flash flash-success">
        Authorization ready — <a href="<?= e($connectUrl) ?>" target="_blank" rel="noopener">open this link</a>
        to authorize Zernio, then return here and refresh.
    </div>
<?php endif; ?>

<div class="grid-2">
    <section class="card">
        <h2>Connected accounts</h2>
        <?php if (!$accounts): ?>
            <p class="muted">No accounts connected yet.</p>
        <?php else: ?>
            <table class="table">
                <thead><tr><th>Platform</th><th>Name</th><th>ID</th></tr></thead>
                <tbody>
                <?php foreach ($accounts as $a): ?>
                    <tr>
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
        <?php if (!$profiles): ?>
            <p class="muted">Create a <a href="profiles.php">profile</a> first — accounts belong to a profile.</p>
        <?php else: ?>
            <form method="post" action="accounts.php">
                <?= csrf_field() ?>
                <label>Profile
                    <select name="profileId" required>
                        <option value="">Select a profile…</option>
                        <?php foreach ($profiles as $p): ?>
                            <option value="<?= e($p['_id'] ?? '') ?>"><?= e($p['name'] ?? '') ?></option>
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
