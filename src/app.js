// Marcus here, Im getting this weird CORS error, idk why but I added something to the app.js as I literally cannot run my code without it.

const cors = require('cors'); // Might remove later
const express = require('express');
const createError = require('http-errors');
const path = require('path');
require('dotenv').config();

// Import route handlers
const personRouter = require('./routers/Person.router');
const authRouter = require('./routers/Auth.router');
const messageRouter = require('./routers/Message.router');
const profileRouter = require('./routers/Profile.router');
const friendsRouter = require('./routers/Friends.router');
const notificationsRouter = require('./routers/Notifications.router');
const storiesRouter = require('./routers/Stories.router');
const callsRouter = require('./routers/Calls.router');
const postsRouter = require('./routers/Posts.router');
const postCommentsRouter = require('./routers/PostComments.router');
const searchRouter = require('./routers/Search.router');
const groupRouter = require('./routers/Groups.router');
const marketplaceRouter = require('./routers/Marketplace.router');
const cartRouter = require('./routers/Cart.router');
const tagsRouter = require('./routers/Tags.router');
const paymentsRouter = require('./routers/Payments.router');
const giphyRouter = require('./routers/Giphy.router');
const blockRouter = require('./routers/BlockedUsers.router');
const badgeRouter = require('./routers/Badge.router');

const app = express();
app.use(cors()); // Might remove later

// Allow Live Server / local dev frontends to call the API on another port
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isLocalDev = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (isLocalDev) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Parse incoming JSON request bodies (e.g. from POST/PUT requests)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (HTML, CSS, JS, images) from the 'public' folder.
// e.g. src/public/index.html is accessible at http://localhost:<port>/
app.use(express.static(path.join(__dirname, 'public')));

// Browsers automatically request /favicon.ico — return 204 (no content) to avoid 404 noise.
app.get('/', (req, res) => res.redirect('/home.html'));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.status(204).end());

app.use('/persons', personRouter);
app.use('/auth', authRouter);
app.use('/messages', messageRouter);
app.use('/profile', profileRouter);
app.use('/friends', friendsRouter);
app.use('/notifications', notificationsRouter);
app.use('/stories', storiesRouter);
app.use('/calls', callsRouter);
app.use('/posts', postsRouter);
app.use('/comments', postCommentsRouter);
app.use('/search', searchRouter);
app.use('/groups', groupRouter);
app.use('/marketplace', marketplaceRouter);
app.use('/cart', cartRouter);
app.use('/tags', tagsRouter);
app.use('/payments', paymentsRouter);
app.use('/block', blockRouter);
app.use('/badges', badgeRouter);

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/giphy', giphyRouter);

// 404 handler — if no route above matched the request,
// create a 404 error and pass it to the error handler below.
app.use((req, res, next) => {
  next(createError(404, `Unknown resource ${req.method} ${req.originalUrl}`));
});

// Global error handler — catches all errors thrown or passed via next(err).
// Sends a consistent JSON response instead of Express's default HTML error page.
// NOTE: Express requires exactly 4 parameters (error, req, res, next) to recognize
// this as an error handler. 'next' is not used here, so we disable the ESLint rule.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ error: error.message });
});

module.exports = app;
