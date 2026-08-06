let currentUserId = null;
let selectedPeerId = null;
let selectedPeerName = '';
let peerConnection = null;
let localStream = null;
let isCaller = false;
let activeCallType = 'voice';
let callState = 'idle';
let activeCallId = null;
let incomingCallerId = null;
let incomingCallerName = '';
let callStartedAt = null;
let isMicMuted = false;
let screenTrack = null;
let msgMenuTargetId = null;
let replyToId = null;
let typingTimer = null;
let chatSearchResults = [];
let chatSearchIndex = -1;

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function newCallId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function avatarHtml(u, size = '') {
  const initials = (u.avatar || u.name || '?').slice(0, 2).toUpperCase();
  if (u.profile_image) {
    return `<div class="wa-avatar ${size}"><img src="${mediaUrl(u.profile_image)}" alt="" /></div>`;
  }
  return `<div class="wa-avatar ${size}">${esc(initials)}</div>`;
}

function setCallUiMode(mode) {
  const overlay = document.getElementById('callOverlay');
  const incoming = document.getElementById('callIncomingActions');
  const active = document.getElementById('callActiveControls');
  const ended = document.getElementById('callEndedActions');
  const cancel = document.getElementById('btnCancelRinging');
  const videos = document.getElementById('callVideoWrap');
  overlay.classList.remove('hidden');
  incoming.classList.add('hidden');
  active.classList.add('hidden');
  ended.classList.add('hidden');
  cancel.classList.add('hidden');
  videos.classList.add('hidden');
  if (mode === 'incoming') incoming.classList.remove('hidden');
  if (mode === 'outgoing') cancel.classList.remove('hidden');
  if (mode === 'active') {
    active.classList.remove('hidden');
    videos.classList.remove('hidden');
  }
  if (mode === 'ended') ended.classList.remove('hidden');
}

async function logCallEntry(peerId, status, direction, durationSec = 0) {
  if (!peerId) return;
  try {
    await authFetch('/calls/logs', {
      method: 'POST',
      body: JSON.stringify({
        peer_id: peerId,
        call_type: activeCallType,
        status,
        direction,
        duration_sec: durationSec,
      }),
    });
    loadCallLogs();
  } catch {
    /* ignore */
  }
}

function renderReplyQuote(msg) {
  if (!msg.reply_to_id) return '';
  const name = msg.reply_sender_id === currentUserId ? 'You' : selectedPeerName;
  const replyBody = esc(msg.reply_body || '');
  const replyImg = msg.reply_image_url
    ? `<img src="${mediaUrl(msg.reply_image_url)}" class="wa-reply-preview-thumb" />`
    : '';
  return `<div class="wa-reply-quote"><span>${esc(name)}</span>${replyImg} ${replyBody}</div>`;
}

function renderReadReceipt(msg) {
  if (msg.sender_id !== currentUserId) return '';
  if (!msg.created_at) return '';
  if (msg.read_at) {
    return `<span class="wa-read-tick wa-read-tick--seen" title="Seen"><i class="fas fa-check-double"></i></span>`;
  }
  return `<span class="wa-read-tick" title="Delivered"><i class="fas fa-check"></i></span>`;
}

function renderBubbleContent(msg) {
  const deleted = !!msg.deleted_at;
  const body = deleted ? '[Message deleted]' : esc(msg.body);
  const edited = msg.edited_at && !deleted ? ' <small class="wa-edited">edited</small>' : '';
  const imgHtml =
    msg.image_url && !deleted
      ? `<img src="${mediaUrl(msg.image_url)}" class="wa-msg-image" alt="Image" />`
      : '';
  const quoteHtml = renderReplyQuote(msg);
  const reactions = (msg.reactions || [])
    .filter((r) => r && r.emoji)
    .map((r) => `<span class="wa-reaction-chip">${r.emoji}</span>`)
    .join('');
  const receipt = renderReadReceipt(msg);
  return `${quoteHtml}${body}${edited}${imgHtml}<div class="wa-bubble-reactions">${reactions}</div><time>${receipt} ${new Date(msg.created_at).toLocaleTimeString()}</time>`;
}

function buildBubbleRow(msg) {
  const out = msg.sender_id === currentUserId;
  const row = document.createElement('div');
  row.className = `wa-bubble-row ${out ? 'wa-bubble-row--out' : 'wa-bubble-row--in'}`;
  row.dataset.msgId = msg.id;

  const bubble = document.createElement('div');
  bubble.className = `wa-bubble ${out ? 'wa-bubble--out' : 'wa-bubble--in'}`;
  bubble.innerHTML = renderBubbleContent(msg);
  row.appendChild(bubble);

  if (!msg.deleted_at) {
    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.className = 'wa-bubble-reply-btn';
    replyBtn.setAttribute('aria-label', 'Reply');
    replyBtn.innerHTML = '<i class="fas fa-reply"></i>';
    replyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setReplyTo(msg.id, msg.body, msg.image_url);
    });
    row.appendChild(replyBtn);

    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'wa-bubble-menu-btn';
    menuBtn.setAttribute('aria-label', 'Message options');
    menuBtn.textContent = '⋮';
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMsgMenuForMessage(msg, menuBtn);
    });
    row.appendChild(menuBtn);
  }

  bubble.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openMsgMenuForMessage(msg, bubble);
  });

  return row;
}

function appendBubble(msg) {
  const box = document.getElementById('chatMessages');
  const empty = box.querySelector('.wa-empty');
  if (empty) empty.remove();
  box.appendChild(buildBubbleRow(msg));
  box.scrollTop = box.scrollHeight;
}

