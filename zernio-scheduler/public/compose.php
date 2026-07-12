<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$pageTitle = 'Compose';

/** Common timezones offered in the picker. */
$timezones = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'UTC', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

// Load accounts so the user can pick where to post.
$accounts  = [];
$loadError = null;
if ($zernioConfigured) {
    $res = $zernio->listAccounts();
    if ($res['error']) {
        $loadError = $res['error'];
    } elseif (is_array($res['data'])) {
        $accounts = $res['data']['accounts'] ?? [];
    }
}

// Keep submitted values so the form can be re-rendered on error.
$old = ['content' => '', 'mode' => 'schedule', 'scheduledFor' => '', 'timezone' => 'America/New_York'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) {
        flash_set('error', 'Invalid session token. Please try again.');
        header('Location: compose.php');
        exit;
    }

    $old['content']      = trim($_POST['content'] ?? '');
    $old['mode']         = $_POST['mode'] ?? 'schedule';
    $old['scheduledFor'] = trim($_POST['scheduledFor'] ?? '');
    $old['timezone']     = $_POST['timezone'] ?? 'America/New_York';
    $selected            = $_POST['accounts'] ?? []; // accountId => platform

    $formErrors = [];
    if ($old['content'] === '') {
        $formErrors[] = 'Post content cannot be empty.';
    }
    if (!is_array($selected) || $selected === []) {
        $formErrors[] = 'Select at least one account to post to.';
    }
    if ($old['mode'] === 'schedule' && $old['scheduledFor'] === '') {
        $formErrors[] = 'Pick a date and time to schedule for.';
    }

    if (!$formErrors) {
        // Build the platforms array the API expects: [{platform, accountId}].
        $platforms = [];
        foreach ($selected as $accountId => $platform) {
            $platforms[] = [
                'platform'  => (string) $platform,
                'accountId' => (string) $accountId,
            ];
        }

        $body = [
            'content'   => $old['content'],
            'platforms' => $platforms,
        ];

        if ($old['mode'] === 'now') {
            $body['publishNow'] = true;
        } elseif ($old['mode'] === 'schedule') {
            // datetime-local gives "Y-m-dTH:i"; normalize to seconds precision.
            $dt = $old['scheduledFor'];
            if (strlen($dt) === 16) {
                $dt .= ':00';
            }
            $body['scheduledFor'] = $dt;
            $body['timezone']     = $old['timezone'];
        }
        // mode === 'draft' -> neither publishNow nor scheduledFor.

        $res = $zernio->createPost($body);
        if ($res['error']) {
            flash_set('error', 'Could not create post: ' . $res['error']);
        } else {
            $label = $old['mode'] === 'now' ? 'published' : ($old['mode'] === 'draft' ? 'saved as draft' : 'scheduled');
            flash_set('success', 'Post ' . $label . ' successfully.');
            header('Location: index.php');
            exit;
        }
    } else {
        flash_set('error', implode(' ', $formErrors));
    }
}

require __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <h1>Compose a post</h1>
</div>

<?php if ($loadError): ?>
    <div class="flash flash-error"><?= e($loadError) ?></div>
<?php endif; ?>

<?php if ($zernioConfigured && !$accounts && !$loadError): ?>
    <div class="flash flash-warn">
        No connected accounts yet. <a href="accounts.php">Connect an account &rarr;</a>
    </div>
<?php endif; ?>

<form method="post" action="compose.php" class="card compose-form" id="composeForm">
    <?= csrf_field() ?>

    <label>Content
        <textarea name="content" rows="5" placeholder="What do you want to share?"><?= e($old['content']) ?></textarea>
        <span class="char-count" id="charCount">0 characters</span>
    </label>

    <fieldset>
        <legend>Post to</legend>
        <?php if (!$accounts): ?>
            <p class="muted">Connect an account to choose where this posts.</p>
        <?php else: ?>
            <div class="account-grid">
            <?php foreach ($accounts as $a): ?>
                <?php $id = $a['_id'] ?? ''; $platform = $a['platform'] ?? ''; ?>
                <label class="account-check">
                    <input type="checkbox" name="accounts[<?= e($id) ?>]" value="<?= e($platform) ?>">
                    <span class="account-name"><?= e($a['name'] ?? ($a['username'] ?? $id)) ?></span>
                    <span class="account-platform"><?= e($platform) ?></span>
                </label>
            <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </fieldset>

    <fieldset>
        <legend>When</legend>
        <div class="radio-row">
            <label class="radio"><input type="radio" name="mode" value="schedule" <?= $old['mode'] === 'schedule' ? 'checked' : '' ?>> Schedule</label>
            <label class="radio"><input type="radio" name="mode" value="now" <?= $old['mode'] === 'now' ? 'checked' : '' ?>> Publish now</label>
            <label class="radio"><input type="radio" name="mode" value="draft" <?= $old['mode'] === 'draft' ? 'checked' : '' ?>> Save as draft</label>
        </div>

        <div class="schedule-fields" id="scheduleFields">
            <label>Date &amp; time
                <input type="datetime-local" name="scheduledFor" value="<?= e($old['scheduledFor']) ?>">
            </label>
            <label>Timezone
                <select name="timezone">
                    <?php foreach ($timezones as $tz): ?>
                        <option value="<?= e($tz) ?>" <?= $old['timezone'] === $tz ? 'selected' : '' ?>><?= e($tz) ?></option>
                    <?php endforeach; ?>
                </select>
            </label>
        </div>
    </fieldset>

    <button class="btn btn-primary" type="submit" <?= $zernioConfigured && $accounts ? '' : 'disabled' ?>>
        Submit post
    </button>
</form>

<script>
    // Character counter.
    const textarea = document.querySelector('textarea[name="content"]');
    const counter = document.getElementById('charCount');
    const updateCount = () => { counter.textContent = textarea.value.length + ' characters'; };
    textarea.addEventListener('input', updateCount);
    updateCount();

    // Show/hide the schedule fields based on the selected mode.
    const scheduleFields = document.getElementById('scheduleFields');
    const syncMode = () => {
        const mode = document.querySelector('input[name="mode"]:checked').value;
        scheduleFields.style.display = (mode === 'schedule') ? 'flex' : 'none';
    };
    document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', syncMode));
    syncMode();
</script>

<?php require __DIR__ . '/../includes/footer.php'; ?>
