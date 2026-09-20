# 🐼 SPindle

<p align="center">
  <img src="src/public/images/Logo_Panda.png" alt="SPindle Logo" width="120">
</p>

<h3 align="center">Singapore Polytechnic's Student Social Platform</h3>

<p align="center">
  A full-stack social platform where students can connect, discuss, collaborate, discover resources, and interact with the SP community.
</p>

<p align="center">
  <a href="https://ay2627s1-project-class-2b21-group.onrender.com/home.html?login=1&tab=login&return=index.html">🚀 Try SPindle</a>
</p>

---

## 📌 About the Project

**SPindle** is a full-stack social platform designed specifically for the Singapore Polytechnic community. It brings together discussion forums, Q&A, study groups, a student marketplace, notifications, profiles, and social interactions into one centralized platform.

The project was developed with a focus on **real-world software engineering practices**, going beyond basic CRUD functionality to include authentication, relational database design, advanced search, analytics, automated testing, CI/CD, and an AI-powered assistant.

SPindle was developed iteratively using **GitHub Flow**, with feature branches, pull requests, code reviews, automated testing, and continuous integration throughout development.

---

## ✨ Features

### 💬 Community & Discussions

- Create, edit and delete discussion posts
- Discussion categories including Q&A and General Talk
- Comments with sorting and filtering
- Like and dislike reactions
- Poll-based posts and voting
- Post and comment tags
- GIFs and attachments
- Saved posts and comments
- Recently viewed posts
- Hot, newest and related post sorting
- Top comments based on engagement

### 🔎 Search & Discovery

- Advanced post search
- Filter by category and date range
- Sort by newest, oldest and relevance
- Search by tags using `#tag`
- Prefix-based search
- Search suggestions
- User search and discovery

### 👥 Social Features

- Personalised user profiles
- Avatar management
- Friend requests
- Notifications
- User activity history
- Achievement badges
- Liked posts and comments
- Profile statistics

### 📚 Study Groups

- Create and join study groups
- Organise groups by school and module
- Share study materials
- Collaborate with other students

### 🛒 Student Marketplace

- Browse marketplace listings
- Create and manage listings
- Add items to cart
- Mock checkout flow
- Designed around common student needs such as textbooks and SP merchandise

### 🤖 PandaBot

SPindle includes **PandaBot**, an AI-powered assistant designed to interact naturally within the discussion community.

Users can mention `@pandabot` in a comment to receive a short, friendly response from the bot, providing another way for students to interact with the platform.

### 📊 Post Analytics

Post owners can view engagement statistics through a dedicated analytics dashboard, including:

- Post views
- Engagement data
- Comment activity
- Interactive charts and visualisations

### 🐍 Snake Easter Egg

SPindle also includes a small **Snake mini-game** as an interactive Easter egg, featuring increasing speed, collision detection, and score tracking.

---

## 🛠️ Tech Stack

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white">
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white">
  <img src="https://img.shields.io/badge/bcrypt-003B57?style=for-the-badge">
  <img src="https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white">
  <img src="https://img.shields.io/badge/Supertest-000000?style=for-the-badge">
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white">
  <img src="https://img.shields.io/badge/Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=black">
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white">
  <img src="https://img.shields.io/badge/Git-181717?style=for-the-badge&logo=git&logoColor=white">
  <img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black">
  <img src="https://img.shields.io/badge/Neon-00E5FF?style=for-the-badge&logo=postgresql&logoColor=black">
  <img src="https://img.shields.io/badge/Agnes_AI-000000?style=for-the-badge">
</p>

---

## 🧪 Technical Highlights

### RESTful API

The backend is built with **Node.js and Express.js**, providing structured API routes for users, posts, comments, groups, search, notifications, and other application features.

### PostgreSQL Database

SPindle uses **PostgreSQL** as its relational database, with relationships connecting users, posts, comments, reactions, groups, badges, and other application entities.

### Authentication & Security