function updateBubbleInDom(msg) {
  const row = document.querySelector(`.wa-bubble-row[data-msg-id="${msg.id}"]`);
  if (!row) return;
  const bubble = row.querySelector('.wa-bubble');
  if (bubble) bubble.innerHTML = renderBubbleContent(msg);
}

function formatPreview(text, max = 36) {
  const t = (text || '').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function unreadBadgeHtml(count) {
  if (!count || count < 1) return '';
  const label = count > 99 ? '99+' : String(count);
  return `<span class="wa-chat-unread" aria-label="${label} unread">${label}</span>`;
}

function setChatView(open) {
  const empty = document.getElementById('chatEmpty');
  const active = document.getElementById('chatActive');
  empty?.classList.toggle('is-hidden', open);
  active?.classList.toggle('is-open', open);
  if (!open) {
    selectedPeerId = null;
    selectedPeerName = '';
    replyToId = null;
    document.getElementById('replyPreview')?.classList.add('hidden');
    document.getElementById('chatHeaderStatus').textContent = '';
  }
}

async function loadContacts() {
  const list = document.getElementById('chatContactList');
  if (!list) return;
  try {
    const { contacts } = await authFetch('/messages/contacts');
    if (contacts.length === 0) {
      list.innerHTML =
        '<li class="wa-list-empty" style="padding:1rem">No friends yet — go to <a href="friends.html">Friends</a> to add people.</li>';
      return;
    }
    list.innerHTML = contacts
      .map((c) => {
        const preview = formatPreview(c.last_message);
        const previewHtml = preview
          ? `<span class="wa-chat-preview">${esc(preview)}</span>`
          : '<span class="wa-chat-preview">Tap to chat</span>';
        const pinIcon = c.is_pinned
          ? '<span class="wa-pin-icon"><i class="fas fa-thumbtack"></i></span>'
          : '';
        const muteIcon = c.is_muted
          ? '<span class="wa-mute-icon"><i class="fas fa-bell-slash"></i></span>'
          : '';
        return `
    <li class="wa-list-item ${c.id === selectedPeerId ? 'active' : ''} ${c.unread_count > 0 ? 'has-unread' : ''}" data-id="${c.id}" data-name="${esc(c.display_name || c.name)}">
      ${avatarHtml(c)}
      <div class="wa-list-body">
        <strong>${pinIcon}${esc(c.display_name || c.name)} ${muteIcon}</strong>
        ${previewHtml}
      </div>
      ${unreadBadgeHtml(c.unread_count)}
    </li>`;
      })
      .join('');
    updateChatsTabBadge(contacts);
    list.querySelectorAll('.wa-list-item').forEach((el) => {
      el.addEventListener('click', () => openChat(Number(el.dataset.id), el.dataset.name));
    });
  } catch (err) {
    list.innerHTML = `<li class="wa-list-empty">${esc(err.message)}</li>`;
    showToast(err.message, true);
  }
}

function updateChatsTabBadge(contacts) {
  const tab = document.querySelector('[data-side="chats"]');
  if (!tab) return;
  const total = (contacts || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const old = tab.querySelector('.wa-tab-unread');
  if (old) old.remove();
  if (total > 0) {
    const span = document.createElement('span');
    span.className = 'wa-tab-unread';
    span.textContent = total > 99 ? '99+' : String(total);
    tab.appendChild(span);
  }
}

async function loadReadState(peerId) {
  try {
    const data = await authFetch(`/messages/read-state/${peerId}`);
    if (data.readState) {
      document.querySelectorAll(`.wa-bubble-row--out[data-msg-id]`).forEach((row) => {
        const msgId = row.dataset.msgId;
        const bubble = row.querySelector('.wa-bubble');
        if (bubble) {
          const time = bubble.querySelector('time');
          if (time) {
            const msgTime = new Date(bubble.querySelector('time')?.textContent?.trim() || 0);
            if (!isNaN(msgTime) && new Date(data.readState) > msgTime) {
              const tick = time.querySelector('.wa-read-tick');
              if (tick) {
                tick.className = 'wa-read-tick wa-read-tick--seen';
                tick.title = 'Seen';
                tick.innerHTML = '<i class="fas fa-check-double"></i>';
              }
            }
          }
        }
      });
    }
  } catch {
    /* ignore */
  }
}

async function openChat(userId, name) {
  selectedPeerId = userId;
  selectedPeerName = name;
  replyToId = null;
  document.getElementById('replyPreview')?.classList.add('hidden');
  setChatView(true);
  document.getElementById('chatHeaderName').textContent = name;
  document.getElementById('chatHeaderAvatar').innerHTML = avatarHtml({ name }).trim();
  document.getElementById('chatHeaderStatus').textContent = '';
  document.getElementById('chatMessages').innerHTML = '<p class="wa-empty">Loading…</p>';
  document.querySelectorAll('#chatContactList .wa-list-item').forEach((el) => {
    const isActive = Number(el.dataset.id) === userId;
    el.classList.toggle('active', isActive);
    if (isActive) {
      el.classList.remove('has-unread');
      el.querySelector('.wa-chat-unread')?.remove();
    }
  });

  document.getElementById('chatHeaderAvatar').onclick = () => {
    window.location.href = `profile.html?id=${userId}`;
  };
  document.getElementById('chatHeaderNameWrap').onclick = () => {
    window.location.href = `profile.html?id=${userId}`;
  };

  try {
    const data = await authFetch(`/messages/with/${userId}`);
    document.getElementById('chatMessages').innerHTML = '';
    data.messages.forEach(appendBubble);
    if (data.messages.length === 0) {
      document.getElementById('chatMessages').innerHTML =
        '<p class="wa-empty">No messages yet — say hi!</p>';
    }
    if (data.readState) {
      setTimeout(() => loadReadState(userId), 500);
    }
    const muteStatus = await authFetch(`/messages/mute/${userId}`)
      .then(() => false)
      .catch(() => false);
    updateMenuMuteState(userId);
    loadContacts();
  } catch (err) {
    document.getElementById('chatMessages').innerHTML =
      `<p class="wa-empty">${esc(err.message)}</p>`;
    showToast(err.message, true);
  }
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const body = input.value.trim();
  const imageInput = document.getElementById('chatImageInput');
  const file = imageInput?.files?.[0];
  if ((!body && !file) || !selectedPeerId) return;

  const formData = new FormData();
  formData.append('recipientId', selectedPeerId);
  if (body) formData.append('body', body);
  if (replyToId) formData.append('replyToId', replyToId);
  if (file) formData.append('image', file);

  input.value = '';
  imageInput.value = '';
  replyToId = null;
  document.getElementById('replyPreview')?.classList.add('hidden');
  document.getElementById('chatImagePreview')?.classList.add('hidden');

  try {
    const token = getToken();
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    if (data.message) appendBubble(data.message);
  } catch (err) {
    showToast(err.message, true);
  }
}

function setReplyTo(msgId, body, imageUrl) {
  replyToId = msgId;
  const preview = document.getElementById('replyPreview');
  const text = document.getElementById('replyPreviewText');
  if (text) {
    text.textContent = imageUrl
      ? `${(body || 'Image').slice(0, 60)} [Image]`
      : (body || '').slice(0, 100);
  }
  preview?.classList.remove('hidden');
  document.getElementById('chatInput')?.focus();
}

function sendTypingSignal() {
  if (!selectedPeerId) return;
  sendWs({ type: 'typing', toUserId: selectedPeerId });
}

function showTypingIndicator(name) {
  const el = document.getElementById('chatTypingIndicator');
  const span = document.getElementById('typingName');
  if (span) span.textContent = name;
  el?.classList.remove('hidden');
  clearTimeout(el._typingTimer);
  el._typingTimer = setTimeout(() => el?.classList.add('hidden'), 3000);
}

function openMsgMenuForMessage(msg, anchorOrEvent) {
  msgMenuTargetId = msg.id;
  window.__msgMenuTarget = msg;
  const menu = document.getElementById('msgMenu');
  const isOwn = msg.sender_id === currentUserId && !msg.deleted_at;
  menu.querySelector('[data-action="edit"]').style.display = isOwn ? '' : 'none';
  menu.querySelector('[data-action="delete"]').style.display = isOwn ? '' : 'none';

  let x;
  let y;
  if (anchorOrEvent?.clientX != null) {
    x = anchorOrEvent.clientX;
    y = anchorOrEvent.clientY;
  } else if (anchorOrEvent?.getBoundingClientRect) {
    const r = anchorOrEvent.getBoundingClientRect();
    x = r.left;
    y = r.bottom + 4;
  } else {
    x = window.innerWidth / 2;
    y = window.innerHeight / 2;
  }
  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 220)}px`;
  menu.classList.remove('hidden');
}

function closeMsgMenu() {
  document.getElementById('msgMenu')?.classList.add('hidden');
  msgMenuTargetId = null;
}

async function editMessagePrompt(msg) {
  const next = prompt('Edit message:', msg.body);
  if (next === null || !next.trim()) return;
  try {
    const { message } = await authFetch(`/messages/${msg.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: next.trim() }),
    });
    updateBubbleInDom({ ...message, reactions: msg.reactions || [] });
  } catch (err) {
    showToast(err.message, true);
  }
}

