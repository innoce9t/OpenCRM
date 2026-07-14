<?php
require_once __DIR__ . '/../includes/bootstrap.php';

$pageTitle = 'Compose';

$timezones = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'UTC', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

// Accepted media types and a soft per-file size cap (the effective limit is
// PHP's upload_max_filesize / post_max_size — see the note under the field).
const MEDIA_ALLOWED = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm',
];
const MEDIA_MAX_BYTES = 209715200; // 200 MB

/**
 * Pull validated uploads out of $_FILES['media'] into a simple staged list.
 * Returns [staged, errors]. Each staged item: [tmp, name, mime].
 */
function stage_uploads(array $files): array
{
    $staged = [];
    $errors = [];
    if (empty($files['name']) || !is_array($files['name'])) {
        return [$staged, $errors];
    }
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    foreach ($files['name'] as $i => $name) {
        $err = $files['error'][$i] ?? UPLOAD_ERR_NO_FILE;
        if ($err === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if ($err !== UPLOAD_ERR_OK) {
            $errors[] = "\"$name\": upload error (code $err).";
            continue;
        }
        $tmp  = $files['tmp_name'][$i];
        $size = (int) ($files['size'][$i] ?? 0);
        $mime = finfo_file($finfo, $tmp) ?: ($files['type'][$i] ?? '');
        if (!in_array($mime, MEDIA_ALLOWED, true)) {
            $errors[] = "\"$name\": unsupported type ($mime).";
            continue;
        }
        if ($size > MEDIA_MAX_BYTES) {
            $errors[] = "\"$name\": larger than " . (MEDIA_MAX_BYTES / 1048576) . " MB.";
            continue;
        }
        $staged[] = ['tmp' => $tmp, 'name' => $name, 'mime' => $mime];
    }
    finfo_close($finfo);
    return [$staged, $errors];
}

// Load accounts across every connection, grouped by connection for display.
$accountsByConn = [];   // connectionId => ['label' => ..., 'accounts' => [...]]
$loadErrors     = [];
if ($connectionsConfigured) {
    foreach ($connections as $conn) {
        $res = zernio_client($conn)->listAccounts();
        if ($res['error']) {
            $loadErrors[] = $conn['label'] . ': ' . $res['error'];
            continue;
        }
        $list = is_array($res['data']) ? ($res['data']['accounts'] ?? []) : [];
        if ($list) {
            $accountsByConn[$conn['id']] = ['label' => $conn['label'], 'accounts' => $list];
        }
    }
}
$hasAnyAccount = $accountsByConn !== [];

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
    $selected            = $_POST['sel'] ?? []; // each: "connId::accountId::platform"

    [$staged, $mediaErrors] = stage_uploads($_FILES['media'] ?? []);

    $formErrors = $mediaErrors;
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
        // Group the selected accounts by connection: each connection is a
        // separate API key, so we make one createPost call per connection.
        $byConn = []; // connId => [ [platform, accountId], ... ]
        foreach ($selected as $token) {
            $parts = explode('::', (string) $token);
            if (count($parts) !== 3) {
                continue;
            }
            [$connId, $accountId, $platform] = $parts;
            $byConn[$connId][] = ['platform' => $platform, 'accountId' => $accountId];
        }

        // Build the shared post body (everything except platforms).
        $base = ['content' => $old['content']];
        if ($old['mode'] === 'now') {
            $base['publishNow'] = true;
        } elseif ($old['mode'] === 'schedule') {
            $dt = $old['scheduledFor'];
            if (strlen($dt) === 16) { // "Y-m-dTH:i" -> add seconds
                $dt .= ':00';
            }
            $base['scheduledFor'] = $dt;
            $base['timezone']     = $old['timezone'];
        }
        // mode === 'draft' -> neither publishNow nor scheduledFor.

        $ok = 0;
        $fail = [];
        foreach ($byConn as $connId => $platforms) {
            $conn = $store->get($connId);
            if (!$conn) {
                $fail[] = 'unknown connection';
                continue;
            }
            $client = zernio_client($conn);

            // Media is scoped to the API key, so upload it once per connection.
            $mediaRefs = [];
            $mediaFailed = false;
            foreach ($staged as $file) {
                $up = $client->uploadMedia($file['tmp'], $file['name'], $file['mime']);
                $ref = $up['error'] ? null : ZernioClient::extractMediaRef($up['data']);
                if ($ref === null) {
                    $fail[] = $conn['label'] . ': media "' . $file['name'] . '" — '
                        . ($up['error'] ?? 'no id in upload response');
                    $mediaFailed = true;
                    break;
                }
                $mediaRefs[] = $ref;
            }
            if ($mediaFailed) {
                continue; // don't post this connection without its intended media
            }

            $body = $base + ['platforms' => $platforms];
            if ($mediaRefs) {
                $body[ZernioClient::MEDIA_POST_FIELD] = $mediaRefs;
            }

            $res = $client->createPost($body);
            if ($res['error']) {
                $fail[] = $conn['label'] . ': ' . $res['error'];
            } else {
                $ok++;
            }
        }

        $verb = $old['mode'] === 'now' ? 'published' : ($old['mode'] === 'draft' ? 'saved as draft' : 'scheduled');
        if ($ok > 0 && !$fail) {
            flash_set('success', "Post $verb across $ok connection" . ($ok === 1 ? '' : 's') . '.');
            header('Location: index.php');
            exit;
        }
        if ($ok > 0 && $fail) {
            flash_set('warn', "Post $verb on $ok connection(s), but some failed: " . implode(' | ', $fail));
            header('Location: index.php');
            exit;
        }
        flash_set('error', 'Nothing was posted. ' . implode(' | ', $fail));
    } else {
        flash_set('error', implode(' ', $formErrors));
    }
}

