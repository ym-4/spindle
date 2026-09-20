# ST0526 — CI/CD Web Application

An attractive, review-ready backend project showcasing modern engineering practices: a feature-rich Node.js API, PostgreSQL persistence, end-to-end test automation and a complete CI pipeline.

Preview (styled): open [docs/overview.html](docs/overview.html) in your browser or enable GitHub Pages for the `docs/` folder to present this page to reviewers.

---

## Quicklinks

- App entry: [src/server.js](src/server.js)
- App wiring: [src/app.js](src/app.js)
- Database schema: [schema.sql](schema.sql)
- Tests: `__tests__/` and `e2e-tests/`
- Styled showcase: [docs/overview.html](docs/overview.html)

---

## Features

- Authentication & verification flows (email tokens, session handling)
- Profiles, avatars, and full account settings
- Messaging and realtime presence (WebSocket hub)
- Social feed: posts, comments, likes, saves
- Groups & channels with collaborative whiteboards and file uploads
- Marketplace: listings, tags and cart workflows
- Database migrations (`schema.sql`) and seed scripts

---

## User capabilities & example workflows

This section expands on the features above and explains the user-facing actions and common flows you can demo.

- Account lifecycle
  - Register with email, verify via token, login to receive a session or token, update profile, upload avatar, request password reset, and export or deactivate an account.

- Content creation & interactions
  - Create, edit and delete posts (text + images), add tags and categories, save posts for later, and view a personalized feed.
  - Comment on posts, edit/delete comments, and react to posts and comments with reactions.

- Social & discovery
  - Search for users and content, send and accept friend requests, view friend lists, and follow or join public groups.

- Groups & collaboration
  - Create groups (public/private), manage membership, create group channels and send messages, and upload files to group storage.
  - Use collaborative whiteboards to draw or annotate; drawing data is saved via API and can be replayed or synchronized across clients.

- Real-time messaging
  - Open conversations, send messages, edit or delete messages, and add/remove reactions. The WebSocket hub supports presence and live updates across clients.

- Marketplace & checkout
  - Create listings with tags and images, browse and filter marketplace items, add items to a cart, update quantities, and perform a mock checkout to create an order record.

- Project / task management
  - Create group tasks, add and assign task items, update status and due dates, and query tasks per group or per user.

## Tech stack

- Node.js & Express
- PostgreSQL (`pg`)
- WebSocket: `ws`
- Testing: Jest, Supertest, Playwright
- Linting & formatting: ESLint, Prettier
- CI: GitHub Actions; reports published to GitHub Pages

---

## Quickstart (local)

1. Clone and install

```bash
git clone <your-repo-url>
cd ay2627s1-project-class-2b21-group-pineapplepizza
npm install
```

2. Create `.env.dev` and `.env.test` in the repo root (examples in the original README).

3. Initialize DB and seed (optional)

```bash
npm run migration:reset
npm run seed
```

4. Start server

```bash
npm run start
```

WebSocket endpoint: `ws://localhost:<port>/ws`.

---

## Helpful scripts

- `npm run start` — run server (`.env.dev`)
- `npm run migration:reset` — apply `schema.sql`
- `npm run seed` — populate sample data
- `npm run test` — unit + integration + E2E
- `npm run lint` / `npm run lint:fix` — linting
- `npm run format` — Prettier

Full scripts are defined in [package.json](package.json).

---

## API overview

Routes are organized in `src/routers/`. Key groups:

- Authentication: `/auth` (login, register, token verification, avatar upload)
- Users/Profiles: `/persons`, `/profile`
- Posts & Comments: `/posts`, `/comments`
- Messaging: `/messages`
- Groups & Channels: `/groups`
- Marketplace & Cart: `/marketplace`, `/cart`

Open the router files (for example [src/app.js](src/app.js) and files under [src/routers](src/routers)) for exact endpoints and usage.

---

## Developer notes

- App wiring & middleware: [src/app.js](src/app.js)
- Server start & graceful shutdown: [src/server.js](src/server.js)
- WebSocket hub: [src/realtime/wsHub.js](src/realtime/wsHub.js)
- Public demo UI: [src/public/](src/public/)

Enable GitHub Pages for `docs/` to present the styled overview to non-technical reviewers.

---

## Testing & CI

- Unit: `__tests__/unit/` (Jest + mocks)
- Integration: `__tests__/integration/` (Jest + Supertest)
- E2E: `e2e-tests/` (Playwright)

CI (GitHub Actions) runs linting, tests and generates QA artifacts. Reports are placed in `reports/` and `coverage-report/`.

Run tests locally:

```bash
npm run test
```