- Password hashing with **bcrypt**
- JWT-based authentication
- Protected API routes
- Token/session handling
- Email verification flows
- Two-factor authentication support and testing

### Automated Testing

SPindle uses multiple levels of automated testing:

| Testing Level       | Tool       | Purpose                                    |
| ------------------- | ---------- | ------------------------------------------ |
| Unit Testing        | Jest       | Test individual functions and logic        |
| Integration Testing | Supertest  | Test API endpoints and backend integration |
| End-to-End Testing  | Playwright | Test complete user journeys                |

This allows functionality to be tested from individual backend functions through to complete user workflows.

### CI/CD

GitHub Actions automatically runs quality and testing checks when changes are pushed or submitted through pull requests.

```text
Push / Pull Request
        ↓
Install Dependencies
        ↓
Format Check
        ↓
ESLint
        ↓
Jest Unit Tests
        ↓
Supertest Integration Tests
        ↓
Playwright E2E Tests
        ↓
Test Reports
```

---

## Quick Links

| Resource                                                                                                                    | Description                   |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 🚀 [Live Application](https://ay2627s1-project-class-2b21-group.onrender.com/home.html?login=1&tab=login&return=index.html) | Try the deployed application  |
| ⚙️ [Server](src/server.js)                                                                                                  | Application entry point       |
| 🔌 [App](src/app.js)                                                                                                        | Express application setup     |
| 🗄️ [Database Schema](schema.sql)                                                                                            | PostgreSQL database structure |
| 🧪 `__tests__/`                                                                                                             | Unit & integration tests      |
| 🎭 `e2e-tests/`                                                                                                             | Playwright end-to-end tests   |

---

## ⚡ Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone <your-repository-url>

cd ay2627s1-project-class-2b21-group-pineapplepizza
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create the required environment files in the project root:

```text
.env.dev
.env.test
```

Configure the required database, authentication, and application settings.

### 4. Initialise the database

Reset the development database:

```bash
npm run migration:reset
```

Seed sample data:

```bash
npm run seed
```

### 5. Start the application

```bash
npm run start
```

Then open:

```text
http://localhost:3000
```

---

## 🧪 Running Tests

Run the test suite with:

```bash
npm run test
```

End-to-end tests are located in:

```text
e2e-tests/
```

The project also includes automated CI checks through GitHub Actions to ensure new changes do not break existing functionality.

---

## 📂 Project Structure

```text
SPindle/
├── src/
│   ├── public/          # Frontend files
│   ├── routes/          # API routes
│   ├── models/          # Database models
│   ├── middleware/      # Authentication & middleware
│   ├── server.js        # Server entry point
│   └── app.js           # Express application setup
│
├── __tests__/            # Jest & Supertest tests
├── e2e-tests/            # Playwright end-to-end tests
├── docs/                 # Project documentation/showcase
├── schema.sql            # Database schema
├── package.json
└── README.md
```

---

## 👥 Development Workflow

SPindle was developed collaboratively using **GitHub Flow**.

```text
Feature / Fix Branch
        ↓
Development
        ↓
Automated Testing
        ↓
Pull Request
        ↓
Code Review
        ↓
Merge to Main
        ↓
CI/CD Pipeline
```

This workflow allowed team members to work on features independently while maintaining code quality and reducing the risk of breaking the main application.

---

## 🎯 Project Goals

SPindle was created to explore how a student-focused platform could bring multiple everyday interactions into one place while providing practical experience with:

- Full-stack web development
- RESTful API design
- Relational database design
- Authentication
- Automated testing
- End-to-end testing
- CI/CD
- AI integration
- Collaborative Git workflows
- Building and deploying a real-world web application

---

## 💐 Thanks for Visiting SPindle!

<p align="center">
  <img src="https://media.tenor.com/0UAWUFaLbXIAAAAM/anime-panda.gif" alt="Cute Panda GIF" width="400">
</p>

<p align="center">
  <strong>Built for SP students, by SP students 💖 </strong>
</p>