require __DIR__ . '/../includes/header.php';
?>

<div class="page-head">
    <h1>Compose a post</h1>
</div>
<p class="muted">Select accounts from any connection — the post is sent to each account's Zernio project.</p>

<?php foreach ($loadErrors as $err): ?>
    <div class="flash flash-error"><?= e($err) ?></div>
<?php endforeach; ?>

<?php if ($connectionsConfigured && !$hasAnyAccount && !$loadErrors): ?>
    <div class="flash flash-warn">
        No connected accounts yet. <a href="accounts.php">Connect an account &rarr;</a>
    </div>
<?php endif; ?>

<form method="post" action="compose.php" class="card compose-form" id="composeForm" enctype="multipart/form-data">
    <?= csrf_field() ?>

    <label>Content
        <textarea name="content" rows="5" placeholder="What do you want to share?"><?= e($old['content']) ?></textarea>
        <span class="char-count" id="charCount">0 characters</span>
    </label>

    <fieldset>
        <legend>Media <span class="muted">(optional)</span></legend>
        <input type="file" name="media[]" id="mediaInput" multiple
               accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm">
        <div class="media-previews" id="mediaPreviews"></div>
        <p class="muted small">
            Images (JPG, PNG, GIF, WebP) and video (MP4, MOV, WebM). Attached to
            every selected account. Large videos may require raising PHP's
            <code>upload_max_filesize</code> / <code>post_max_size</code>.
        </p>
    </fieldset>

    <fieldset>
        <legend>Post to</legend>
        <?php if (!$hasAnyAccount): ?>
            <p class="muted">Connect an account to choose where this posts.</p>
        <?php else: ?>
            <?php foreach ($accountsByConn as $connId => $group): ?>
                <div class="conn-group">
                    <div class="conn-group-head"><span class="tag"><?= e($group['label']) ?></span></div>
                    <div class="account-grid">
                    <?php foreach ($group['accounts'] as $a): ?>
                        <?php
                            $id       = $a['_id'] ?? '';
                            $platform = $a['platform'] ?? '';
                            // Value carries connection + account + platform.
                            $token    = $connId . '::' . $id . '::' . $platform;
                        ?>
                        <label class="account-check">
                            <input type="checkbox" name="sel[]" value="<?= e($token) ?>">
                            <span class="account-name"><?= e($a['name'] ?? ($a['username'] ?? $id)) ?></span>
                            <span class="account-platform"><?= e($platform) ?></span>
                        </label>
                    <?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>
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

    <button class="btn btn-primary" type="submit" <?= $hasAnyAccount ? '' : 'disabled' ?>>Submit post</button>
</form>

<script>
    const textarea = document.querySelector('textarea[name="content"]');
    const counter = document.getElementById('charCount');
    const updateCount = () => { counter.textContent = textarea.value.length + ' characters'; };
    textarea.addEventListener('input', updateCount);
    updateCount();

    const scheduleFields = document.getElementById('scheduleFields');
    const syncMode = () => {
        const mode = document.querySelector('input[name="mode"]:checked').value;
        scheduleFields.style.display = (mode === 'schedule') ? 'flex' : 'none';
    };
    document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', syncMode));
    syncMode();

    // Media thumbnails.
    const mediaInput = document.getElementById('mediaInput');
    const previews = document.getElementById('mediaPreviews');
    mediaInput.addEventListener('change', () => {
        previews.innerHTML = '';
        for (const file of mediaInput.files) {
            const url = URL.createObjectURL(file);
            const box = document.createElement('div');
            box.className = 'media-thumb';
            const el = file.type.startsWith('video/')
                ? Object.assign(document.createElement('video'), { src: url, muted: true })
                : Object.assign(document.createElement('img'), { src: url, alt: file.name });
            const cap = document.createElement('span');
            cap.textContent = file.name;
            box.append(el, cap);
            previews.append(box);
        }
    });
</script>

<?php require __DIR__ . '/../includes/footer.php'; ?>
