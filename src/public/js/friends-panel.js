const AVATAR_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6'];

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function userAvatarHtml(u, size = 'md') {
  const initials = (u.avatar || u.name || '?').slice(0, 2).toUpperCase();
  if (u.profile_image) {
    return `<span class="user-avatar user-avatar--${size}"><img src="${esc(u.profile_image)}" alt="" /></span>`;
  }
  return `<span class="user-avatar user-avatar--${size}" style="background:${avatarColor(u.name)}">${esc(initials)}</span>`;
}

function relationshipButton(u) {
  const st = u.relationship || 'none';
  if (st === 'friends') {
    return `<span class="rel-badge rel-badge--friends">Friends</span>`;
  }
  if (st === 'pending_sent') {
    return `<button type="button" class="btn-rel btn-rel--pending" disabled>Pending</button>`;
  }
  if (st === 'pending_received') {
    return `<button type="button" class="btn-rel btn-rel--accept" data-accept="${u.request_id}">Accept</button>
      <button type="button" class="btn-rel btn-rel--decline" data-decline="${u.request_id}">Decline</button>`;
  }
  return `<button type="button" class="btn-rel btn-rel--add" data-add="${u.id}">+ Add</button>`;
}

function userRowHtml(u, opts = {}) {
  const mutual = u.mutual_friends != null ? `${u.mutual_friends} mutual friends` : '';
  const sub = `@${esc(u.username || u.name?.toLowerCase().replace(/\s/g, '') || 'user')}${mutual ? ' · ' + mutual : ''}`;
  return `
    <li class="friend-row" data-user-id="${u.id}">
      <button type="button" class="friend-row__main" data-open-profile="${u.id}">
        ${userAvatarHtml(u)}
        <span class="friend-row__info">
          <strong>${esc(u.display_name || u.name)}</strong>
          <span class="friend-row__sub">${sub}</span>
        </span>
      </button>
      <div class="friend-row__actions">${opts.actions || relationshipButton(u)}</div>
    </li>`;
}

let searchTimer = null;
let requestTab = 'received';

async function searchUsers(q) {
  const list = document.getElementById('findPeopleList');
  if (!list) return;
  if (!q.trim()) {
    list.innerHTML = '<li class="profile-list-empty">Search by name or username.</li>';
    return;
  }
  try {
    const { users } = await authFetch(`/friends/search?q=${encodeURIComponent(q)}`);
    list.innerHTML =
      users.length === 0
        ? '<li class="profile-list-empty">No users found.</li>'
        : users.map((u) => userRowHtml(u)).join('');
    bindFriendRowActions(list);
  } catch (err) {
    list.innerHTML = `<li class="profile-list-empty">${err.message}</li>`;
  }
  list.querySelectorAll('[data-open-profile]').forEach((btn) => {
    btn.addEventListener('click', () => openUserProfile(btn.dataset.openProfile));
  });
}

function bindFriendRowActions(root) {
  root.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await authFetch('/friends/request', {
          method: 'POST',
          body: JSON.stringify({ receiver_id: Number(btn.dataset.add) }),
        });
        const q = document.getElementById('friendSearch')?.value || '';
        searchUsers(q);
        loadFriendRequests();
      } catch (err) {
        if (typeof showToast === 'function') showToast(err.message, true);
      }
    });
  });
  root.querySelectorAll('[data-accept]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await authFetch('/friends/accept', {
        method: 'POST',
        body: JSON.stringify({ request_id: Number(btn.dataset.accept) }),
      });
      refreshFriendsPanels();
    });
  });
  root.querySelectorAll('[data-decline]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await authFetch('/friends/decline', {
        method: 'POST',
        body: JSON.stringify({ request_id: Number(btn.dataset.decline) }),
      });
      refreshFriendsPanels();
    });
  });
}

async function loadFriendRequests() {
  const [{ requests: received }, { requests: sent }] = await Promise.all([
    authFetch('/friends/requests?tab=received'),
    authFetch('/friends/requests?tab=sent'),
  ]);
  const badge = document.getElementById('reqBadge');
  if (badge) badge.textContent = received.length;
  const list = document.getElementById('friendRequestsList');
  if (!list) return;
  const items = requestTab === 'received' ? received : sent;
  list.innerHTML =
    items.length === 0
      ? '<li class="profile-list-empty">No requests.</li>'
      : items
          .map((item) => {
            const u = {
              ...item.user,
              request_id: item.request_id,
              created_at: item.created_at,
              relationship: requestTab === 'received' ? 'pending_received' : 'pending_sent',
            };
            const ago = item.created_at ? new Date(item.created_at).toLocaleString() : '';
            const actions =
              requestTab === 'received'
                ? `<button type="button" class="btn-rel btn-rel--accept" data-accept="${item.request_id}">✓</button>
                 <button type="button" class="btn-rel btn-rel--decline" data-decline="${item.request_id}">✕</button>`
                : `<button type="button" class="btn-rel btn-rel--decline" data-decline="${item.request_id}">Cancel</button>`;
            const row = userRowHtml(u, { actions });
            return row.replace(
              '<span class="friend-row__sub">',
              `<span class="friend-row__sub">${esc(ago)} · `,
            );
          })
          .join('');
  bindFriendRowActions(list);
}

