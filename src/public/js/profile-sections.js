function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function showFormMsg(el, text, isError = false) {
  el.textContent = text;
  el.classList.remove('hidden', 'form-msg--error', 'form-msg--success');
  el.classList.add(isError ? 'form-msg--error' : 'form-msg--success');
}

function setupTabs() {
  const tabs = document.querySelectorAll('.profile-tab');
  const sections = document.querySelectorAll('.profile-section');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.section;
      tabs.forEach((t) => t.classList.toggle('profile-tab--active', t === tab));
      sections.forEach((s) => {
        const active = s.id === `section-${id}`;
        s.classList.toggle('hidden', !active);
        s.classList.toggle('profile-section--active', active);
      });
    });
  });
}

async function loadSettings() {
  const { settings } = await authFetch('/profile/settings');
  document.getElementById('settingsName').value = settings.name ?? '';
  document.getElementById('settingsAvatar').value = settings.avatar ?? '';
  document.getElementById('settingsCampus').value = settings.campus ?? '';
  document.getElementById('settingsPhone').value = settings.phone ?? '';
  document.getElementById('settingsBio').value = settings.bio ?? '';
  document.getElementById('settingsEmail').textContent = settings.email ?? '';
}

async function loadPayment() {
  const { payment } = await authFetch('/profile/payment');
  document.getElementById('paymentBillingName').value = payment.billing_name ?? '';
  document.getElementById('paymentMethod').value = payment.payment_method ?? '';
  document.getElementById('paymentCardLast4').value = payment.card_last4 ?? '';
}

function setupSettingsForm() {
  const form = document.getElementById('settingsForm');
  const msg = document.getElementById('settingsMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await authFetch('/profile/settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: document.getElementById('settingsName').value,
          avatar: document.getElementById('settingsAvatar').value,
          campus: document.getElementById('settingsCampus').value,
          phone: document.getElementById('settingsPhone').value,
          bio: document.getElementById('settingsBio').value,
        }),
      });
      showFormMsg(msg, 'Settings saved.');
      const user = getStoredUser();
      if (user) {
        user.name = document.getElementById('settingsName').value;
        setAuth(user, getToken());
        updateNavForUser(user);
      }
    } catch (err) {
      showFormMsg(msg, err.message, true);
    }
  });
}

function setupPaymentForm() {
  const form = document.getElementById('paymentForm');
  const msg = document.getElementById('paymentMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await authFetch('/profile/payment', {
        method: 'PUT',
        body: JSON.stringify({
          billing_name: document.getElementById('paymentBillingName').value,
          payment_method: document.getElementById('paymentMethod').value,
          card_last4: document.getElementById('paymentCardLast4').value,
        }),
      });
      showFormMsg(msg, 'Payment details saved.');
    } catch (err) {
      showFormMsg(msg, err.message, true);
    }
  });
}

async function renderFriends() {
  const [{ friends }, { candidates }] = await Promise.all([
    authFetch('/profile/friends'),
    authFetch('/profile/friends/candidates'),
  ]);

  const friendsList = document.getElementById('friendsList');
  friendsList.innerHTML =
    friends.length === 0
      ? '<li class="profile-list-empty">No friends yet.</li>'
      : friends
          .map(
            (f) => `
        <li class="profile-list-item">
          <span>${escapeHtml(f.name)}</span>
          <button type="button" class="btn-neon btn-neon--small" data-remove-friend="${f.id}">Remove</button>
        </li>`,
          )
          .join('');

  friendsList.querySelectorAll('[data-remove-friend]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await authFetch(`/profile/friends/${btn.dataset.removeFriend}`, { method: 'DELETE' });
      await renderFriends();
    });
  });

  const candidatesList = document.getElementById('friendCandidates');
  candidatesList.innerHTML =
    candidates.length === 0
      ? '<li class="profile-list-empty">No one to add.</li>'
      : candidates
          .map(
            (c) => `
        <li class="profile-list-item">
          <span>${escapeHtml(c.name)}</span>
          <button type="button" class="btn-neon btn-neon--filled btn-neon--small" data-add-friend="${c.id}">Add</button>
        </li>`,
          )
          .join('');

  candidatesList.querySelectorAll('[data-add-friend]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await authFetch('/profile/friends', {
        method: 'POST',
        body: JSON.stringify({ friendId: Number(btn.dataset.addFriend) }),
      });
      await renderFriends();
    });
  });
}

