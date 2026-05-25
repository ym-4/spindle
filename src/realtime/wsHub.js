const { WebSocketServer } = require('ws');
const { verifyToken } = require('../utils/jwt');
const { sendMessage } = require('../models/Message.model');
const Friends = require('../models/Friends.model');

/** @type {Map<number, Set<import('ws').WebSocket>>} */
const userSockets = new Map();

function addClient(userId, ws) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(ws);
}

function removeClient(userId, ws) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userSockets.delete(userId);
}

function sendToUser(userId, payload) {
  const set = userSockets.get(userId);
  if (!set) return;
  const data = JSON.stringify(payload);
  set.forEach((ws) => {
    if (ws.readyState === 1) ws.send(data);
  });
}

function pushNotification(userId, notification) {
  sendToUser(userId, { type: 'notification', notification });
}

function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');
    let userId = null;

    try {
      const payload = verifyToken(token);
      userId = payload.id;
      ws.userId = userId;
      addClient(userId, ws);
      ws.send(JSON.stringify({ type: 'connected', userId }));
    } catch {
      ws.close(4001, 'Unauthorized');
      return;
    }

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        if (msg.type === 'message' && msg.recipientId && msg.body?.trim()) {
          const recipientId = Number(msg.recipientId);
          const rel = await Friends.getRelationship(userId, recipientId);
          if (rel !== 'friends') {
            ws.send(JSON.stringify({ type: 'error', error: 'You can only message friends.' }));
            return;
          }
          const saved = await sendMessage(userId, recipientId, msg.body.trim());
          const payload = { type: 'message', message: saved };
          ws.send(JSON.stringify(payload));
          sendToUser(recipientId, payload);

          try {
            const Notification = require('../models/Notification.model');
            const sender = await Friends.getPublicProfile(recipientId, userId);
            await Notification.create(recipientId, {
              type: 'message',
              title: `New message from ${sender?.display_name || sender?.name || 'Someone'}`,
              body: msg.body.trim().slice(0, 120),
              ref_id: userId,
            });
          } catch {
            /* optional */
          }
        }

        if (msg.type === 'call:invite' && msg.toUserId) {
          const to = Number(msg.toUserId);
          const rel = await Friends.getRelationship(userId, to);
          if (rel !== 'friends') {
            ws.send(JSON.stringify({ type: 'error', error: 'You can only call friends.' }));
            return;
          }
          const caller = await Friends.getPublicProfile(to, userId);
          sendToUser(to, {
            type: 'call:invite',
            fromUserId: userId,
            callId: msg.callId,
            callType: msg.callType || 'voice',
            callerName: caller?.display_name || caller?.name || 'Someone',
          });
        }

        if (msg.type === 'call:accept' && msg.toUserId && msg.callId) {
          sendToUser(Number(msg.toUserId), {
            type: 'call:accept',
            fromUserId: userId,
            callId: msg.callId,
          });
        }

        if (msg.type === 'call:decline' && msg.toUserId && msg.callId) {
          sendToUser(Number(msg.toUserId), {
            type: 'call:decline',
            fromUserId: userId,
            callId: msg.callId,
          });
        }

        if (msg.type === 'call:busy' && msg.toUserId && msg.callId) {
          sendToUser(Number(msg.toUserId), {
            type: 'call:busy',
            fromUserId: userId,
            callId: msg.callId,
          });
        }

        if (msg.type === 'call:cancel' && msg.toUserId && msg.callId) {
          sendToUser(Number(msg.toUserId), {
            type: 'call:cancel',
            fromUserId: userId,
            callId: msg.callId,
          });
        }

        if (msg.type === 'call:signal' && msg.toUserId && msg.signal) {
          sendToUser(Number(msg.toUserId), {
            type: 'call:signal',
            fromUserId: userId,
            signal: msg.signal,
            callType: msg.callType || 'voice',
            callId: msg.callId,
          });
        }

        if (msg.type === 'call:end' && msg.toUserId) {
          sendToUser(Number(msg.toUserId), {
            type: 'call:end',
            fromUserId: userId,
            callId: msg.callId,
          });
        }

        if (msg.type === 'friend:refresh' && msg.toUserId) {
          sendToUser(Number(msg.toUserId), { type: 'friend:refresh' });
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: err.message || 'Failed' }));
      }
    });

    ws.on('close', () => {
      if (userId) removeClient(userId, ws);
    });
  });

  return { sendToUser, pushNotification };
}

module.exports = { attachWebSocket, sendToUser, pushNotification };