function bindMsgMenu() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#msgMenu')) closeMsgMenu();
  });
  document.getElementById('msgMenu')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action], [data-emoji]');
    if (!btn || !msgMenuTargetId) return;
    const id = msgMenuTargetId;
    const msg = window.__msgMenuTarget || { id, body: '', sender_id: currentUserId };
    closeMsgMenu();
    if (btn.dataset.emoji) {
      try {
        const { reactions } = await authFetch(`/messages/${id}/reactions`, {
          method: 'POST',
          body: JSON.stringify({ emoji: btn.dataset.emoji }),
        });
        const el = document.querySelector(`.wa-bubble-row[data-msg-id="${id}"]`);
        if (el) {
          const chips = reactions
            .map((r) => `<span class="wa-reaction-chip">${r.emoji}</span>`)
            .join('');
          let row = el.querySelector('.wa-bubble-reactions');
          if (!row) {
            row = document.createElement('div');
            row.className = 'wa-bubble-reactions';
            el.querySelector('time')?.before(row);
          }
          row.innerHTML = chips;
        }
      } catch (err) {
        showToast(err.message, true);
      }
      return;
    }
    const bubble = document.querySelector(`.wa-bubble-row[data-msg-id="${id}"] .wa-bubble`);
    const text = msg.body || bubble?.textContent?.replace(/edited/gi, '').trim() || '';
    if (btn.dataset.action === 'copy') {
      await navigator.clipboard.writeText(text.replace('[Message deleted]', '').trim());
      showToast('Copied');
    } else if (btn.dataset.action === 'edit') {
      editMessagePrompt(msg);
    } else if (btn.dataset.action === 'delete') {
      if (!confirm('Delete this message?')) return;
      try {
        const { message } = await authFetch(`/messages/${id}`, { method: 'DELETE' });
        updateBubbleInDom(message);
      } catch (err) {
        showToast(err.message, true);
      }
    } else if (btn.dataset.action === 'reply') {
      setReplyTo(id, msg.body, msg.image_url);
    }
  });
}