async function renderSavedPosts() {
  const { posts } = await authFetch('/profile/saved-posts');
  const list = document.getElementById('savedPostsList');
  list.innerHTML =
    posts.length === 0
      ? '<li class="profile-list-empty">No saved posts yet.</li>'
      : posts
          .map(
            (p) => `
      <li class="profile-card-item">
        <span class="profile-card-badge">${escapeHtml(p.category)}</span>
        <h4>${escapeHtml(p.title)}</h4>
        <p>${escapeHtml(p.content)}</p>
        <button type="button" class="btn-neon btn-neon--small" data-unsave="${p.id}">Unsave</button>
      </li>`,
          )
          .join('');

  list.querySelectorAll('[data-unsave]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await authFetch(`/profile/saved-posts/${btn.dataset.unsave}`, { method: 'DELETE' });
      await renderSavedPosts();
    });
  });
}

async function renderPostHistory() {
  const { posts } = await authFetch('/profile/posts');
  const list = document.getElementById('postHistoryList');
  list.innerHTML =
    posts.length === 0
      ? '<li class="profile-list-empty">You have not posted on the wall yet.</li>'
      : posts
          .map(
            (p) => `
      <li class="profile-card-item">
        <span class="profile-card-badge">${escapeHtml(p.category)}</span>
        <h4>${escapeHtml(p.title)}</h4>
        <p>${escapeHtml(p.content)}</p>
        <time class="profile-card-time">${new Date(p.created_at).toLocaleString()}</time>
      </li>`,
          )
          .join('');
}

async function renderGroups() {
  const { groups } = await authFetch('/profile/groups');
  const list = document.getElementById('groupsList');
  list.innerHTML =
    groups.length === 0
      ? '<li class="profile-list-empty">You have not joined any study groups yet.</li>'
      : groups
          .map(
            (g) => `
      <li class="profile-card-item">
        <h4>${escapeHtml(g.name)}</h4>
        <p>${escapeHtml(g.description)}</p>
        <p class="profile-card-meta">${escapeHtml(g.school)} · ${escapeHtml(g.module)} · ${escapeHtml(g.member_role)}</p>
      </li>`,
          )
          .join('');
}

function renderChatroomMessages(messages) {
  const feed = document.getElementById('chatroomMessages');
  feed.innerHTML =
    messages.length === 0
      ? '<p class="profile-list-empty">No messages yet — be the first!</p>'
      : messages
          .map(
            (m) => `
      <div class="chatroom-msg">
        <strong>${escapeHtml(m.user_name)}</strong>
        <p>${escapeHtml(m.message)}</p>
        <time>${new Date(m.created_at).toLocaleString()}</time>
      </div>`,
          )
          .join('');
  feed.scrollTop = feed.scrollHeight;
}

async function loadChatroom() {
  const { messages } = await authFetch('/profile/chatroom');
  renderChatroomMessages(messages);
}

function setupChatroomForm() {
  const form = document.getElementById('chatroomForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chatroomInput');
    const text = input.value.trim();
    if (!text) return;
    await authFetch('/profile/chatroom', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    });
    input.value = '';
    await loadChatroom();
  });
}

async function initProfileHub(userId) {
  document.getElementById('profileHub').classList.remove('hidden');
  setupTabs();
  setupSettingsForm();
  setupPaymentForm();
  setupChatroomForm();

  try {
    await Promise.all([
      loadSettings(),
      loadPayment(),
      renderFriends(),
      renderSavedPosts(),
      renderPostHistory(),
      renderGroups(),
      loadChatroom(),
    ]);
    if (typeof initPersonalChat === 'function') {
      initPersonalChat(userId);
    }
  } catch (err) {
    console.error(err);
  }
}
