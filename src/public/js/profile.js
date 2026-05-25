function getInitials(name) {
  return (name || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderProfile(profile) {
  const content = document.getElementById('profileContent');
  const avatarText = profile.avatar || getInitials(profile.name);
  const displayAvatar = avatarText.length <= 3 ? avatarText : getInitials(profile.name);
  const stats = profile.stats || {};
  const roleBadge =
    profile.role === 'admin'
      ? '<span class="role-badge role-badge--admin">Admin</span>'
      : '<span class="role-badge">User</span>';

  const card = document.createElement('div');
  card.className = 'profile-card';
  card.innerHTML = `
    <div class="profile-intro">
      <p class="profile-tagline">Player Profile</p>
      <h2 class="profile-welcome">Your campus stats board</h2>
      <p class="profile-blurb">
        This is your home base on Campus Hub — see how active you are across posts, comments,
        friends, groups, and marketplace listings. Level up by joining discussions and trading
        with classmates.
      </p>
    </div>
    <div class="profile-header">
      <div class="profile-avatar">${escapeHtml(displayAvatar)}</div>
      <div>
        <h1>${escapeHtml(profile.name)} ${roleBadge}</h1>
        <p>${escapeHtml(profile.email)}</p>
      </div>
    </div>
    <div class="stats-grid"></div>
  `;

  const grid = card.querySelector('.stats-grid');
  [
    ['Posts', stats.posts ?? 0],
    ['Comments', stats.comments ?? 0],
    ['Friends', stats.friends ?? 0],
    ['Groups', stats.groups ?? 0],
    ['Listings', stats.marketplace_items ?? 0],
  ].forEach(([label, value]) => {
    const tile = document.createElement('div');
    tile.className = 'stat-tile';
    tile.innerHTML = `<span class="stat-value">${value}</span><span class="stat-label">${label}</span>`;
    grid.appendChild(tile);
  });

  content.innerHTML = '';
  content.appendChild(card);
}

async function loadProfile() {
  const loading = document.getElementById('profileLoading');
  const errorEl = document.getElementById('profileError');
  const content = document.getElementById('profileContent');
  const user = getStoredUser();

  if (!isLoggedIn()) {
    redirectToLogin('profile.html');
    return;
  }

  if (isAdmin(user)) {
    window.location.href = 'admin.html';
    return;
  }

  try {
    const profile = await authFetch('/auth/me');
    loading.classList.add('hidden');
    content.classList.remove('hidden');
    renderProfile(profile);
    if (typeof initProfileHub === 'function') {
      initProfileHub(profile.id);
    }
  } catch (err) {
    if (err.message?.match(/authentication|token|401/i)) {
      clearAuth();
      redirectToLogin('profile.html');
      return;
    }
    loading.classList.add('hidden');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateNavForUser(getStoredUser());
  loadProfile();
});