async function chatSearch(query) {
  if (!selectedPeerId || !query.trim()) return;
  try {
    const data = await authFetch(
      `/messages/with/${selectedPeerId}/search?q=${encodeURIComponent(query.trim())}`,
    );
    chatSearchResults = data.results || [];
    chatSearchIndex = -1;
    const count = document.getElementById('chatSearchCount');
    count.textContent = `${chatSearchResults.length} results`;
    document
      .querySelectorAll('.wa-bubble-row')
      .forEach((r) => r.classList.remove('wa-search-highlight'));
  } catch {
    /* ignore */
  }
}

function navigateSearchResult(dir) {
  if (chatSearchResults.length === 0) return;
  chatSearchIndex += dir;
  if (chatSearchIndex < 0) chatSearchIndex = 0;
  if (chatSearchIndex >= chatSearchResults.length) chatSearchIndex = chatSearchResults.length - 1;
  const msgId = chatSearchResults[chatSearchIndex]?.id;
  if (!msgId) return;
  document
    .querySelectorAll('.wa-bubble-row')
    .forEach((r) => r.classList.remove('wa-search-highlight'));
  const el = document.querySelector(`.wa-bubble-row[data-msg-id="${msgId}"]`);
  if (el) {
    el.classList.add('wa-search-highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function updateMenuMuteState(peerId) {
  try {
    const { muted } = await authFetch(`/messages/mute/${peerId}`).catch(() => ({ muted: false }));
    document.querySelector('[data-action="mute"]')?.classList.toggle('hidden', muted);
    document.querySelector('[data-action="unmute"]')?.classList.toggle('hidden', !muted);
  } catch {
    /* ignore */
  }
}

function setupChatMenu() {
  const menu = document.getElementById('chatDropdownMenu');
  document.getElementById('btnChatMenu')?.addEventListener('click', (e) => {
    e.stopPropagation();
    menu?.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#chatDropdownMenu') && !e.target.closest('#btnChatMenu')) {
      menu?.classList.add('hidden');
    }
  });
  menu?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !selectedPeerId) return;
    menu?.classList.add('hidden');
    const action = btn.dataset.action;
    if (action === 'mute') {
      await authFetch(`/messages/mute/${selectedPeerId}`, { method: 'POST' });
      showToast('Chat muted');
      updateMenuMuteState(selectedPeerId);
      loadContacts();
    } else if (action === 'unmute') {
      await authFetch(`/messages/mute/${selectedPeerId}`, { method: 'DELETE' });
      showToast('Chat unmuted');
      updateMenuMuteState(selectedPeerId);
      loadContacts();
    } else if (action === 'pin') {
      await authFetch(`/messages/pin/${selectedPeerId}`, { method: 'POST' });
      showToast('Chat pinned');
      loadContacts();
    } else if (action === 'unpin') {
      await authFetch(`/messages/pin/${selectedPeerId}`, { method: 'DELETE' });
      showToast('Chat unpinned');
      loadContacts();
    } else if (action === 'wallpaper') {
      document.getElementById('wallpaperPicker')?.classList.remove('hidden');
    } else if (action === 'block') {
      if (!confirm(`Block ${selectedPeerName}?`)) return;
      await authFetch('/block', {
        method: 'POST',
        body: JSON.stringify({ blocked_id: selectedPeerId }),
      });
      showToast(`${selectedPeerName} blocked`);
      setChatView(false);
      loadContacts();
    } else if (action === 'clear') {
      if (!confirm(`Clear all messages with ${selectedPeerName}? This cannot be undone.`)) return;
      document.getElementById('chatMessages').innerHTML = '<p class="wa-empty">Chat cleared</p>';
      showToast('Chat cleared');
    }
  });
}

function setupWallpaperPicker() {
  const picker = document.getElementById('wallpaperPicker');
  const backdrop = picker?.querySelector('.wa-wallpaper-picker__backdrop');
  backdrop?.addEventListener('click', () => picker?.classList.add('hidden'));
  document
    .getElementById('wallpaperPickerClose')
    ?.addEventListener('click', () => picker?.classList.add('hidden'));
  picker?.querySelectorAll('.wa-wallpaper-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wallpaper = btn.dataset.wallpaper;
      const bg = document.getElementById('chatMessages');
      if (wallpaper === 'default') {
        bg?.style.removeProperty('background-image');
        bg?.style.removeProperty('background-color');
      } else if (wallpaper === 'solid-light') {
        bg.style.backgroundImage = 'none';
        bg.style.backgroundColor = '#e8e4db';
      } else if (wallpaper === 'solid-dark') {
        bg.style.backgroundImage = 'none';
        bg.style.backgroundColor = '#0b141a';
      } else if (wallpaper === 'leaves') {
        bg.style.backgroundImage = 'none';
        bg.style.backgroundColor = '#1a3a2a';
      } else if (wallpaper === 'ocean') {
        bg.style.backgroundImage = 'none';
        bg.style.backgroundColor = '#0a2e4a';
      } else if (wallpaper === 'sunset') {
        bg.style.backgroundImage = 'none';
        bg.style.backgroundColor = '#3a1a1a';
      }
      try {
        localStorage.setItem('chatWallpaper', wallpaper);
      } catch {
        /* ignore */
      }
      picker?.classList.add('hidden');
    });
  });
}

function loadSavedWallpaper() {
  try {
    const wallpaper = localStorage.getItem('chatWallpaper');
    if (wallpaper && wallpaper !== 'default') {
      const btn = document.querySelector(`.wa-wallpaper-opt[data-wallpaper="${wallpaper}"]`);
      if (btn) btn.click();
    }
  } catch {
    /* ignore */
  }
}

