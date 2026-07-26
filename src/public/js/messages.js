/* global authFetch */

let currentUserId = null;
let selectedContactId = null;
let selectedContactName = '';
let lastMessageAt = null;
let pollTimer = null;

function formatMessageTime(iso) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderContacts(contacts) {
  const list = document.getElementById('chatContactList');
  list.innerHTML = '';

  if (contacts.length === 0) {
    list.innerHTML = '<li class="chat-contact-empty">Add friends to start messaging.</li>';
    return;
  }

  contacts.forEach((contact) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-contact-btn';
    btn.dataset.userId = String(contact.id);
    btn.textContent = contact.display_name || contact.name;
    if (contact.id === selectedContactId) {
      btn.classList.add('chat-contact-btn--active');
    }
    btn.addEventListener('click', () =>
      selectContact(contact.id, contact.display_name || contact.name),
    );
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function appendMessages(messages, replace = false) {
  const container = document.getElementById('chatMessages');
  if (replace) container.innerHTML = '';

  if (replace && messages.length === 0) {
    container.innerHTML = '<p class="chat-empty">No messages yet — say hello!</p>';
    return;
  }

  const empty = container.querySelector('.chat-empty');
  if (empty) empty.remove();

  messages.forEach((msg) => {
    const isSent = msg.sender_id === currentUserId;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isSent ? 'chat-bubble--sent' : 'chat-bubble--received'}`;
    bubble.dataset.msgId = String(msg.id);
    bubble.innerHTML = `
      <p class="chat-bubble-text">${escapeHtml(msg.body)}</p>
      <time class="chat-bubble-time" datetime="${msg.created_at}">${formatMessageTime(msg.created_at)}</time>
    `;
    container.appendChild(bubble);
    lastMessageAt = msg.created_at;
  });

  container.scrollTop = container.scrollHeight;
}

async function fetchConversation(userId, since = null) {
  const qs = since ? `?since=${encodeURIComponent(since)}` : '';
  return authFetch(`/messages/with/${userId}${qs}`);
}

async function selectContact(userId, name) {
  selectedContactId = Number(userId);
  selectedContactName = name;
  lastMessageAt = null;

  document.querySelectorAll('.chat-contact-btn').forEach((btn) => {
    btn.classList.toggle('chat-contact-btn--active', Number(btn.dataset.userId) === userId);
  });

  const header = document.getElementById('chatThreadHeader');
  header.innerHTML = `<strong>${escapeHtml(name)}</strong>`;
  document.getElementById('chatCallActions')?.classList.remove('hidden');

  document.getElementById('chatForm').classList.remove('hidden');
  startPolling();

  try {
    const data = await fetchConversation(userId);
    appendMessages(data.messages, true);
  } catch (err) {
    document.getElementById('chatMessages').innerHTML =
      `<p class="chat-error">${escapeHtml(err.message)}</p>`;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!selectedContactId) return;
    try {
      const data = await fetchConversation(selectedContactId, lastMessageAt);
      if (data.messages.length > 0) appendMessages(data.messages);
    } catch {
      /* ignore transient poll errors */
    }
  }, 3000);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

async function loadContacts() {
  const data = await authFetch('/messages/contacts');
  renderContacts(data.contacts);
  return data.contacts;
}

function showCallModal(type) {
  const modal = document.getElementById('callModal');
  const title = document.getElementById('callModalTitle');
  if (!modal || !title) return;
  title.textContent =
    type === 'video'
      ? `Video call with ${selectedContactName}…`
      : `Voice call with ${selectedContactName}…`;
  modal.classList.remove('hidden');
}

function setupCallUi() {
  document.getElementById('btnVoiceCall')?.addEventListener('click', () => showCallModal('voice'));
  document.getElementById('btnVideoCall')?.addEventListener('click', () => showCallModal('video'));
  document.getElementById('btnEndCall')?.addEventListener('click', () => {
    document.getElementById('callModal')?.classList.add('hidden');
  });
}

function setupChatForm() {
  const form = document.getElementById('chatForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedContactId) return;

    const input = document.getElementById('chatInput');
    const body = input.value.trim();
    if (!body) return;

    try {
      await authFetch('/messages', {
        method: 'POST',
        body: JSON.stringify({ recipientId: selectedContactId, body }),
      });
      input.value = '';
      const data = await fetchConversation(selectedContactId, lastMessageAt);
      appendMessages(data.messages);
      input.focus();
    } catch (err) {
      document.getElementById('chatMessages').innerHTML =
        `<p class="chat-error">${escapeHtml(err.message)}</p>`;
    }
  });
}

async function openMessagesForPeer() {
  const contacts = await loadContacts();
  if (selectedContactId) return;
  if (contacts[0]) {
    await selectContact(contacts[0].id, contacts[0].display_name || contacts[0].name);
  }
}

async function initPersonalChat(userId) {
  currentUserId = Number(userId);
  if (!document.getElementById('chatContactList')) return;
  setupChatForm();
  setupCallUi();

  window.addEventListener('open-dm', async (e) => {
    const userId = e.detail?.userId;
    if (!userId) return;
    const contacts = await loadContacts();
    const c = contacts.find((x) => x.id === userId);
    if (c) await selectContact(c.id, c.display_name || c.name);
  });

  try {
    await loadContacts();
  } catch (err) {
    document.getElementById('chatContactList').innerHTML =
      `<li class="chat-error">${escapeHtml(err.message)}</li>`;
  }
}

window.openMessagesForPeer = openMessagesForPeer;
