# Zernio Scheduler

A small, self-contained **PHP + HTML** post scheduler for the
[Zernio API](https://docs.zernio.com). Add API keys from **multiple Zernio
accounts** and manage them all from one **unified dashboard** — connect social
accounts, compose content, and schedule / publish / draft posts across every
platform Zernio supports.

This is a standalone app. It has **no dependencies** (it calls the Zernio REST
API directly with cURL) and no database — connections are stored in a local
JSON file and all other state lives in Zernio.

## Unified, multi-account

Add one **connection** (API key) per Zernio account on the Connections screen.
Every other screen then aggregates across all of them:

- The dashboard totals and post list span all accounts.
- Accounts and profiles are listed with an **Account** column showing which
  connection they belong to.
- In Compose you can tick accounts from **different Zernio accounts at once** —
  the app sends one `POST /posts` per connection using that connection's key.

## Screens

- **Dashboard** — combined counts and recent posts across all connections.
- **Compose** — write a post, pick accounts from any connection, and schedule / publish now / save as draft.
- **Accounts** — list connected social accounts and start OAuth connections.
- **Profiles** — list and create profiles (the containers that group accounts).
- **Connections** — add / remove Zernio API keys, each health-checked live.

## Requirements

- PHP 8.0+ with the cURL extension (bundled with most PHP installs).
- A Zernio API key (`Settings → API Keys` in your Zernio account).

## Setup

1. Serve the `public/` directory with PHP's built-in server:

   ```bash
   php -S localhost:8000 -t public
   ```

2. Open <http://localhost:8000>, go to **Connections**, and add an API key
   for each Zernio account you manage (Zernio: `Settings → API Keys`). Keys are
   verified with Zernio before they're saved and stored locally in
   `data/connections.json` (git-ignored, `0600`).

### Optional: seed a first connection

If you'd rather not use the UI for the first key, set an environment variable
(or copy `config.example.php` to `config.php`) — on first run it's imported as a
connection labelled "Default":

```bash
export ZERNIO_API_KEY="sk_your_key_here"
```

## How it maps to the Zernio API

| Screen      | Endpoint(s) used                                             |
|-------------|--------------------------------------------------------------|
| Connections | `GET /profiles` (used as a health check when saving a key)  |
| Profiles    | `GET /profiles`, `POST /profiles`                           |
| Accounts    | `GET /accounts`, `GET /connect/{platform}?profileId=…`     |
| Compose     | `POST /posts` (once per selected connection; with `publishNow`, `scheduledFor`, or neither for a draft) |
| Dashboard   | `GET /profiles`, `GET /accounts`, `GET /posts`             |

Each connection's calls use that connection's own API key.

All requests send `Authorization: Bearer <api_key>`. See
[`src/ZernioClient.php`](src/ZernioClient.php) for the full HTTP layer.

## Project layout

```
zernio-scheduler/
├── config.example.php       # optional: seed the first connection
├── src/ZernioClient.php      # cURL wrapper around the REST API
├── src/ConnectionStore.php   # stores the list of API keys (data/connections.json)
├── includes/                 # bootstrap, layout, helpers (aggregation, CSRF, flash)
├── data/                     # created at runtime; holds connections.json (git-ignored)
└── public/                   # web root — one PHP file per screen + assets/
```

## Security notes

- `data/connections.json` (your keys) and `config.php` are git-ignored, so keys
  stay out of version control. The connections file is written with `0600` perms.
- All state-changing forms use a CSRF token and all output is HTML-escaped.
- Keys are only ever sent to their connection's base URL (`https://zernio.com` by default).

## Deploying

Point any PHP-capable host (Apache, Nginx + PHP-FPM, a shared host, etc.) at
the `public/` directory as the web root, and set `ZERNIO_API_KEY` in the
environment.