/* Friends panel */
let searchTimer = null;

function friendActionButton(u) {
  if (u.relationship === 'friends') {
    return '<span class="wa-rel-badge wa-rel-badge--friends">Friends</span>';
  }
  if (u.relationship === 'pending_sent') {
    return '<span class="wa-rel-badge">Request sent</span>';
  }
  if (u.relationship === 'pending_received' && u.request_id) {
    return `<button type="button" class="wa-btn wa-btn--small" data-accept="${u.request_id}">Accept</button>`;
  }
  if (u.relationship === 'none') {
    return `<button type="button" class="wa-btn wa-btn--small" data-add="${u.id}">Add</button>`;
  }
  return '';
}

function bindFindPeopleActions() {
  const list = document.getElementById('findPeopleList');
  list.querySelectorAll('[data-add]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await authFetch('/friends/request', {
          method: 'POST',
          body: JSON.stringify({ receiver_id: Number(b.dataset.add) }),
        });
        showToast('Friend request sent');
        searchUsers(document.getElementById('friendSearch').value);
        loadRequests();
      } catch (err) {
        showToast(err.message, true);
      }
    }),
  );
  list.querySelectorAll('[data-accept]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await authFetch('/friends/accept', {
          method: 'POST',
          body: JSON.stringify({ request_id: Number(b.dataset.accept) }),
        });
        showToast('Friend added!');
        loadContacts();
        searchUsers(document.getElementById('friendSearch').value);
        loadRequests();
      } catch (err) {
        showToast(err.message, true);
      }
    }),
  );
}

async function searchUsers(q) {
  const list = document.getElementById('findPeopleList');
  const hint = document.getElementById('friendSearchHint');
  if (!list) return;

  const query = q.trim();
  if (!query) {
    list.innerHTML = '';
    if (hint) {
      hint.textContent = 'Type a name (e.g. Alice) then tap Add';
      hint.classList.remove('wa-search-hint--error');
    }
    return;
  }

  if (hint) hint.textContent = 'Searching…';
  list.innerHTML = '<li class="wa-list-empty">Searching…</li>';

  try {
    const { users } = await authFetch(`/friends/search?q=${encodeURIComponent(query)}`);
    if (users.length === 0) {
      list.innerHTML = '<li class="wa-list-empty">No users found — try another name</li>';
      if (hint) {
        hint.textContent = `No match for "${query}"`;
        hint.classList.remove('wa-search-hint--error');
      }
      return;
    }
    list.innerHTML = users
      .map(
        (u) => `
      <li class="wa-list-item">
        ${avatarHtml(u)}
        <div class="wa-list-body">
          <strong>${esc(u.display_name || u.name)}</strong>
          <span>@${esc(u.name)}</span>
        </div>
        ${friendActionButton(u)}
      </li>`,
      )
      .join('');
    if (hint) {
      hint.textContent = `${users.length} result(s) — tap Add to send a request`;
      hint.classList.remove('wa-search-hint--error');
    }
    bindFindPeopleActions();
  } catch (err) {
    list.innerHTML = `<li class="wa-list-empty">${esc(err.message)}</li>`;
    if (hint) {
      hint.textContent = err.message;
      hint.classList.add('wa-search-hint--error');
    }
  }
}

let friendReqTab = 'received';

async function loadRequests() {
  const list = document.getElementById('friendRequestsList');
  if (!list) return;
  try {
    const { requests } = await authFetch(`/friends/requests?tab=${friendReqTab}`);
    const isReceived = friendReqTab === 'received';
    list.innerHTML =
      requests.length === 0
        ? '<li class="wa-list-empty">No requests</li>'
        : requests
            .map((r) => {
              const actions = isReceived
                ? `<button class="wa-btn wa-btn--small" data-accept="${r.request_id}">Accept</button>
                 <button class="wa-btn wa-btn--ghost wa-btn--small" data-decline="${r.request_id}">Decline</button>`
                : `<button class="wa-btn wa-btn--ghost wa-btn--small" data-decline="${r.request_id}">Cancel</button>`;
              return `<li class="wa-list-item">${avatarHtml(r.user)}<div class="wa-list-body"><strong>${esc(r.user.display_name || r.user.name)}</strong></div>${actions}</li>`;
            })
            .join('');
    list.querySelectorAll('[data-accept]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await authFetch('/friends/accept', {
            method: 'POST',
            body: JSON.stringify({ request_id: Number(b.dataset.accept) }),
          });
          loadContacts();
          loadRequests();
          const q = document.getElementById('friendSearch')?.value?.trim();
          if (q) searchUsers(q);
          showToast('Friend accepted');
        } catch (err) {
          showToast(err.message, true);
        }
      }),
    );
    list.querySelectorAll('[data-decline]').forEach((b) =>
      b.addEventListener('click', async () => {
        try {
          await authFetch('/friends/decline', {
            method: 'POST',
            body: JSON.stringify({ request_id: Number(b.dataset.decline) }),
          });
          loadRequests();
        } catch (err) {
          showToast(err.message, true);
        }
      }),
    );
  } catch (err) {
    list.innerHTML = `<li class="wa-list-empty">${esc(err.message)}</li>`;
  }
}

