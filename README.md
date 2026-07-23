# ST0526 CI/CD Project

A Node.js + Express web application with a full CI/CD pipeline, automated testing, and report publishing to GitHub Pages.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [NPM Scripts](#npm-scripts)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Reports](#reports)

---

## Project Overview

This project demonstrates a CRUD web application with a complete CI/CD workflow. It includes:

- RESTful API with error handling
- PostgreSQL database with parameterized queries
- Unit, integration, and end-to-end (E2E) tests
- ESLint + Prettier formatting
- CI pipeline with GitHub Actions (lint → test → report → deploy)
- Reports published to GitHub Pages

---

## Tech Stack

| Category       | Tools                        |
| -------------- | ---------------------------- |
| Runtime        | Node.js                      |
| Framework      | Express                      |
| Database       | PostgreSQL (via `pg` driver) |
| Unit Tests     | Jest, Supertest              |
| E2E Tests      | Playwright (Chromium)        |
| Linting        | ESLint, Prettier             |
| CI/CD          | GitHub Actions               |
| Report Hosting | GitHub Pages                 |

---

## Project Structure

```
├── .github/workflows/
│   ├── ci.yml                  # CI pipeline (lint, test, report, pages)
│   └── cd.yml                  # CD pipeline (deployment placeholder)
├── __tests__/
│   ├── unit/                   # Jest unit tests
│   └── integration/            # Jest + Supertest integration tests
├── configs/
│   ├── eslint.config.mjs       # ESLint config
│   ├── jest-integration-setup.js
│   ├── playwright.config.js    # Playwright E2E config
│   └── playwright-global-setup.js
├── scripts/
│   ├── qa-report.js             # Combined QA report generator
│   ├── reset.js                # Database schema reset (reads schema.sql)
│   ├── seed.js                 # Database seeding with sample data
│   └── clean-test-results.js   # Cleanup stale test results
├── src/
│   ├── app.js                  # Express app (middleware, routes, error handling)
│   ├── server.js               # Server startup + graceful shutdown
│   ├── models/
│   │   ├── db.js               # PostgreSQL connection pool
│   │   ├── Person.model.js     # Person model
│   │   └── Something.model.js  # Something model (full CRUD)
│   ├── routers/
│   │   ├── Person.router.js    # GET /persons
│   │   └── Something.router.js # CRUD /somethings
│   └── public/
│       ├── index.html          # Frontend UI
│       ├── css                 # Frontend styling
|       |   ├── styles.css      # Common styles across multiple pages
|       |   └── specific.css    # For specific CSS files
|       ├── images              # Assets used
|       └── js
|           ├── index.js        # Frontend JavaScript
|           └── script.js       # Common JavaScript file across multiple pages
├── e2e-tests/                  # Playwright E2E test specs
├── schema.sql                  # Database schema (single source of truth)
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** (v22 or later)
- **2 PostgreSQL databases** — one for development, one for testing (e.g. [Neon DB](https://neon.tech))

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd web-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment files

Create two `.env` files in the project root:

**.env.dev** (development)

```
DATABASE_URL=postgresql://<user>:<password>@<host>/<dev-db-name>?sslmode=require
PORT=3000
```

**.env.test** (testing)

```
DATABASE_URL=postgresql://<user>:<password>@<host>/<test-db-name>?sslmode=require
PORT=3001
```

> **Why two databases?** Tests reset the database before each run, so using a separate test database prevents losing your development data.

### 4. Set up the database

```bash
npm run migration:reset
```

This reads `schema.sql` and creates the `Person` and `Something` tables.

### 5. Seed sample data (optional)

```bash
npm run seed
```

Inserts 20 sample persons and 2 sample somethings.

### 6. Start the server

```bash
npm run start
```

The app runs at `http://localhost:3000` by default.

---

## NPM Scripts

| Script                     | Description                              |
| -------------------------- | ---------------------------------------- |
| `npm run start`            | Start the dev server (`.env.dev`)        |
| `npm run seed`             | Seed database with sample data           |
| `npm run migration:reset`  | Reset database schema using `schema.sql` |
| `npm run test`             | Run all tests (unit + integration + E2E) |
| `npm run test:unit`        | Run unit tests only                      |
| `npm run test:integration` | Run integration tests only               |
| `npm run test:e2e`         | Run Playwright E2E tests                 |
| `npm run test:trace`       | Run E2E tests with trace recording       |
| `npm run lint`             | Run ESLint                               |
| `npm run lint:fix`         | Auto-fix lint issues                     |
| `npm run lint:report`      | Generate ESLint HTML report              |
| `npm run format`           | Format code with Prettier                |
| `npm run format:check`     | Check formatting without changes         |
| `npm run report`           | Generate full QA report                  |

---

## API Endpoints

### Somethings (CRUD)

| Method   | Endpoint          | Description        | Status Codes |
| -------- | ----------------- | ------------------ | ------------ |
| `POST`   | `/somethings`     | Create a something | 201          |
| `GET`    | `/somethings`     | Get all somethings | 200          |
| `PUT`    | `/somethings/:id` | Update a something | 200, 404     |
| `DELETE` | `/somethings/:id` | Delete a something | 200, 404     |

### Persons

| Method | Endpoint            | Description      | Status Codes |
| ------ | ------------------- | ---------------- | ------------ |
| `GET`  | `/persons`          | Get all persons  | 200          |
| `GET`  | `/persons/{id}`     | Get person by ID | 200, 404     |
| `POST` | `/persons`          | Create person    | 201          |
| `POST` | `/person/login`     | Person login     | 200, 401     |
| `POST` | `/persons/register` | Register person  | 201          |

### Auth

| Method | Endpoint                | Description                    | Status Codes  |
| ------ | ----------------------- | ------------------------------ | ------------- |
| `GET`  | `/auth/me`              | Get current authenticated user | 200, 401      |
| `GET`  | `/auth/admin/users`     | Get all users (admin)          | 200, 401, 403 |
| `GET`  | `/auth/verify-token`    | Verify authentication token    | 200, 401      |
| `POST` | `/auth/register`        | Register a new user            | 201, 400      |
| `POST` | `/auth/verify-email`    | Verify email address           | 200, 400      |
| `POST` | `/auth/verify-login`    | Verify login code              | 200, 401      |
| `POST` | `/auth/resend-code`     | Resend verification code       | 200, 400      |
| `POST` | `/auth/login`           | Log in user                    | 200, 401      |
| `POST` | `/auth/avatar`          | Upload user avatar             | 200, 400      |
| `POST` | `/auth/pre-token`       | Generate pre-auth token        | 200           |
| `POST` | `/auth/send-token`      | Send authentication token      | 200           |
| `POST` | `/auth/pre-compare`     | Prepare comparison             | 200           |
| `POST` | `/auth/compare-success` | Complete comparison            | 200           |
| `POST` | `/auth/hash`            | Generate hash                  | 200           |

### Calls

| Method | Endpoint      | Description       | Status Codes |
| ------ | ------------- | ----------------- | ------------ |
| `GET`  | `/calls/logs` | Get call logs     | 200          |
| `POST` | `/calls/logs` | Create a call log | 201          |

### Comments

| Method   | Endpoint              | Description             | Status Codes |
| -------- | --------------------- | ----------------------- | ------------ |
| `GET`    | `/comments`           | Get all comments        | 200          |
| `GET`    | `/comments/{post_id}` | Get comments for a post | 200          |
| `POST`   | `/comments/{post_id}` | Create comment          | 201          |
| `PUT`    | `/comments/{id}`      | Update comment          | 200, 404     |
| `DELETE` | `/comments/{id}`      | Delete comment          | 200, 404     |

### Friends

| Method   | Endpoint                          | Description                 | Status Codes |
| -------- | --------------------------------- | --------------------------- | ------------ |
| `GET`    | `/friends/search`                 | Search friends              | 200          |
| `GET`    | `/friends/user/search`            | Search users _(deprecated)_ | 200          |
| `GET`    | `/friends/users/{userId}/profile` | Get user profile            | 200, 404     |
| `GET`    | `/friends`                        | Get friends list            | 200          |
| `GET`    | `/friends/requests`               | Get friend requests         | 200          |
| `POST`   | `/friends/request`                | Send friend request         | 201          |
| `POST`   | `/friends/accept`                 | Accept friend request       | 200          |
| `POST`   | `/friends/decline`                | Decline friend request      | 200          |
| `DELETE` | `/friends/{friendId}`             | Remove friend               | 200, 404     |

### Groups

| Method   | Endpoint                                                          | Description              | Status Codes |
| -------- | ----------------------------------------------------------------- | ------------------------ | ------------ |
| `GET`    | `/groups`                                                         | Get all groups           | 200          |
| `GET`    | `/groups/group/{group_id}`                                        | Get group by ID          | 200, 404     |
| `GET`    | `/groups/creator/{creator_id}`                                    | Get groups by creator    | 200          |
| `GET`    | `/groups/school/{school_name}`                                    | Get groups by school     | 200          |
| `GET`    | `/groups/joined_groups/{user_id}`                                 | Get joined groups        | 200          |
| `GET`    | `/groups/joined/{group_id}`                                       | Get group members        | 200          |
| `GET`    | `/groups/messages/match/{group_id}/{channel_name}/{match_string}` | Search group messages    | 200          |
| `GET`    | `/groups/messages/channel/{group_id}/{channel_name}`              | Get channel messages     | 200          |
| `GET`    | `/groups/messages/channels/{group_id}`                            | Get group channels       | 200          |
| `POST`   | `/groups/create/{creator_id}`                                     | Create group             | 201          |
| `POST`   | `/groups/join/{group_id}`                                         | Join group               | 200          |
| `POST`   | `/groups/messages/send/{user_id}`                                 | Send group message       | 201          |
| `POST`   | `/groups/messages/channel/{user_id}`                              | Create group channel     | 201          |
| `PUT`    | `/groups/name/{group_id}`                                         | Update group name        | 200, 404     |
| `PUT`    | `/groups/description/{group_id}`                                  | Update group description | 200, 404     |
| `PUT`    | `/groups/public/{group_id}`                                       | Update group visibility  | 200, 404     |
| `PUT`    | `/groups/messages/edit/{user_id}`                                 | Edit group message       | 200, 404     |
| `DELETE` | `/groups/{group_id}`                                              | Delete group             | 200, 404     |
| `DELETE` | `/groups/leave/{group_id}`                                        | Leave group              | 200, 404     |
| `DELETE` | `/groups/messages/delete/{user_id}`                               | Delete group message     | 200, 404     |

### Group Tasks

| Method   | Endpoint                                      | Description                             | Status Codes       |
| -------- | --------------------------------------------- | --------------------------------------- | ------------------ |
| `GET`    | `/groupTasks/tasks`                           | Get all tasks                           | 200                |
| `GET`    | `/groupTasks/tasks/group/{group_id}`          | Get tasks for a group                   | 200                |
| `GET`    | `/groupTasks/tasks/user/{group_id}/{user_id}` | Get tasks assigned to a user in a group | 200                |
| `POST`   | `/groupTasks/tasks/{group_id}`                | Create a task                           | 201, 400, 403      |
| `PUT`    | `/groupTasks/tasks/{id}`                      | Update a task                           | 200, 400, 403, 404 |
| `DELETE` | `/groupTasks/tasks/{id}`                      | Delete a task                           | 204, 403           |

### Task Items

| Method   | Endpoint                              | Description               | Status Codes       |
| -------- | ------------------------------------- | ------------------------- | ------------------ |
| `GET`    | `/groupTasks/taskItems`               | Get all task items        | 200                |
| `GET`    | `/groupTasks/taskItems/{task_id}`     | Get task items for a task | 200                |
| `POST`   | `/groupTasks/taskItems/{task_id}`     | Create a task item        | 201, 400, 403      |
| `PUT`    | `/groupTasks/taskItems/{taskId}/{id}` | Update a task item        | 200, 400, 403, 404 |
| `DELETE` | `/groupTasks/taskItems/{id}`          | Delete a task item        | 204, 403           |

### Group Files

| Method   | Endpoint                       | Description                   | Status Codes       |
| -------- | ------------------------------ | ----------------------------- | ------------------ |
| `GET`    | `/groupFiles/files/{group_id}` | Get all files in a group      | 200                |
| `POST`   | `/groupFiles/files/{group_id}` | Upload a file to a group      | 201, 400           |
| `PUT`    | `/groupFiles/files/{id}`       | Move a file to another folder | 200, 400, 403, 404 |
| `DELETE` | `/groupFiles/files/{id}`       | Delete a group file           | 204, 403, 404      |

### Marketplace

| Method   | Endpoint            | Description                | Status Codes |
| -------- | ------------------- | -------------------------- | ------------ |
| `GET`    | `/marketplace`      | Get marketplace listings   | 200          |
| `POST`   | `/marketplace`      | Create marketplace listing | 201          |
| `PUT`    | `/marketplace/{id}` | Update marketplace listing | 200, 404     |
| `DELETE` | `/marketplace/{id}` | Delete marketplace listing | 200, 404     |

### Cart

| Method   | Endpoint                      | Description                        | Status Codes  |
| -------- | ----------------------------- | ---------------------------------- | ------------- |
| `GET`    | `/cart`                       | Get all cart items                 | 200           |
| `GET`    | `/cart/{user_id}`             | Get all cart items for a user      | 200           |
| `POST`   | `/cart/add/{user_id}`         | Add an item to a user's cart       | 201, 400      |
| `PUT`    | `/cart/edit/{id}/{user_id}`   | Update the quantity of a cart item | 200, 400, 404 |
| `DELETE` | `/cart/remove/{id}/{user_id}` | Remove an item from a user's cart  | 200, 404      |
| `DELETE` | `/cart/clear/{user_id}`       | Clear a user's cart                | 200, 404      |

### Tags

| Method | Endpoint                             | Description                              | Status Codes  |
| ------ | ------------------------------------ | ---------------------------------------- | ------------- |
| `GET`  | `/tags/tags`                         | Get all available marketplace tags       | 200, 500      |
| `GET`  | `/tags/marketplace/by-tag/{tagName}` | Get marketplace listings filtered by tag | 200, 500      |
| `PUT`  | `/tags/listings/{id}/tags`           | Update tags for a marketplace listing    | 200, 400, 500 |

### Payments

| Method | Endpoint                | Description                                 | Status Codes  |
| ------ | ----------------------- | ------------------------------------------- | ------------- |
| `POST` | `/payments/checkout`    | Process a mock checkout and create an order | 200, 400, 402 |
| `GET`  | `/payments/orders/{id}` | Get an order and its associated items       | 200, 404      |

### Blocked Users

| Method | Endpoint                                 | Description                                | Status Codes  |
| ------ | ---------------------------------------- | ------------------------------------------ | ------------- |
| `POST` | `/block`                                 | Block another user                         | 201, 200, 400 |
| `GET`  | `/block/check/{blocker_id}/{blocked_id}` | Check whether one user has blocked another | 200           |

### Giphy

| Method | Endpoint                  | Description                                | Status Codes |
| ------ | ------------------------- | ------------------------------------------ | ------------ |
| `GET`  | `/giphy/search?q={query}` | Search GIPHY for GIFs using a search query | 200, 500     |

### Messages

| Method   | Endpoint                          | Description                | Status Codes |
| -------- | --------------------------------- | -------------------------- | ------------ |
| `GET`    | `/messages/contacts`              | Get message contacts       | 200          |
| `GET`    | `/messages/with/{user_id}`        | Get conversation with user | 200          |
| `POST`   | `/messages`                       | Send message               | 201          |
| `POST`   | `/messages/{messageId}/reactions` | Add reaction to message    | 201          |
| `PATCH`  | `/messages/{messageId}`           | Edit message               | 200, 404     |
| `DELETE` | `/messages/{messageId}`           | Delete message             | 200, 404     |
| `DELETE` | `/messages/{messageId}/reactions` | Remove message reaction    | 200, 404     |

### Notifications

| Method  | Endpoint                   | Description                    | Status Codes |
| ------- | -------------------------- | ------------------------------ | ------------ |
| `GET`   | `/notifications`           | Get notifications              | 200          |
| `PATCH` | `/notifications/read-all`  | Mark all notifications as read | 200          |
| `PATCH` | `/notifications/{id}/read` | Mark notification as read      | 200, 404     |

### Posts

| Method   | Endpoint                    | Description                   | Status Codes |
| -------- | --------------------------- | ----------------------------- | ------------ |
| `GET`    | `/posts`                    | Get all posts                 | 200          |
| `GET`    | `/posts/{id}`               | Get post by ID                | 200, 404     |
| `GET`    | `/posts/{tag}/{category}`   | Get posts by tag and category | 200          |
| `GET`    | `/posts/saved/{user_id}`    | Get saved posts               | 200          |
| `GET`    | `/posts/reaction/{user_id}` | Get post reactions            | 200          |
| `POST`   | `/posts`                    | Create post                   | 201          |
| `POST`   | `/posts/saved`              | Save post                     | 201          |
| `POST`   | `/posts/liked`              | Like post                     | 201          |
| `PUT`    | `/posts/{id}`               | Update post                   | 200, 404     |
| `PUT`    | `/posts/reaction/{id}`      | Update post reaction          | 200, 404     |
| `DELETE` | `/posts/{id}`               | Delete post                   | 200, 404     |
| `DELETE` | `/posts/saved/{id}`         | Remove saved post             | 200, 404     |
| `DELETE` | `/posts/reaction/{id}`      | Remove post reaction          | 200, 404     |

### Profile

| Method   | Endpoint                                  | Description                  | Status Codes |
| -------- | ----------------------------------------- | ---------------------------- | ------------ |
| `GET`    | `/profile/{user_id}`                      | Get user profile             | 200, 404     |
| `GET`    | `/profile/me`                             | Get current user's profile   | 200          |
| `GET`    | `/profile/{user_id}/posts`                | Get user's posts             | 200          |
| `GET`    | `/profile/{user_id}/comments`             | Get user's comments          | 200          |
| `GET`    | `/profile/{user_id}/groups`               | Get user's groups            | 200          |
| `GET`    | `/profile/{user_id}/friends`              | Get user's friends           | 200          |
| `GET`    | `/profile/{user_id}/saved-posts`          | Get saved posts              | 200          |
| `GET`    | `/profile/settings`                       | Get profile settings         | 200          |
| `GET`    | `/profile/settings/sessions`              | Get active sessions          | 200          |
| `GET`    | `/profile/settings/export`                | Export account data          | 200          |
| `GET`    | `/profile/payment`                        | Get payment settings         | 200          |
| `GET`    | `/profile/activity`                       | Get account activity         | 200          |
| `GET`    | `/profile/reactions`                      | Get reactions                | 200          |
| `GET`    | `/profile/stats/{user_id}`                | Get profile statistics       | 200          |
| `POST`   | `/profile/saved-posts/{postId}`           | Save post                    | 201          |
| `POST`   | `/profile/settings/password/request-code` | Request password reset code  | 200          |
| `POST`   | `/profile/settings/deactivate`            | Deactivate account           | 200          |
| `POST`   | `/profile/settings/delete`                | Delete account               | 200          |
| `POST`   | `/profile/avatar`                         | Upload avatar                | 200          |
| `PATCH`  | `/profile/me`                             | Update profile               | 200          |
| `PATCH`  | `/profile/settings/account`               | Update account settings      | 200          |
| `PATCH`  | `/profile/settings/security`              | Update security settings     | 200          |
| `PATCH`  | `/profile/settings/notifications`         | Update notification settings | 200          |
| `PATCH`  | `/profile/settings/appearance`            | Update appearance settings   | 200          |
| `PATCH`  | `/profile/settings/privacy`               | Update privacy settings      | 200          |
| `PATCH`  | `/profile/settings/password`              | Update password              | 200          |
| `PATCH`  | `/profile/payment`                        | Update payment settings      | 200          |
| `DELETE` | `/profile/saved-post/{postId}`            | Remove saved post            | 200, 404     |
| `DELETE` | `/profile/settings/sessions/{sessionId}`  | End session                  | 200, 404     |
| `DELETE` | `/profile/avatar`                         | Delete avatar                | 200          |

### Search

| Method | Endpoint  | Description             | Status Codes |
| ------ | --------- | ----------------------- | ------------ |
| `GET`  | `/search` | Search across resources | 200          |

### Stories

| Method | Endpoint   | Description     | Status Codes |
| ------ | ---------- | --------------- | ------------ |
| `GET`  | `/stories` | Get all stories | 200          |
| `POST` | `/stories` | Create a story  | 201          |

### Whiteboards

| Method   | Endpoint                         | Description                               | Status Codes       |
| -------- | -------------------------------- | ----------------------------------------- | ------------------ |
| `GET`    | `/whiteboards`                   | Get all whiteboards                       | 200                |
| `GET`    | `/whiteboards/group/{group_id}`  | Get whiteboards by group                  | 200                |
| `GET`    | `/whiteboards/user`              | Get current user's whiteboards            | 200                |
| `GET`    | `/whiteboards/user/{group_id}`   | Get current user's whiteboards in a group | 200                |
| `GET`    | `/whiteboards/{id}`              | Get whiteboard by ID                      | 200, 404           |
| `POST`   | `/whiteboards`                   | Create a whiteboard                       | 201, 400           |
| `PUT`    | `/whiteboards/{id}/drawing_data` | Update whiteboard drawing data            | 200, 400, 403, 404 |
| `PUT`    | `/whiteboards/{id}/title`        | Rename whiteboard                         | 200, 400, 403, 404 |
| `DELETE` | `/whiteboards/{id}`              | Delete whiteboard                         | 204, 403, 404      |

---

## Testing

### Test Case Design Techniques

| Technique                 | Description                                                           | Used In                |
| ------------------------- | --------------------------------------------------------------------- | ---------------------- |
| Equivalence Partitioning  | Inputs divided into valid and invalid classes, one test per partition | Unit, Integration, E2E |
| Boundary Value Analysis   | Tests at edges of input ranges (e.g. empty string, zero rows, id = 0) | Unit, Integration, E2E |
| Error Handling / Negative | Verifying correct behaviour for invalid inputs and error conditions   | Unit, Integration, E2E |

#### Unit Tests (`__tests__/unit/`)

Tests each model function in isolation with a **mocked database** (`jest.mock`).

| Technique                | Examples                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Equivalence Partitioning | Valid input (normal string), invalid input (null name, wrong type)                           |
| Boundary Value Analysis  | Empty string (shortest valid input), id = 0, negative id, empty data object (zero fields)    |
| Error Handling           | DB constraint violations, connection timeouts, connection loss — all propagate to the caller |

#### Integration Tests (`__tests__/integration/`)

Tests API endpoints against a **real database** using Supertest.

| Technique                | Examples                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Equivalence Partitioning | Valid creation (normal name), valid update, valid deletion, data persists after creation |
| Boundary Value Analysis  | Empty table (zero rows), non-existent id (999999)                                        |
| Error Handling           | 404 for missing resources, unknown routes return 404                                     |

#### End-to-End Tests (`e2e-tests/`)

Tests full user workflows in a **real browser** using Playwright.

| Technique                | Examples                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Equivalence Partitioning | Add single item, add multiple items, delete specific item                                       |
| Boundary Value Analysis  | Empty name (HTML5 validation blocks submit), special characters/XSS, delete all until zero rows |
| Error Handling           | Verify other rows unaffected after deletion, input clears after submit                          |

### Software Quality Tools

| Tool           | Purpose                                | How It's Used                                               |
| -------------- | -------------------------------------- | ----------------------------------------------------------- |
| ESLint         | Static code analysis (linting)         | Catches code errors and enforces coding standards           |
| Prettier       | Code formatting                        | Ensures consistent code style across the project            |
| Jest           | Unit and integration testing framework | Runs tests with mocking, assertions, and coverage reporting |
| Supertest      | HTTP integration testing               | Sends requests to Express routes and asserts responses      |
| Playwright     | End-to-end browser testing             | Automates Chromium to test full user workflows              |
| GitHub Actions | CI/CD automation                       | Runs lint, test, report, and deployment on every push/PR    |

### Test Types

| Type        | Tool             | Location                 | What It Tests                      |
| ----------- | ---------------- | ------------------------ | ---------------------------------- |
| Unit        | Jest             | `__tests__/unit/`        | Models in isolation                |
| Integration | Jest + Supertest | `__tests__/integration/` | API endpoints with a real database |
| E2E         | Playwright       | `e2e-tests/`             | Full user workflows in a browser   |

### Coverage

- Minimum **80%** threshold for branches, functions, lines, and statements
- Coverage reports generated in `coverage-report/`

### Running Tests

```bash
# All tests
npm run test

# Individual test types
npm run test:unit
npm run test:integration
npm run test:e2e
```

---

## CI/CD Pipeline

The CI/CD pipeline runs on every push and pull request to `main`.

### Pipeline Flow

```
Push / PR to main
       │
       ├── lint       (ESLint + Prettier)
       │
       └── test       (unit + integration + E2E)
              │
              │  ── main push only ──
              │
              ├── report   (QA report + artifacts)
              │
              └── pages    (publish reports to GitHub Pages)
```

| Job      | Triggers       | Description                         |
| -------- | -------------- | ----------------------------------- |
| `lint`   | All            | ESLint + Prettier check             |
| `test`   | All            | Unit + integration + E2E            |
| `report` | Main push only | Generate reports + upload artifacts |
| `pages`  | Main push only | Deploy reports to GitHub Pages      |

### Required GitHub Secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret         | Example Value                                            |
| -------------- | -------------------------------------------------------- |
| `DATABASE_URL` | `postgresql://user:password@host/dbname?sslmode=require` |
| `APP_PORT`     | `3001`                                                   |

### GitHub Pages Setup

1. Go to **Settings → Pages**
2. Set **Source** to **GitHub Actions**
3. Reports will be available at `https://<username>.github.io/<repo>/`

---

## Reports

After running `npm run report`, the following reports are generated:

| Report                         | Description                |
| ------------------------------ | -------------------------- |
| `reports/qa-report.html`       | Combined QA report         |
| `reports/eslint-report.html`   | ESLint lint analysis       |
| `coverage-report/index.html`   | HTML code coverage report  |
| `playwright-report/index.html` | Playwright E2E test report |

On push to `main`, these reports are automatically published to GitHub Pages.
