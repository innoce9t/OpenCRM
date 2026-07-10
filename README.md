# OpenCRM

An open-source CRM with a monday.com-style board interface. Built with React and Node.js.

![screenshot](docs/screenshot-table.png)

## Features

- **Boards** — organize your pipeline into boards (Sales Pipeline, Leads, Contacts out of the box)
- **Groups & items** — colored, collapsible groups of rows, just like monday.com
- **Column types** — status, priority, people, date, numbers, and text
- **Inline editing** — click any cell to edit; status and people cells open pickers
- **Group summaries** — status distribution strips and number-column sums per group
- **Kanban view** — drag cards between status lanes
- **Search** — filter items across the current board
- **Persistence** — a simple JSON-file datastore behind a REST API

## Stack

| Layer    | Tech                              |
| -------- | --------------------------------- |
| Frontend | React 18 + Vite                   |
| Backend  | Node.js + Express                 |
| Storage  | JSON file (`server/data/db.json`) |

## Getting started

```bash
npm install
npm run dev
```

- Client (Vite dev server): http://localhost:5173
- API: http://localhost:4000

The client dev server proxies `/api/*` to the API.

### Production

```bash
npm run build   # builds the client into client/dist
npm start       # serves API + built client on http://localhost:4000
```

The database seeds itself with demo data on first run. Delete `server/data/db.json` to reset.

## API overview

| Method | Path                                     | Purpose                    |
| ------ | ---------------------------------------- | -------------------------- |
| GET    | `/api/boards`                            | List boards                |
| POST   | `/api/boards`                            | Create board               |
| GET    | `/api/boards/:id`                        | Full board (groups, items) |
| PATCH  | `/api/boards/:id`                        | Rename board               |
| DELETE | `/api/boards/:id`                        | Delete board               |
| POST   | `/api/boards/:id/groups`                 | Add group                  |
| PATCH  | `/api/boards/:id/groups/:gid`            | Rename/collapse group      |
| POST   | `/api/boards/:id/groups/:gid/items`      | Add item                   |
| PATCH  | `/api/boards/:id/items/:iid`             | Rename item / set values   |
| POST   | `/api/boards/:id/items/:iid/move`        | Move item between groups   |
| POST   | `/api/boards/:id/columns`                | Add column                 |

## License

[AGPL-3.0](LICENSE)
