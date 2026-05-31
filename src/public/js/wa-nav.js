function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function renderWaNav(active) {
  return `
    <nav class="wa-bottom-nav">
      <a href="home.html" class="${active === 'home' ? 'wa-nav--active' : ''}">🏠 Home</a>
      <a href="chat.html" class="${active === 'chat' ? 'wa-nav--active' : ''}">💬 Chats</a>
      <a href="stories.html" class="${active === 'stories' ? 'wa-nav--active' : ''}">📷 Status</a>
      <a href="settings.html" class="${active === 'settings' ? 'wa-nav--active' : ''}">⚙ Settings</a>
    </nav>`;
}

function injectWaNav(active) {
  const el = document.getElementById('waNavSlot');
  if (!el) return;
  if (!isLoggedIn()) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = renderWaNav(active);
}

function renderNotifBell() {
  const unread = window.__notifUnread || 0;
  const badge = unread > 0 ? `<span class="wa-bell-badge">${unread > 99 ? '99+' : unread}</span>` : '';
  return `
    <div class="wa-bell-wrap">
      <button type="button" class="wa-bell-btn" id="waNotifBell" aria-label="Notifications">🔔${badge}</button>
      <div id="waNotifDropdown" class="wa-notif-dropdown hidden" role="menu">
        <div class="wa-notif-dropdown__head">
          <strong>Notifications</strong>
          <button type="button" class="wa-link-btn" id="waNotifMarkAll">Mark all read</button>
        </div>
        <div id="waNotifDropdownList" class="wa-notif-dropdown__list"></div>
      </div>
    </div>`;
}

function injectHeaderActions(slotId = 'waHeaderSlot') {
  const slot = document.getElementById(slotId);
  if (!slot || !isLoggedIn()) return;
  slot.innerHTML = `${renderNotifBell()}<button type="button" class="wa-btn wa-btn--ghost wa-btn--small" id="waHeaderLogout">Log out</button>`;
  bindNotificationBell();
  document.getElementById('waHeaderLogout')?.addEventListener('click', () => {
    if (typeof handleLogout === 'function') handleLogout();
  });
}

function injectWaHeader(title, opts = {}) {
  const slot = document.getElementById('waHeaderSlot');
  if (!slot) return;
  if (opts.actionsOnly) {
    injectHeaderActions('waHeaderSlot');
    return;
  }
  const user = getStoredUser();
  const bell = user && opts.bell !== false ? renderNotifBell() : '';
  const logout = user
    ? `<button type="button" class="wa-btn wa-btn--ghost wa-btn--small" id="waHeaderLogout">Log out</button>`
    : '';
  slot.innerHTML = `
    <header class="wa-topbar">
      <h1>${esc(title)}</h1>
      <div class="wa-topbar-actions">${bell}${logout}</div>
    </header>`;
  if (user && opts.bell !== false) bindNotificationBell();
  document.getElementById('waHeaderLogout')?.addEventListener('click', () => {
    if (typeof handleLogout === 'function') handleLogout();
  });
}

function showToast(text, isError = false) {
  let t = document.getElementById('waToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'waToast';
    t.className = 'wa-toast hidden';
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.style.borderColor = isError ? 'var(--wa-danger)' : 'var(--wa-green)';
  t.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}

async function refreshNotifBadge() {
  if (!isLoggedIn()) {
    window.__notifUnread = 0;
    return;
  }
  try {
    const { unread } = await authFetch('/notifications');
    window.__notifUnread = unread;
    updateBellBadge(unread);
  } catch {
    /* ignore */
  }
}

async function loadNotifDropdown() {
  const list = document.getElementById('waNotifDropdownList');
  if (!list || !isLoggedIn()) return;
  try {
    const { notifications, unread } = await authFetch('/notifications');
    window.__notifUnread = unread;
    updateBellBadge(unread);

    if (notifications.length === 0) {
      list.innerHTML = '<p class="wa-notif-empty">No notifications</p>';
      return;
    }
    list.innerHTML = notifications
      .map(
        (n) => `
      <button type="button" class="wa-notif-drop-item ${n.read ? '' : 'unread'}" data-id="${n.id}" data-type="${esc(n.type)}" data-ref="${n.ref_id || ''}">
        <strong>${esc(n.title)}</strong>
        <span>${esc(n.body)}</span>
        <small>${new Date(n.created_at).toLocaleString()}</small>
      </button>`,
      )
      .join('');

    list.querySelectorAll('.wa-notif-drop-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await authFetch(`/notifications/${btn.dataset.id}/read`, { method: 'PATCH' });
        document.getElementById('waNotifDropdown')?.classList.add('hidden');
        if (btn.dataset.type === 'message' && btn.dataset.ref) {
          window.location.href = `chat.html?user=${btn.dataset.ref}`;
        } else if (btn.dataset.type === 'friend_request') {
          window.location.href = 'chat.html?tab=friends&requests=received';
        } else {
          loadNotifDropdown();
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="wa-notif-empty">${esc(err.message)}</p>`;
  }
}

function updateBellBadge(unread) {
  const btn = document.getElementById('waNotifBell');
  if (!btn) return;
  const old = btn.querySelector('.wa-bell-badge');
  if (old) old.remove();
  if (unread > 0) {
    const span = document.createElement('span');
    span.className = 'wa-bell-badge';
    span.textContent = unread > 99 ? '99+' : String(unread);
    btn.appendChild(span);
  }
}

function bindNotificationBell() {
  const bell = document.getElementById('waNotifBell');
  const dropdown = document.getElementById('waNotifDropdown');
  if (!bell || !dropdown) return;

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.classList.toggle('hidden');
    if (!open) loadNotifDropdown();
  });

  document.getElementById('waNotifMarkAll')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await authFetch('/notifications/read-all', { method: 'PATCH' });
    loadNotifDropdown();
    refreshNotifBadge();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.wa-bell-wrap')) dropdown.classList.add('hidden');
  });
}

function initAppShell(pageTitle, pageKey, opts = {}) {
  if (!isLoggedIn()) {
    redirectToLogin(pageKey ? `${pageKey}.html` : 'chat.html');
    return;
  }
  injectWaHeader(pageTitle, opts);
  injectWaNav(pageKey);
  if (isLoggedIn()) {
    connectSocket?.();
    refreshNotifBadge();
    onWs?.('notification', () => {
      refreshNotifBadge();
      if (!document.getElementById('waNotifDropdown')?.classList.contains('hidden')) {
        loadNotifDropdown();
      }
    });
  }
}
