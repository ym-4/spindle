const app = require('./app');
const { attachWebSocket } = require('./realtime/wsHub');

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`App listening on port ${port}`);
  console.log(`WebSocket: ws://localhost:${port}/ws`);
});

attachWebSocket(server);

// Graceful shutdown
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
