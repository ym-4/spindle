# Campus Hub — Presentation Guide

## App name

**Campus Hub** — student social platform (posts, groups, marketplace, messaging).

---

## How to run (for teacher demo)

1. Install **Node.js LTS** from https://nodejs.org/
2. Open terminal in project folder:
   `ay2627s1-project-class-2b21-group-pineapplepizza`
3. Create `.env.dev` with your PostgreSQL `DATABASE_URL` (see `env.dev.example`)
4. Run:
   ```bash
   npm install
   npm run migration:reset
   npm run seed
   npm start
   ```
5. Browser: **http://localhost:3000/home.html**

---

## Test accounts (after seed)

| Role    | Username | Password    |
| ------- | -------- | ----------- |
| Student | Alice    | password123 |
| Student | Bob      | password123 |
| Admin   | Admin    | admin123    |

Or use **Register** to create a new account.

---

## What to demonstrate

### 1. Authentication

- **Register** — new user with username, email, password
- **Log in** — JWT token, session stored securely
- **Log out** — clears session
- Protected pages: profile, marketplace, admin require login

### 2. Profile page (students)

- Stats: posts, comments, friends, groups, marketplace listings
- **Settings** — name, avatar, bio, phone, campus
- **Payment details** — billing info for marketplace
- **Friends** — add / remove classmates
- **Saved posts** — bookmarked discussion posts
- **Post history** — user’s own wall posts
- **Study groups** — joined groups
- **Campus chatroom** — public messages
- **Private messages (DMs)** — one-to-one chat; Alice sends, Bob receives

### 3. Admin dashboard

- Only **admin** role can access `admin.html`
- Lists all registered users (id, name, email, role)

### 4. Security

- Profile / marketplace redirect to login if not signed in
- Admin page blocked for normal students
- API uses JWT middleware on protected routes

---

## Tech stack

- **Frontend:** HTML, CSS, JavaScript (gamified UI)
- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **Auth:** JWT, scrypt password hashing
- **Tests:** Jest integration tests (auth, profile, messages)

---

## Main files (for questions)

| Feature          | Files                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| Home / login UI  | `src/public/home.html`, `js/auth.js`                                     |
| Profile UI       | `src/public/profile.html`, `js/profile.js`, `js/profile-sections.js`     |
| Private messages | `js/messages.js`, `routers/Message.router.js`, `models/Message.model.js` |
| Profile API      | `routers/Profile.router.js`, `models/Profile.model.js`                   |
| Auth API         | `routers/Auth.router.js`, `models/Auth.model.js`                         |
| Database schema  | `schema.sql`                                                             |
| Seed data        | `scripts/seed.js`                                                        |

---

## API routes (summary)

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET /auth/admin/users` (admin only)
- `GET/PUT /profile/settings`, `GET/PUT /profile/payment`
- `GET/POST/DELETE /profile/friends`
- `GET /profile/saved-posts`, `GET /profile/posts`, `GET /profile/groups`
- `GET/POST /profile/chatroom`
- `GET /messages/contacts`, `GET /messages/with/:userId`, `POST /messages`

---

## Private messaging demo script

1. Log in as **Alice** → Profile → **DMs** tab → select **Bob** → send message (shows **Sent**)
2. Log out → Log in as **Bob** → **DMs** → **Alice** → same message shows **Received**
