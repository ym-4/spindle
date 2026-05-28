// Marcus here, Im getting this weird CORS error, idk why but I added something to the app.js as I literally cannot run my code without it.

const cors = require('cors'); // Might remove later
const express = require('express');
const createError = require('http-errors');
const path = require('path');


// Import route handlers
const somethingRouter = require('./routers/Something.router');
const personRouter = require('./routers/Person.router');
const postsRouter = require('./routers/Posts.router');
const postCommentsRouter = require('./routers/PostComments.router');
const searchRouter = require('./routers/Search.router');
const groupRouter = require('./routers/Groups.router');
const marketplaceRouter = require('./routers/Marketplace.router')

const authRouter = require('./routers/Auth.router');

const app = express();
app.use(cors()); // Might remove later

// Parse incoming JSON request bodies (e.g. from POST/PUT requests)
app.use(express.json({limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (HTML, CSS, JS, images) from the 'public' folder.
// e.g. src/public/index.html is accessible at http://localhost:<port>/
app.use(express.static(path.join(__dirname, 'public')));

// Browsers automatically request /favicon.ico — return 204 (no content) to avoid 404 noise.
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.status(204).end());

app.use('/somethings', somethingRouter);
app.use('/persons', personRouter);
app.use('/posts', postsRouter);
app.use('/comments', postCommentsRouter);
app.use('/search', searchRouter);
app.use('/groups', groupRouter);
app.use('/marketplace', marketplaceRouter);

app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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