async function loadCallLogs() {
  const list = document.getElementById('callLogList');
  if (!list) return;
  try {
    const { logs } = await authFetch('/calls/logs');
    if (logs.length === 0) {
      list.innerHTML = '<li class="wa-list-empty">No calls yet</li>';
      return;
    }
    const icon = { completed: '✓', missed: '↩', declined: '✕', cancelled: '—', busy: '⏸' };
    list.innerHTML = logs
      .map((l) => {
        const dir = l.direction === 'outgoing' ? 'Outgoing' : 'Incoming';
        const st = l.status === 'missed' ? 'Missed' : l.status;
        return `<li class="wa-list-item wa-call-log-item" data-peer="${l.peer_id}" data-name="${esc(l.peer_name)}">
          <div class="wa-list-body">
            <strong>${icon[l.status] || '•'} ${esc(l.peer_name)}</strong>
            <span>${dir} ${l.call_type} · ${st} · ${new Date(l.created_at).toLocaleString()}</span>
          </div>
        </li>`;
      })
      .join('');
    list.querySelectorAll('.wa-call-log-item').forEach((el) => {
      el.addEventListener('click', () => openChat(Number(el.dataset.peer), el.dataset.name));
    });
  } catch {
    list.innerHTML = '<li class="wa-list-empty">Could not load calls</li>';
  }
}

/* WebRTC — only after accept */
async function ensurePeerConnection() {
  if (peerConnection) return peerConnection;
  peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  peerConnection.onicecandidate = (e) => {
    if (e.candidate && selectedPeerId && activeCallId) {
      sendCallSignal(
        selectedPeerId,
        { type: 'ice', candidate: e.candidate },
        activeCallType,
        activeCallId,
      );
    }
  };
  peerConnection.ontrack = (e) => {
    document.getElementById('remoteVideo').srcObject = e.streams[0];
  };
  peerConnection.onconnectionstatechange = () => {
    const st = peerConnection?.connectionState;
    if (st === 'connected') {
      callStartedAt = Date.now();
      document.getElementById('callStatus').textContent = `On call with ${selectedPeerName}`;
    }
  };
  return peerConnection;
}

async function attachLocalMedia(video) {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
  document.getElementById('localVideo').srcObject = localStream;
  document.getElementById('localVideo').style.display = video ? 'block' : 'none';
  const pc = await ensurePeerConnection();
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
  isMicMuted = false;
  isCamOff = !video;
  document.getElementById('btnMute').textContent = '🎤';
}

async function toggleScreenShareChat() {
  if (screenTrack) {
    screenTrack.stop();
    const pc = peerConnection;
    if (pc)
      pc.getSenders()
        .find((s) => s.track === screenTrack)
        ?.removeTrack?.();
    screenTrack = null;
    document.getElementById('screenShareVideo')?.classList.add('hidden');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screenTrack = stream.getVideoTracks()[0];
    const pc = peerConnection;
    if (pc) {
      pc.addTrack(screenTrack, stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendCallSignal(selectedPeerId, { type: 'offer', sdp: offer }, activeCallType, activeCallId);
    }
    document.getElementById('screenShareVideo').srcObject = stream;
    document.getElementById('screenShareVideo').classList.remove('hidden');
    screenTrack.onended = () => {
      screenTrack = null;
      document.getElementById('screenShareVideo')?.classList.add('hidden');
    };
  } catch {
    /* user cancelled */
  }
}

async function beginCallerMedia() {
  try {
    await attachLocalMedia(activeCallType === 'video');
    const pc = peerConnection;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendCallSignal(
      selectedPeerId,
      { type: 'offer', sdp: offer, callType: activeCallType },
      activeCallType,
      activeCallId,
    );
    callState = 'active';
    setCallUiMode('active');
    document.getElementById('callSubstatus').textContent = '';
  } catch (err) {
    showToast(err.message || 'Camera/mic required', true);
    hangUpCall('cancelled');
  }
}

async function startCall(video = false) {
  if (!selectedPeerId) {
    showToast('Select a chat first', true);
    return;
  }
  if (callState !== 'idle') {
    showToast('You are already in a call', true);
    return;
  }
  activeCallType = video ? 'video' : 'voice';
  isCaller = true;
  activeCallId = newCallId();
  callState = 'outgoing';
  setCallUiMode('outgoing');
  document.getElementById('callStatus').textContent = `Calling ${selectedPeerName}…`;
  document.getElementById('callSubstatus').textContent = 'Waiting for them to accept…';
  sendCallInvite(selectedPeerId, activeCallId, activeCallType);
}

function showIncomingCall(data) {
  incomingCallerId = data.fromUserId;
  incomingCallerName = data.callerName || 'Someone';
  activeCallId = data.callId;
  activeCallType = data.callType || 'voice';
  isCaller = false;
  selectedPeerId = incomingCallerId;
  selectedPeerName = incomingCallerName;
  callState = 'incoming';
  setCallUiMode('incoming');
  document.getElementById('callStatus').textContent = `Incoming ${activeCallType} call`;
  document.getElementById('callSubstatus').textContent = incomingCallerName;
}

async function acceptIncomingCall() {
  if (callState !== 'incoming' || !incomingCallerId) return;
  sendCallAccept(incomingCallerId, activeCallId);
  callState = 'connecting';
  document.getElementById('callStatus').textContent = 'Connecting…';
  document.getElementById('callSubstatus').textContent = 'Waiting for caller…';
  setCallUiMode('outgoing');
  document.getElementById('btnCancelRinging').classList.add('hidden');
}

function declineIncomingCall() {
  if (callState !== 'incoming' || !incomingCallerId) return;
  sendCallDecline(incomingCallerId, activeCallId);
  logCallEntry(incomingCallerId, 'declined', 'incoming');
  endCallLocal();
}

function showCallEndedUi(message, showCallBack = true) {
  callState = 'ended';
  setCallUiMode('ended');
  document.getElementById('callStatus').textContent = message;
  document.getElementById('callSubstatus').textContent = '';
  document.getElementById('btnCallBack').classList.toggle('hidden', !showCallBack);
}

function dismissCallEnded() {
  endCallLocal();
}

function callBackFromDeclined() {
  const peer = selectedPeerId;
  const video = activeCallType === 'video';
  endCallLocal();
  if (peer) {
    selectedPeerId = peer;
    startCall(video);
  }
}

function cancelOutgoingCall() {
  if (callState === 'outgoing' && selectedPeerId) {
    sendCallCancel(selectedPeerId, activeCallId);
    logCallEntry(selectedPeerId, 'cancelled', 'outgoing');
  }
  endCallLocal();
}

async function handleCallSignal(data) {
  const from = data.fromUserId;
  if (!from || (callState === 'idle' && data.signal?.type !== 'offer')) return;

  if (data.signal?.type === 'offer') {
    if (callState !== 'connecting' && callState !== 'incoming' && callState !== 'active') return;
    selectedPeerId = from;
    try {
      await attachLocalMedia(activeCallType === 'video');
      const pc = await ensurePeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendCallSignal(from, { type: 'answer', sdp: answer }, activeCallType, activeCallId);
      callState = 'active';
      setCallUiMode('active');
      document.getElementById('callStatus').textContent = `On call with ${selectedPeerName}`;
    } catch {
      showToast('Could not connect call', true);
      hangUpCall('declined');
    }
  } else if (data.signal?.type === 'answer' && peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
    callState = 'active';
    setCallUiMode('active');
  } else if (data.signal?.type === 'ice' && data.signal.candidate && peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
    } catch {
      /* ignore */
    }
  }
}