async function loadFriendsList() {
  const { friends } = await authFetch('/friends');
  const badge = document.getElementById('friendsBadge');
  if (badge) badge.textContent = friends.length;
  const list = document.getElementById('yourFriendsList');
  if (!list) return;
  list.innerHTML =
    friends.length === 0
      ? '<li class="profile-list-empty">No friends yet — search above to connect.</li>'
      : friends
          .map((u) => {
            const since = u.friends_since ? `Friends since ${new Date(u.friends_since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : '';
            const actions = `
          <button type="button" class="btn-rel btn-rel--message" data-message="${u.id}">Message</button>
          <button type="button" class="btn-rel btn-rel--unfriend" data-unfriend="${u.id}" title="Unfriend">−</button>`;
            return userRowHtml(u, { actions }).replace(
              '</span>\n        </span>',
              `</span><span class="friend-row__sub">${esc(since)}</span></span>`,
            );
          })
          .join('');
  list.querySelectorAll('[data-message]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelector('[data-section="messages"]')?.click();
      window.dispatchEvent(new CustomEvent('open-dm', { detail: { userId: Number(btn.dataset.message) } }));
    });
  });
  list.querySelectorAll('[data-unfriend]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this friend?')) return;
      await authFetch(`/friends/${btn.dataset.unfriend}`, { method: 'DELETE' });
      refreshFriendsPanels();
    });
  });
  list.querySelectorAll('[data-open-profile]').forEach((btn) => {
    btn.addEventListener('click', () => openUserProfile(btn.dataset.openProfile));
  });
}

async function openUserProfile(userId) {
  if (!document.getElementById('userProfileModal')) {
    window.location.href = `profile.html?id=${userId}`;
    return;
  }
  const modal = document.getElementById('userProfileModal');
  const body = document.getElementById('userProfileBody');
  if (!modal || !body) return;
  const { profile } = await authFetch(`/friends/users/${userId}/profile`);
  body.innerHTML = `
    <div class="user-profile-modal__hero">
      ${userAvatarHtml(profile, 'lg')}
      <h3>${esc(profile.display_name || profile.name)}</h3>
      <p>@${esc(profile.username || profile.name)}</p>
      ${profile.bio ? `<p class="user-profile-modal__bio">${esc(profile.bio)}</p>` : ''}
      <p class="user-profile-modal__meta">${profile.mutual_friends ?? 0} mutual friends</p>
    </div>
    <div class="user-profile-modal__actions" id="profileModalActions"></div>`;
  const actions = document.getElementById('profileModalActions');
  if (actions) {
    actions.innerHTML = relationshipButton(profile);
    if (profile.relationship === 'friends') {
      actions.innerHTML += `<button type="button" class="btn-neon" data-message="${profile.id}">Message</button>`;
    }
    bindFriendRowActions(actions);
    actions.querySelector('[data-message]')?.addEventListener('click', () => {
      modal.classList.add('hidden');
      document.querySelector('[data-section="messages"]')?.click();
      window.dispatchEvent(new CustomEvent('open-dm', { detail: { userId: profile.id } }));
    });
  }
  modal.classList.remove('hidden');
}

function refreshFriendsPanels() {
  const q = document.getElementById('friendSearch')?.value || '';
  if (q) searchUsers(q);
  loadFriendRequests();
  loadFriendsList();
}

let friendsPanelBound = false;

function initFriendsPanel() {
  if (!friendsPanelBound) {
    friendsPanelBound = true;
    bindFriendsPanelEvents();
  }
  refreshFriendsPanels();
}

function bindFriendsPanelEvents() {
  document.getElementById('friendSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchUsers(e.target.value), 300);
  });
  document.querySelectorAll('[data-request-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      requestTab = tab.dataset.requestTab;
      document.querySelectorAll('[data-request-tab]').forEach((t) => {
        t.classList.toggle('friends-tab--active', t === tab);
      });
      loadFriendRequests();
    });
  });
  const closeModal = () => document.getElementById('userProfileModal')?.classList.add('hidden');
  document.getElementById('userProfileModalClose')?.addEventListener('click', closeModal);
  document.getElementById('userProfileModalCloseBtn')?.addEventListener('click', closeModal);
}
