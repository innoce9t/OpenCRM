<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$pageTitle = 'Connections';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) {
        flash_set('error', 'Invalid session token. Please try again.');
        header('Location: connections.php');
        exit;
    }

    $action = $_POST['action'] ?? '';

    if ($action === 'add') {
        $label   = trim($_POST['label'] ?? '');
        $apiKey  = trim($_POST['apiKey'] ?? '');
        $baseUrl = trim($_POST['baseUrl'] ?? '');

        if ($label === '' || $apiKey === '') {
            flash_set('error', 'Both a label and an API key are required.');
        } elseif ($store->hasKey($apiKey)) {
            flash_set('error', 'That API key is already connected.');
        } else {
            // Validate the key with a lightweight call before saving.
            $probe = zernio_client([
                'apiKey'  => $apiKey,
                'baseUrl' => $baseUrl !== '' ? $baseUrl : 'https://zernio.com/api/v1',
            ])->listProfiles();

            $isAuthError = in_array($probe['status'], [401, 403], true);
            if ($isAuthError) {
                flash_set('error', 'Zernio rejected that key (' . $probe['status'] . '). Double-check it and try again.');
            } else {
                try {
                    $store->add($label, $apiKey, $baseUrl);
                    $note = $probe['error']
                        ? ' (couldn\'t verify right now: ' . $probe['error'] . ')'
                        : '';
                    flash_set('success', 'Connected "' . $label . '".' . $note);
                } catch (Throwable $ex) {
                    flash_set('error', 'Could not save connection: ' . $ex->getMessage());
                }
            }
        }
    } elseif ($action === 'remove') {
        $id = $_POST['id'] ?? '';
        $store->remove($id);
        flash_set('success', 'Connection removed.');
    }

    header('Location: connections.php');
    exit;
}

// Health-check each connection so the user can see which keys are live.
$health = [];
foreach ($connections as $conn) {
    $res = zernio_client($conn)->listProfiles();
    if ($res['error']) {
        $health[$conn['id']] = ['ok' => false, 'text' => $res['error']];
    } else {
        $count = is_array($res['data']) ? count($res['data']['profiles'] ?? []) : 0;
        $health[$conn['id']] = ['ok' => true, 'text' => $count . ' profile' . ($count === 1 ? '' : 's')];
    }
}

require __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <h1>Connections</h1>
</div>
<p class="muted">
    Add a Zernio API key for each account you manage. Every screen — dashboard,
    accounts, profiles, and compose — combines data across all connections.
</p>

<div class="grid-2">
    <section class="card">
        <h2>Connected accounts (<?= count($connections) ?>)</h2>
        <?php if (!$connections): ?>
            <p class="muted">No connections yet. Add one on the right to get started.</p>
        <?php else: ?>
            <table class="table">
                <thead><tr><th>Label</th><th>Key</th><th>Status</th><th></th></tr></thead>
                <tbody>
                <?php foreach ($connections as $conn): ?>
                    <?php $h = $health[$conn['id']] ?? ['ok' => false, 'text' => 'unknown']; ?>
                    <tr>
                        <td><?= e($conn['label']) ?></td>
                        <td><code><?= e(mask_key($conn['apiKey'])) ?></code></td>
                        <td>
                            <span class="pill <?= $h['ok'] ? 'pill-published' : 'pill-failed' ?>">
                                <?= $h['ok'] ? 'live' : 'error' ?>
                            </span>
                            <span class="muted health-note"><?= e($h['text']) ?></span>
                        </td>
                        <td>
                            <form method="post" action="connections.php" class="inline"
                                  onsubmit="return confirm('Remove this connection?');">
                                <?= csrf_field() ?>
                                <input type="hidden" name="action" value="remove">
                                <input type="hidden" name="id" value="<?= e($conn['id']) ?>">
                                <button class="btn btn-danger btn-sm" type="submit">Remove</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </section>

    <section class="card">
        <h2>Add a connection</h2>
        <form method="post" action="connections.php">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="add">
            <label>Label
                <input type="text" name="label" required placeholder="e.g. Client A / Personal">
            </label>
            <label>API key
                <input type="text" name="apiKey" required placeholder="sk_…" autocomplete="off">
            </label>
            <label>Base URL <span class="muted">(optional)</span>
                <input type="text" name="baseUrl" placeholder="https://zernio.com/api/v1">
            </label>
            <button class="btn btn-primary" type="submit">Add connection</button>
        </form>
        <p class="muted small">
            The key is verified with Zernio before it's saved, then stored locally in
            <code>data/connections.json</code> (git-ignored).
        </p>
    </section>
</div>

<?php require __DIR__ . '/../includes/footer.php'; ?>