function toggleMute() {
  if (!localStream) return;
  isMicMuted = !isMicMuted;
  localStream.getAudioTracks().forEach((t) => {
    t.enabled = !isMicMuted;
  });
  document.getElementById('btnMute').textContent = isMicMuted ? '🔇' : '🎤';
}

function toggleVideo() {
  if (!localStream) return;
  isCamOff = !isCamOff;
  localStream.getVideoTracks().forEach((t) => {
    t.enabled = !isCamOff;
  });
  document.getElementById('btnToggleVideo').textContent = isCamOff ? '📷' : '📹';
  document.getElementById('localVideo').style.display = isCamOff ? 'none' : 'block';
}

function endCallLocal() {
  callState = 'idle';
  activeCallId = null;
  incomingCallerId = null;
  document.getElementById('callOverlay').classList.add('hidden');
  if (screenTrack) {
    screenTrack.stop();
    screenTrack = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  document.getElementById('localVideo').srcObject = null;
  document.getElementById('remoteVideo').srcObject = null;
  document.getElementById('screenShareVideo')?.remove();
}

function hangUpCall(logStatus = 'completed') {
  const peer = selectedPeerId;
  const duration = callStartedAt ? Math.floor((Date.now() - callStartedAt) / 1000) : 0;
  if (peer && activeCallId) endCall(peer, activeCallId);
  if (peer && logStatus && callState === 'active') {
    logCallEntry(peer, logStatus, isCaller ? 'outgoing' : 'incoming', duration);
  }
  endCallLocal();
}

function switchSidePanel(side) {
  if (side === 'friends') {
    window.location.href = 'friends.html';
    return;
  }
  document
    .querySelectorAll('[data-side]')
    .forEach((b) => b.classList.toggle('active', b.dataset.side === side));
  document.getElementById('panelChats')?.classList.toggle('is-active', side === 'chats');
  document.getElementById('panelCalls')?.classList.toggle('is-active', side === 'calls');
  if (side === 'calls') loadCallLogs();
}

function setupSidebarTabs() {
  document.querySelectorAll('[data-side]').forEach((btn) => {
    btn.addEventListener('click', () => switchSidePanel(btn.dataset.side));
  });
  document.querySelectorAll('[data-req-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      friendReqTab = btn.dataset.reqTab;
      document
        .querySelectorAll('[data-req-tab]')
        .forEach((b) => b.classList.toggle('active', b === btn));
      loadRequests();
    });
  });
}

function bindCallUi() {
  document.getElementById('btnAcceptCall')?.addEventListener('click', acceptIncomingCall);
  document.getElementById('btnDeclineCall')?.addEventListener('click', declineIncomingCall);
  document.getElementById('btnCancelRinging')?.addEventListener('click', cancelOutgoingCall);
  document.getElementById('btnEndCall')?.addEventListener('click', () => hangUpCall('completed'));
  document.getElementById('btnMute')?.addEventListener('click', toggleMute);
  document.getElementById('btnToggleVideo')?.addEventListener('click', toggleVideo);
  document.getElementById('btnScreenShare')?.addEventListener('click', toggleScreenShareChat);
  document.getElementById('btnCallDismiss')?.addEventListener('click', dismissCallEnded);
  document.getElementById('btnCallBack')?.addEventListener('click', callBackFromDeclined);
}

