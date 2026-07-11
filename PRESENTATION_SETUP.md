# Presentation setup (Windows) — read this first

You had two separate problems:

1. **Wrong folder** — `CA2 Project` is not the git repo. The app is inside `github-projects\ay2627s1-project-class-2b21-group-pineapplepizza`.
2. **`npm` not recognized** — Node.js is not installed, or PowerShell was opened before install (restart terminal after installing).

---

See **PRESENTATION_GUIDE.md** for what to show your teacher and test account passwords.

---

## Step 1 — Install Node.js (one-time)

1. Open https://nodejs.org/
2. Download the **LTS** version (v22+).
3. Run the installer — leave **“Add to PATH”** checked.
4. **Close all PowerShell / VS Code terminals** and open a **new** terminal.

Check it works:

```powershell
node -v
npm -v
```

You should see version numbers (e.g. `v22.x.x` and `10.x.x`). If not, reboot the PC and try again.

---

## Step 2 — Open the correct project folder

In PowerShell:

```powershell
cd "C:\Users\User\OneDrive\Desktop\SP\SP Year2 SEM 1\CICD\CA2 Project\github-projects\ay2627s1-project-class-2b21-group-pineapplepizza"
```

Check you are in the right place (should show `.git`):

```powershell
git status
```

If that works, you are in the project root.

---

## Step 3 — Install packages (first time only)

```powershell
npm install
```

---

## Step 4 — Database config (required)

You need a **PostgreSQL** database (e.g. free account at https://neon.tech).

In the project root, create a file named **`.env.dev`** (same folder as `package.json`):

```
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@YOUR_HOST/YOUR_DATABASE?sslmode=require
PORT=3000
JWT_SECRET=your-secret-for-presentation
```

Replace `YOUR_USER`, `YOUR_PASSWORD`, `YOUR_HOST`, `YOUR_DATABASE` with your Neon (or local Postgres) connection string.

> Copy from `env.dev.example` if that file exists and fill in your values.

---

## Step 5 — Create tables and demo data

Run **in order** (stay in the project folder):

```powershell
npm run migration:reset
npm run seed
```

---

## Step 6 — Start the server (keep this window open)

```powershell
npm start
```

Wait until you see: **`App listening on port 3000`**

Do **not** close this terminal during your presentation.

---

## Step 7 — Open the app in the browser

Use **only this URL** (simplest — no Live Server needed):

**http://localhost:3000/home.html**

---

## Demo accounts (after `npm run seed`)

| Role    | Username | Password      | Goes to         |
| ------- | -------- | ------------- | --------------- |
| Admin   | `Admin`  | `admin123`    | Admin dashboard |
| Student | `Alice`  | `password123` | Profile page    |
| Student | `Bob`    | `password123` | Profile page    |

Or click **Register** and create your own account.

---

## What to show in your presentation

1. **Home** — Register / Log in (JWT auth).
2. **Profile** (must be logged in):
   - Stats board
   - **Settings** — personal info + payment details
   - **Friends** — add/remove
   - **Saved posts** / **Post history** / **Study groups**
   - **Chatroom** — public messages
   - **Messages** — private DM between two users (log in as Alice, message Bob; then log in as Bob to see received)
3. **Admin** — log in as `Admin` / `admin123` — user list (students cannot open this page).

---

## Quick troubleshooting

| Error                         | Fix                                                          |
| ----------------------------- | ------------------------------------------------------------ |
| `npm is not recognized`       | Install Node.js LTS, restart terminal                        |
| `fatal: not a git repository` | `cd` into `ay2627s1-project-class-2b21-group-pineapplepizza` |
| `Failed to fetch` on register | Run `npm start` and use `http://localhost:3000/home.html`    |
| Database connection error     | Check `.env.dev` and `DATABASE_URL`                          |
| Port 3000 in use              | Close other `node` windows or change `PORT` in `.env.dev`    |

---

## Optional: double-click start (Windows)

After Node is installed, you can run **`start-app.bat`** in the project folder (starts the server if `.env.dev` exists).
