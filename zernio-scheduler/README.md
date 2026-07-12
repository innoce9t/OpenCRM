# Zernio Scheduler

A small, self-contained **PHP + HTML** post scheduler for the
[Zernio API](https://docs.zernio.com). Connect social accounts, compose
content, and schedule / publish / draft posts across every platform Zernio
supports — from one dashboard.

This is a standalone app. It has **no dependencies** (it calls the Zernio REST
API directly with cURL) and no database — all state lives in Zernio.

## Screens

- **Dashboard** — counts of profiles, accounts, and a list of recent posts.
- **Compose** — write a post, pick accounts, and schedule / publish now / save as draft.
- **Accounts** — list connected accounts and start OAuth connections.
- **Profiles** — list and create profiles (the containers that group accounts).

## Requirements

- PHP 8.0+ with the cURL extension (bundled with most PHP installs).
- A Zernio API key (`Settings → API Keys` in your Zernio account).

## Setup

1. Add your API key. Either copy the example config:

   ```bash
   cp config.example.php config.php
   # then edit config.php and paste your sk_... key
   ```

   …or set an environment variable (takes precedence over `config.php`):

   ```bash
   export ZERNIO_API_KEY="sk_your_key_here"
   ```

2. Serve the `public/` directory with PHP's built-in server:

   ```bash
   php -S localhost:8000 -t public
   ```

3. Open <http://localhost:8000> in your browser.

## How it maps to the Zernio API

| Screen   | Endpoint(s) used                                             |
|----------|--------------------------------------------------------------|
| Profiles | `GET /profiles`, `POST /profiles`                            |
| Accounts | `GET /accounts`, `GET /connect/{platform}?profileId=…`      |
| Compose  | `POST /posts` (with `publishNow`, `scheduledFor`, or neither for a draft) |
| Dashboard| `GET /profiles`, `GET /accounts`, `GET /posts`              |

All requests send `Authorization: Bearer <api_key>`. See
[`src/ZernioClient.php`](src/ZernioClient.php) for the full HTTP layer.

## Project layout

```
zernio-scheduler/
├── config.example.php      # copy to config.php and add your key
├── src/ZernioClient.php     # cURL wrapper around the REST API
├── includes/                # bootstrap, layout, helpers (config, CSRF, flash)
└── public/                  # web root — one PHP file per screen + assets/
```

## Security notes

- `config.php` is git-ignored so your key stays out of version control.
- All state-changing forms use a CSRF token and all output is HTML-escaped.
- Keys are only ever sent to `https://zernio.com`.

## Deploying

Point any PHP-capable host (Apache, Nginx + PHP-FPM, a shared host, etc.) at
the `public/` directory as the web root, and set `ZERNIO_API_KEY` in the
environment.
