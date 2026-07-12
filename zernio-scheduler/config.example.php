<?php

/**
 * Copy this file to config.php and fill in your API key.
 *
 *   cp config.example.php config.php
 *
 * config.php is git-ignored so your key never gets committed.
 *
 * You can also leave this as-is and set the ZERNIO_API_KEY environment
 * variable instead (it takes precedence).
 */

return [
    // Your Zernio API key: "sk_" followed by 64 hex characters.
    'api_key'  => 'sk_replace_me',

    // API base URL. Only change this if you're pointing at a staging host.
    'base_url' => 'https://zernio.com/api/v1',
];
