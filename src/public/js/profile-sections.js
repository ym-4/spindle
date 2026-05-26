function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function showFormMsg(el, text, isError = false) {
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden', 'form-msg--error', 'form-msg--success');
  el.classList.add(isError ? 'form-msg--error' : 'form-msg--success');
}

function setupTabs() {
  const tabs = document.querySelectorAll('.profile-tab');
  const sections = document.querySelectorAll('.profile-section');

  tabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      const id = tab.dataset.section;
      tabs.forEach((t) => t.classList.toggle('profile-tab--active', t === tab));
      sections.forEach((s) => {
        const active = s.id === `section-${id}`;
        s.classList.toggle('hidden', !active);
        s.classList.toggle('profile-section--active', active);
      });
      if (id === 'friends' && typeof initFriendsPanel === 'function') {
        initFriendsPanel();
      }
      if (id === 'messages' && typeof openMessagesForPeer === 'function') {
        await openMessagesForPeer();
      }
    });
  });
}

function setupPaymentForm() {
  const form = document.getElementById('paymentForm');
  const msg = document.getElementById('paymentMsg');
  if (!form) return;
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

async function initProfileHub(userId) {
  setupTabs();
  setupPaymentForm();
  if (typeof initSettingsPanel === 'function') initSettingsPanel();
  if (typeof initFriendsPanel === 'function') initFriendsPanel();

  try {
    await Promise.all([renderSavedPosts(), renderPostHistory(), renderGroups()]);
    if (typeof initPersonalChat === 'function') {
      initPersonalChat(userId);
    }
  } catch (err) {
    console.error(err);
  }
}
