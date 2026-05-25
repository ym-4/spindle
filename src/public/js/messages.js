let currentUserId = null;
let selectedContactId = null;

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
    list.innerHTML = '<li class="chat-contact-empty">No classmates available yet.</li>';
    return;
  }

  contacts.forEach((contact) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-contact-btn';
    btn.dataset.userId = String(contact.id);
    btn.textContent = contact.name;
    if (contact.id === selectedContactId) {
      btn.classList.add('chat-contact-btn--active');
    }
    btn.addEventListener('click', () => selectContact(contact.id, contact.name));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function renderMessages(messages) {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';

  if (messages.length === 0) {
    container.innerHTML = '<p class="chat-empty">No messages yet — say hello!</p>';
    return;
  }

  messages.forEach((msg) => {
    const isSent = msg.sender_id === currentUserId;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isSent ? 'chat-bubble--sent' : 'chat-bubble--received'}`;
    bubble.innerHTML = `
      <span class="chat-bubble-label">${isSent ? 'Sent' : 'Received'}</span>
      <p class="chat-bubble-text">${escapeHtml(msg.body)}</p>
      <time class="chat-bubble-time" datetime="${msg.created_at}">${formatMessageTime(msg.created_at)}</time>
    `;
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

async function selectContact(userId, name) {
  selectedContactId = userId;

  document.querySelectorAll('.chat-contact-btn').forEach((btn) => {
    btn.classList.toggle('chat-contact-btn--active', Number(btn.dataset.userId) === userId);
  });

  const header = document.getElementById('chatThreadHeader');
  header.innerHTML = `<strong>Chat with ${escapeHtml(name)}</strong>`;

  document.getElementById('chatForm').classList.remove('hidden');

  try {
    const data = await authFetch(`/messages/with/${userId}`);
    renderMessages(data.messages);
  } catch (err) {
    document.getElementById('chatMessages').innerHTML = `<p class="chat-error">${escapeHtml(err.message)}</p>`;
  }
}

async function loadContacts() {
  const data = await authFetch('/messages/contacts');
  renderContacts(data.contacts);
}

async function sendChatMessage(recipientId, body) {
  const data = await authFetch('/messages', {
    method: 'POST',
    body: JSON.stringify({ recipientId, body }),
  });
  return data.message;
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
      const message = await sendChatMessage(selectedContactId, body);
      input.value = '';
      const data = await authFetch(`/messages/with/${selectedContactId}`);
      renderMessages(data.messages);
      input.focus();
      return message;
    } catch (err) {
      document.getElementById('chatMessages').innerHTML = `<p class="chat-error">${escapeHtml(err.message)}</p>`;
    }
  });
}

async function initPersonalChat(userId) {
  currentUserId = userId;
  if (!document.getElementById('chatContactList')) return;
  setupChatForm();

  try {
    await loadContacts();
  } catch (err) {
    document.getElementById('chatContactList').innerHTML = `<li class="chat-error">${escapeHtml(err.message)}</li>`;
  }
}