async function initChat() {
  const user = getStoredUser();
  if (!user || !isLoggedIn()) {
    redirectToLogin('chat.html');
    return;
  }
  currentUserId = user?.id;
  if (document.getElementById('waHeaderSlot')) injectWaHeader('Chats');
  if (document.getElementById('waNavSlot')) injectWaNav('chat');
  connectSocket();
  refreshNotifBadge();
  onWs('notification', () => refreshNotifBadge());
  onWs('friend:refresh', () => {
    loadRequests();
    loadContacts();
    const q = document.getElementById('friendSearch')?.value?.trim();
    if (q) searchUsers(q);
  });

  onWs('typing', (data) => {
    if (data.fromUserId === selectedPeerId) {
      showTypingIndicator(selectedPeerName);
    }
  });

  setChatView(false);
  setupSidebarTabs();
  bindCallUi();
  bindMsgMenu();
  setupChatMenu();
  setupWallpaperPicker();

  document.getElementById('btnBackToContacts')?.addEventListener('click', () => setChatView(false));

  document.getElementById('friendSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchUsers(e.target.value), 300);
  });

  document.getElementById('chatForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  document.getElementById('chatInput')?.addEventListener('input', () => {
    clearTimeout(typingTimer);
    sendTypingSignal();
    typingTimer = setTimeout(() => {}, 500);
  });

  document.getElementById('chatImageInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = document.getElementById('chatImagePreview');
    const img = document.getElementById('chatImagePreviewImg');
    img.src = URL.createObjectURL(file);
    preview?.classList.remove('hidden');
  });

  document.getElementById('cancelImagePreview')?.addEventListener('click', () => {
    document.getElementById('chatImageInput').value = '';
    document.getElementById('chatImagePreview')?.classList.add('hidden');
  });

  document.getElementById('cancelReply')?.addEventListener('click', () => {
    replyToId = null;
    document.getElementById('replyPreview')?.classList.add('hidden');
  });

  document.getElementById('btnToggleSearch')?.addEventListener('click', () => {
    const bar = document.getElementById('chatSearchBar');
    const isHidden = bar?.classList.contains('d-none');
    bar?.classList.toggle('d-none', !isHidden);
    if (isHidden) {
      document.getElementById('chatSearchInput')?.focus();
    } else {
      document.getElementById('chatSearchInput').value = '';
      document.getElementById('chatSearchCount').textContent = '';
      chatSearchResults = [];
      document
        .querySelectorAll('.wa-bubble-row')
        .forEach((r) => r.classList.remove('wa-search-highlight'));
    }
  });

  document.getElementById('btnCloseSearch')?.addEventListener('click', () => {
    document.getElementById('chatSearchBar')?.classList.add('d-none');
    document.getElementById('chatSearchInput').value = '';
    document.getElementById('chatSearchCount').textContent = '';
    chatSearchResults = [];
    document
      .querySelectorAll('.wa-bubble-row')
      .forEach((r) => r.classList.remove('wa-search-highlight'));
  });

  document.getElementById('chatSearchInput')?.addEventListener('input', (e) => {
    chatSearch(e.target.value);
  });

  document.getElementById('chatSearchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) navigateSearchResult(-1);
      else navigateSearchResult(1);
    }
  });

  document.getElementById('btnVoiceCall')?.addEventListener('click', () => startCall(false));
  document.getElementById('btnVideoCall')?.addEventListener('click', () => startCall(true));

  await loadContacts();
  loadRequests();
  loadCallLogs();
  loadSavedWallpaper();

  onWs('message', (data) => {
    const m = data.message;
    if (!m) return;
    const peerId = m.sender_id === currentUserId ? m.recipient_id : m.sender_id;
    const inThread = peerId === selectedPeerId;
    if (inThread) appendBubble(m);
    loadContacts();
  });

  onWs('message:update', (data) => {
    if (data.message) updateBubbleInDom(data.message);
  });

  onWs('message:reaction', (data) => {
    const el = document.querySelector(`.wa-bubble-row[data-msg-id="${data.messageId}"]`);
    if (!el || !data.reactions) return;
    let row = el.querySelector('.wa-bubble-reactions');
    if (!row) {
      row = document.createElement('div');
      row.className = 'wa-bubble-reactions';
      el.querySelector('time')?.before(row);
    }
    row.innerHTML = data.reactions
      .map((r) => `<span class="wa-reaction-chip">${r.emoji}</span>`)
      .join('');
  });

  onWs('call:invite', (data) => {
    if (callState !== 'idle') {
      sendCallBusy(data.fromUserId, data.callId);
      return;
    }
    showIncomingCall(data);
  });

  onWs('call:accept', (data) => {
    if (callState === 'outgoing' && data.callId === activeCallId) {
      document.getElementById('callSubstatus').textContent = 'Connected — starting…';
      beginCallerMedia();
    }
  });

  onWs('call:decline', (data) => {
    if (data.callId !== activeCallId) return;
    logCallEntry(selectedPeerId, 'declined', isCaller ? 'outgoing' : 'incoming');
    showCallEndedUi('Call declined', isCaller);
  });

  onWs('call:busy', () => {
    showToast('They are on another call', true);
    logCallEntry(selectedPeerId, 'busy', 'outgoing');
    endCallLocal();
  });

  onWs('call:cancel', () => {
    logCallEntry(incomingCallerId || selectedPeerId, 'missed', 'incoming');
    endCallLocal();
  });

  onWs('call:signal', handleCallSignal);
  onWs('call:end', () => {
    if (callState === 'active') hangUpCall('completed');
    else endCallLocal();
  });

  window.addEventListener('ws-message', (e) => {
    if (e.detail?.type === 'call:end') {
      if (callState === 'active') hangUpCall('completed');
      else endCallLocal();
    }
  });

  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'friends' || params.get('tab') === 'requests') {
    window.location.replace('friends.html');
    return;
  }
  if (params.get('tab') === 'calls') switchSidePanel('calls');
  const openUser = params.get('user');
  if (openUser) {
    const { contacts } = await authFetch('/messages/contacts');
    const c = contacts.find((x) => x.id === Number(openUser));
    if (c) openChat(c.id, c.display_name || c.name);
  }
}

document.addEventListener('DOMContentLoaded', initChat);
