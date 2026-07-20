function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function handleNavbarLogout(event) {
  event.preventDefault();
  if (typeof handleLogout === 'function') {
    handleLogout();
    return;
  }
  clearAuth?.();
  window.location.href = 'home.html';
}

function ensureAuthButtons() {
  const target = document.querySelector('.navbar-right');
  if (!target) return;

  const page = window.location.pathname.split('/').pop() || 'index.html';
  const returnPath = encodeURIComponent(page === 'home.html' ? 'index.html' : page);

  if (!document.getElementById('loginButton')) {
    const loginButton = document.createElement('a');
    loginButton.id = 'loginButton';
    loginButton.href = `home.html?login=1&tab=login&return=${returnPath}`;
    loginButton.className = 'btn-navbar-login';
    loginButton.textContent = 'Log In';
    target.prepend(loginButton);
  }

  if (!document.getElementById('registerButton')) {
    const registerButton = document.createElement('a');
    registerButton.id = 'registerButton';
    registerButton.href = `home.html?login=1&tab=register&return=${returnPath}`;
    registerButton.className = 'btn-navbar-signup';
    registerButton.textContent = 'Sign Up';
    target.prepend(registerButton);
  }
}

function syncLegacyNavbar() {
  ensureAuthButtons();

  const loggedIn =
    typeof isLoggedIn === 'function'
      ? isLoggedIn()
      : !!(localStorage.getItem('token') || localStorage.getItem('pineappleToken'));
  const loginButton = document.getElementById('loginButton');
  const registerButton = document.getElementById('registerButton');
  const profileButton = document.getElementById('profileButton');
  const logoutButton = document.getElementById('logoutButton');
  const guestActions = document.getElementById('navGuest');
  const userActions = document.getElementById('navUser');

  [loginButton, registerButton].forEach((button) => {
    if (!button) return;
    button.classList.toggle('d-none', loggedIn);
    button.classList.toggle('hidden', loggedIn);
    button.style.display = loggedIn ? 'none' : '';
  });

  [profileButton, logoutButton].forEach((button) => {
    if (!button) return;
    button.classList.toggle('d-none', !loggedIn);
    button.classList.toggle('hidden', !loggedIn);
    button.style.display = loggedIn ? '' : 'none';
  });

  if (guestActions && userActions) {
    guestActions.classList.toggle('hidden', loggedIn);
    guestActions.style.display = loggedIn ? 'none' : '';
    userActions.classList.toggle('hidden', !loggedIn);
    userActions.style.display = loggedIn ? '' : 'none';
  }

  if (logoutButton) {
    logoutButton.onclick = handleNavbarLogout;
    logoutButton.removeEventListener('click', handleNavbarLogout);
    logoutButton.addEventListener('click', handleNavbarLogout);
  }
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
  const badge =
    unread > 0 ? `<span class="wa-bell-badge">${unread > 99 ? '99+' : unread}</span>` : '';
  const spindle = document.querySelector('#spindleNotifSlot, .spindle-notif-slot');
  const icon = spindle ? '<i class="fas fa-bell"></i>' : '🔔';
  return `
    <div class="wa-bell-wrap">
      <button type="button" class="wa-bell-btn" id="waNotifBell" aria-label="Notifications">${icon}${badge}</button>
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
  refreshNotifBadge();

  const logoutBtn = document.getElementById('waHeaderLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }
}

/** Spindle navbar — notifications only (profile/logout stay in navbar). */
function injectNotificationsOnly(slotId = 'spindleNotifSlot') {
  const slot = document.getElementById(slotId);
  if (!slot || !isLoggedIn()) return;
  slot.classList.add('spindle-notif-slot');
  slot.innerHTML = renderNotifBell();
  bindNotificationBell();
  refreshNotifBadge();
  if (typeof connectSocket === 'function') {
    connectSocket();
    onWs('notification', (payload) => {
      const notif = payload?.notification || payload;
      refreshNotifBadge();
      if (notif?.type === 'badge_unlocked') {
        showBadgeUnlockPopup(notif.title, notif.body);
      }
    });
  }
}

function injectWaHeader(title, opts = {}) {
  const slot = document.getElementById('waHeaderSlot');
  if (!slot) {
    console.warn('Header slot not found, skipping injection.');
    return;
  }

  const loggedIn = !!localStorage.getItem('token');

  let actionsHTML;
  if (loggedIn) {
    const bell = opts.bell !== false ? renderNotifBell() : '';
    actionsHTML = `
            ${bell}
            <a href="chat.html" class="wa-btn wa-btn--ghost" id="navMessages"><i class="fas fa-envelope"></i></a>
            <button type="button" class="wa-btn wa-btn--ghost" id="waHeaderLogout">Log Out</button>
            <a href="profile.html" class="wa-btn">Profile</a>
        `;
  } else {
    actionsHTML = `
            <a href="home.html" class="wa-btn wa-btn--ghost">Log In</a>
            <a href="home.html?login=1" class="wa-btn">Sign Up</a>
        `;
  }

  slot.innerHTML = `
        <header class="wa-topbar">
            <h1>${esc(title)}</h1>
            <div class="wa-topbar-actions">${actionsHTML}</div>
        </header>
    `;

  const logoutBtn = document.getElementById('logoutButton');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const token = localStorage.getItem('token');
        if (token) {
          await fetch('/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (err) {
        console.error('Logout request failed, proceeding to clear local data...');
      }

      clearAuth();
      window.location.href = 'register.html';
    });
  }

  if (loggedIn) {
    if (opts.bell !== false) bindNotificationBell();
    document.getElementById('waHeaderLogout')?.addEventListener('click', performSpindleLogout);
  }
}

async function performSpindleLogout() {
  const token = localStorage.getItem('token');
  try {
    if (token) {
      await fetch('/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.warn('Logout error:', err);
  }

  const keys = ['token', 'loggedInUserId', 'pineappleUser', 'pineappleToken', 'displayName'];
  keys.forEach((k) => localStorage.removeItem(k));

  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
  syncLegacyNavbar();
});

window.addEventListener('storage', syncLegacyNavbar);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncLegacyNavbar();
});

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
          window.location.href = 'friends.html';
        } else if (
          (btn.dataset.type === 'mention' ||
            btn.dataset.type === 'comment' ||
            btn.dataset.type === 'pandabot' ||
            btn.dataset.type === 'comment_reaction' ||
            btn.dataset.type === 'post_reaction') &&
          btn.dataset.ref
        ) {
          window.location.href = `posts.html?id=${btn.dataset.ref}`;
        } else if (btn.dataset.type === 'badge_unlocked') {
          window.location.href = 'profile.html';
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
    const isHidden = dropdown.classList.contains('hidden');
    if (isHidden) {
      dropdown.classList.remove('hidden');
      loadNotifDropdown();
    } else {
      dropdown.classList.add('hidden');
    }
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

function showBadgeUnlockPopup(title, description) {
  document.getElementById('badgeUnlockBackdrop')?.remove();
  document.getElementById('badgeUnlockPopup')?.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'badgeUnlockBackdrop';

  const popup = document.createElement('div');
  popup.id = 'badgeUnlockPopup';
  popup.innerHTML = `
    <div class="badge-unlock-icon">🏅</div>
    <div class="badge-unlock-text">
      <div class="badge-unlock-title">${esc(title)}</div>
      <div class="badge-unlock-desc">${esc(description)}</div>
    </div>`;

  document.body.appendChild(backdrop);
  document.body.appendChild(popup);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      backdrop.classList.add('badge-unlock--visible');
      popup.classList.add('badge-unlock--visible');
    });
  });

  const dismiss = () => {
    backdrop.classList.remove('badge-unlock--visible');
    popup.classList.remove('badge-unlock--visible');
    setTimeout(() => {
      backdrop.remove();
      popup.remove();
    }, 400);
  };

  const autoDismiss = setTimeout(dismiss, 4000);

  const dismissNow = () => {
    clearTimeout(autoDismiss);
    dismiss();
  };

  backdrop.addEventListener('click', dismissNow);
  popup.addEventListener('click', dismissNow);
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
    onWs?.('notification', (payload) => {
      const notif = payload?.notification || payload;
      refreshNotifBadge();
      if (!document.getElementById('waNotifDropdown')?.classList.contains('hidden')) {
        loadNotifDropdown();
      }

      // badge unlocked pop-up
      if (notif?.type === 'badge_unlocked') {
        showBadgeUnlockPopup(notif.title, notif.body);
      }
    });
  }
}
