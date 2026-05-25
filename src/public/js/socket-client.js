let ws = null;
const wsHandlers = new Map();

function connectSocket() {
  const token = getToken();
  if (!token) return null;
  if (ws && ws.readyState === WebSocket.OPEN) return ws;

  const url = `${getWsUrl()}?token=${encodeURIComponent(token)}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    window.dispatchEvent(new CustomEvent('ws-open'));
  };

  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      window.dispatchEvent(new CustomEvent('ws-message', { detail: data }));
      const handlers = wsHandlers.get(data.type) || [];
      handlers.forEach((fn) => fn(data));
    } catch {
      /* ignore */
    }
  };

  ws.onclose = () => {
    ws = null;
    setTimeout(connectSocket, 3000);
  };

  setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 25000);

  return ws;
}

function onWs(type, handler) {
  if (!wsHandlers.has(type)) wsHandlers.set(type, []);
  wsHandlers.get(type).push(handler);
}

function sendWs(payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

function sendChatMessage(recipientId, body) {
  if (sendWs({ type: 'message', recipientId, body })) return Promise.resolve();
  return authFetch('/messages', {
    method: 'POST',
    body: JSON.stringify({ recipientId, body }),
  });
}

function sendCallInvite(toUserId, callId, callType) {
  sendWs({ type: 'call:invite', toUserId, callId, callType });
}

function sendCallAccept(toUserId, callId) {
  sendWs({ type: 'call:accept', toUserId, callId });
}

function sendCallDecline(toUserId, callId) {
  sendWs({ type: 'call:decline', toUserId, callId });
}

function sendCallBusy(toUserId, callId) {
  sendWs({ type: 'call:busy', toUserId, callId });
}

function sendCallCancel(toUserId, callId) {
  sendWs({ type: 'call:cancel', toUserId, callId });
}

function sendCallSignal(toUserId, signal, callType, callId) {
  sendWs({ type: 'call:signal', toUserId, signal, callType, callId });
}

function endCall(toUserId, callId) {
  sendWs({ type: 'call:end', toUserId, callId });
}
