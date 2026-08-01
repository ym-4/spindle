let currentProfile = null;
let isOwnProfile = false;

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function parseSkills(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function relActions(profile) {
  const st = profile.relationship || 'none';
  if (st === 'friends') {
    return `<a href="chat.html?user=${profile.id}" class="btn btn-primary btn-sm">Message</a>`;
  }
  if (st === 'pending_sent') {
    return '<button type="button" class="btn btn-secondary btn-sm" disabled>Request sent</button>';
  }
  if (st === 'pending_received') {
    return `<button type="button" class="btn btn-primary btn-sm" data-accept="${profile.request_id}">Accept</button>
      <button type="button" class="btn btn-outline-secondary btn-sm" data-decline="${profile.request_id}">Decline</button>`;
  }
  if (isOwnProfile) return '';
  return `<button type="button" class="btn btn-primary btn-sm" data-add="${profile.id}">Add friend</button>`;
}

function bindFriendActions(container) {
  container.querySelector('[data-add]')?.addEventListener('click', async (e) => {
    try {
      await authFetch('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ receiver_id: Number(e.target.dataset.add) }),
      });
      loadUserProfile();
    } catch (err) {
      alert(err.message);
    }
  });
  container.querySelector('[data-accept]')?.addEventListener('click', async (e) => {
    try {
      await authFetch('/friends/accept', {
        method: 'POST',
        body: JSON.stringify({ request_id: Number(e.target.dataset.accept) }),
      });
      loadUserProfile();
    } catch (err) {
      alert(err.message);
    }
  });
  container.querySelector('[data-decline]')?.addEventListener('click', async (e) => {
    try {
      await authFetch('/friends/decline', {
        method: 'POST',
        body: JSON.stringify({ request_id: Number(e.target.dataset.decline) }),
      });
      loadUserProfile();
    } catch (err) {
      alert(err.message);
    }
  });
}

function renderLinks(profile) {
  const items = [];
  if (profile.email) {
    items.push(
      `<li><i class="fas fa-envelope text-muted"></i> <a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></li>`,
    );
  }
  if (profile.link_portfolio) {
    const url = profile.link_portfolio.startsWith('http')
      ? profile.link_portfolio
      : `https://${profile.link_portfolio}`;
    items.push(
      `<li><i class="fas fa-globe text-muted"></i> <a href="${esc(url)}" target="_blank" rel="noopener">Portfolio</a></li>`,
    );
  }
  if (profile.link_github) {
    const url = profile.link_github.startsWith('http')
      ? profile.link_github
      : `https://github.com/${profile.link_github.replace(/^@/, '')}`;
    items.push(
      `<li><i class="fab fa-github text-muted"></i> <a href="${esc(url)}" target="_blank" rel="noopener">GitHub</a></li>`,
    );
  }
  if (profile.link_linkedin) {
    const url = profile.link_linkedin.startsWith('http')
      ? profile.link_linkedin
      : `https://linkedin.com/in/${profile.link_linkedin}`;
    items.push(
      `<li><i class="fab fa-linkedin text-muted"></i> <a href="${esc(url)}" target="_blank" rel="noopener">LinkedIn</a></li>`,
    );
  }
  if (items.length === 0) return '<p class="text-muted small mb-0">No links added yet.</p>';
  return `<ul class="pro-profile__links">${items.join('')}</ul>`;
}

function renderView(profile) {
  const root = document.getElementById('profileRoot');
  const name = profile.display_name || profile.name;
  const skills = parseSkills(profile.skills);
  const stats = profile.stats || {};
  const isPrivate = profile.is_private && !isOwnProfile && profile.relationship !== 'friends';
  const coverStyle =
    profile.cover_image && !isPrivate
      ? `<img src="${esc(mediaUrl(profile.cover_image))}" alt="Cover photo" />`
      : '';
  const avatarInner = profile.profile_image
    ? `<img src="${esc(mediaUrl(profile.profile_image))}" alt="${esc(name)}" />`
    : esc(initials(name));

  const headlineLoc = [profile.headline, profile.location].filter(Boolean).join(' · ');
  const metaExtra =
    profile.mutual_friends != null ? `${profile.mutual_friends} mutual friends` : '';
  const since = profile.member_since
    ? `Member since ${new Date(profile.member_since).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
    : '';

  const backBtn = !isOwnProfile
    ? '<a href="javascript:history.back()" class="btn btn-sm btn-outline-secondary mb-2"><i class="fas fa-arrow-left me-1"></i>Back</a>'
    : '';

  const reportBtn = !isOwnProfile
    ? '<button type="button" class="btn btn-sm btn-outline-danger" id="reportProfileBtn"><i class="fas fa-flag me-1"></i>Report</button>'
    : '';

  if (isPrivate) {
    root.innerHTML = `
      ${backBtn}
      <div class="pro-profile__cover" style="height:120px;background:#f0f0f0;"></div>
      <div class="pro-profile__head">
        <div class="pro-profile__avatar-wrap">
          <div class="pro-profile__avatar">${avatarInner}</div>
        </div>
        <h1 class="pro-profile__name">${esc(name)}</h1>
        <p class="pro-profile__meta-line">@${esc(profile.username || profile.name)}</p>
      </div>
      <div class="text-center py-4">
        <i class="fas fa-lock fa-3x mb-3 text-muted"></i>
        <p class="text-muted">This profile is private.</p>
        <p class="small text-muted">Send a friend request to view their profile.</p>
      </div>
      <div class="pro-profile__friend-actions text-center" id="friendActions">${relActions(profile)}</div>
      ${!isOwnProfile ? `<div class="text-center mt-2">${reportBtn}</div>` : ''}`;
    const rightSidebarPriv = document.getElementById('profileRightSidebar');
    if (rightSidebarPriv) rightSidebarPriv.innerHTML = '';
    if (!isOwnProfile) {
      bindFriendActions(document.getElementById('friendActions'));
      document
        .getElementById('reportProfileBtn')
        ?.addEventListener('click', () => openReportProfileModal(profile.id, name));
    }
    return;
  }

  root.innerHTML = `
    ${backBtn}
    <div class="pro-profile__cover">${coverStyle}
      ${isOwnProfile ? `<label class="btn btn-sm btn-light pro-profile__cover-edit"><i class="fas fa-camera"></i> Cover<input type="file" id="coverFile" accept="image/*" hidden /></label>` : ''}
    </div>
    <div class="pro-profile__head">
      ${
        isOwnProfile
          ? `<div class="pro-profile__actions-top">
        <button type="button" class="btn btn-outline-danger btn-sm" id="btnEditProfile">Edit profile</button>
        <a href="settings.html" class="btn btn-outline-secondary btn-sm">Settings</a>
      </div>`
          : `<div class="pro-profile__actions-top">${reportBtn}</div>`
      }
      <div class="pro-profile__avatar-wrap">
        <div class="pro-profile__avatar">${avatarInner}</div>
        ${isOwnProfile ? `<label class="btn btn-sm btn-light pro-profile__avatar-edit"><i class="fas fa-camera"></i><input type="file" id="avatarFile" accept="image/*" hidden /></label>` : ''}
      </div>
      <h1 class="pro-profile__name">${esc(name)}</h1>
      ${headlineLoc ? `<p class="pro-profile__headline">${esc(headlineLoc)}</p>` : ''}
      <p class="pro-profile__meta-line">@${esc(profile.username || profile.name)}${metaExtra ? ` · ${esc(metaExtra)}` : ''}${since ? ` · ${esc(since)}` : ''}</p>
    </div>
    <div class="pro-profile__stats">
      <div class="pro-profile__stat"><strong>${stats.posts ?? 0}</strong><span>Posts</span></div>
      <div class="pro-profile__stat"><strong>${stats.comments ?? 0}</strong><span>Comments</span></div>
      <div class="pro-profile__stat"><strong>${stats.friends ?? 0}</strong><span>Friends</span></div>
      <div class="pro-profile__stat"><strong>${stats.groups ?? 0}</strong><span>Groups</span></div>
    </div>
     <div class="pro-profile__section" id="badgesSection">
      <h3>Achievements</h3>
      <div class="pro-profile__badges" id="badgesGrid">
        <span class="text-muted small">Loading badges…</span>
      </div>
    </div>
    ${!isOwnProfile ? `<div class="pro-profile__friend-actions" id="friendActions">${relActions(profile)}</div>` : ''}
    <div class="pro-profile__section">
      <h3>About</h3>
      <p class="pro-profile__bio">${profile.bio ? esc(profile.bio) : '<span class="text-muted">No bio yet.</span>'}</p>
    </div>
    <div class="pro-profile__section">
      <h3>Skills</h3>
      <div class="pro-profile__skills">
        ${skills.length ? skills.map((s) => `<span class="pro-profile__skill">${esc(s)}</span>`).join('') : '<span class="text-muted small">No skills listed.</span>'}
      </div>
    </div>
    <div class="pro-profile__section">
      <h3>Links</h3>
      ${renderLinks(profile)}
    </div>`;

  const rightSidebar = document.getElementById('profileRightSidebar');
  if (rightSidebar) {
    rightSidebar.innerHTML = `
      <div class="pro-profile__section pro-profile__activity">
        <h3><i class="fas fa-stream me-2"></i>Activity</h3>
        <div class="pro-profile__tabs" id="profileActivityTabs">
          <button class="pro-profile__tab active" data-tab="posts">
            Posts 
          </button>
          <button class="pro-profile__tab" data-tab="comments">
            Comments
          </button>
          <button class="pro-profile__tab" data-tab="liked">
            Liked
          </button>
        </div>
        <div id="profileTabContent" class="pro-profile__tab-content">
          <div class="text-muted text-center py-3">
            <div class="spinner-border spinner-border-sm" role="status"></div>
          </div>
        </div>
      </div>`;
  }

  if (!isOwnProfile) {
    bindFriendActions(document.getElementById('friendActions'));
    document
      .getElementById('reportProfileBtn')
      ?.addEventListener('click', () => openReportProfileModal(profile.id, name));
  }
  if (isOwnProfile) {
    document
      .getElementById('btnEditProfile')
      ?.addEventListener('click', () => showEditForm(profile));
    document.getElementById('avatarFile')?.addEventListener('change', uploadAvatar);
    document.getElementById('coverFile')?.addEventListener('change', uploadCover);
  }
}

function openReportProfileModal(targetId, targetName) {
  const existing = document.getElementById('reportProfileOverlay');
  if (existing) existing.remove();

  const reasons = [
    'Fake account',
    'Harassment',
    'Inappropriate content',
    'Impersonation',
    'Spam',
    'Other',
  ];

  const overlay = document.createElement('div');
  overlay.id = 'reportProfileOverlay';
  overlay.className = 'report-modal-overlay';
  overlay.innerHTML = `
    <div class="report-modal-card">
      <h5>Report ${esc(targetName)}</h5>
      <p class="report-modal-sub">Why are you reporting this user?</p>
      <div id="reportProfileReasons">
        ${reasons.map((r) => `<button class="report-reason-btn" data-reason="${r}"><i class="fas fa-flag"></i> ${r}</button>`).join('')}
      </div>
      <div id="reportProfileDesc" style="display:none;">
        <textarea id="reportProfileDescInput" class="form-control form-control-sm mb-2" rows="3" placeholder="Optional details..."></textarea>
        <button class="btn btn-danger btn-sm" id="reportProfileSubmitBtn">Submit report</button>
      </div>
      <div id="reportProfileThanks" style="display:none;text-align:center;padding:1rem 0;"></div>
      <div class="report-modal-actions">
        <button class="btn btn-outline-secondary btn-sm" id="reportProfileCancelBtn">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  let selectedReason = null;

  overlay.querySelectorAll('.report-reason-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedReason = btn.dataset.reason;
      document.getElementById('reportProfileReasons').style.display = 'none';
      document.getElementById('reportProfileDesc').style.display = 'block';
    });
  });

  document.getElementById('reportProfileSubmitBtn').addEventListener('click', async () => {
    const desc = document.getElementById('reportProfileDescInput').value.trim();
    try {
      await authFetch('/auth/report-user', {
        method: 'POST',
        body: JSON.stringify({ reported_id: targetId, reason: selectedReason, description: desc }),
      });
      document.getElementById('reportProfileDesc').style.display = 'none';
      const thanks = document.getElementById('reportProfileThanks');
      thanks.style.display = 'block';
      thanks.innerHTML =
        '<i class="fas fa-check-circle fa-2x mb-2 d-block" style="color:var(--secondary-color);"></i><div class="fw-bold">Report submitted</div><div class="text-muted small mt-1">We\'ll review this profile.</div>';
      document.getElementById('reportProfileCancelBtn').textContent = 'Close';
      setTimeout(() => closeReportProfileModal(), 2500);
    } catch (err) {
      alert(err.message || 'Failed to submit report.');
    }
  });

  document
    .getElementById('reportProfileCancelBtn')
    .addEventListener('click', closeReportProfileModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeReportProfileModal();
  });
}

function closeReportProfileModal() {
  const overlay = document.getElementById('reportProfileOverlay');
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  }
}

function showEditForm(profile) {
  document.getElementById('profileRoot').classList.add('d-none');
  const edit = document.getElementById('profileEdit');
  edit.classList.remove('d-none');
  const skills = parseSkills(profile.skills).join(', ');
  edit.innerHTML = `
    <h2 class="h5 mb-3">Edit profile</h2>
    <form id="profileForm">
      <label>Display name<input type="text" id="editDisplayName" value="${esc(profile.display_name || profile.name)}" /></label>
      <label>Role / headline <span class="form-hint">e.g. Product Designer, CS Student</span>
        <input type="text" id="editHeadline" value="${esc(profile.headline || '')}" placeholder="What you do" /></label>
      <label>Location<input type="text" id="editLocation" value="${esc(profile.location || '')}" placeholder="Singapore, SG" /></label>
      <label>About <span class="form-hint">2–3 sentences: what you do, what you're known for</span>
        <textarea id="editBio" rows="4" maxlength="500">${esc(profile.bio || '')}</textarea></label>
      <label>Skills <span class="form-hint">Comma-separated, e.g. UI Design, Python, Study Groups</span>
        <input type="text" id="editSkills" value="${esc(skills)}" /></label>
      <label>Portfolio URL<input type="url" id="editPortfolio" value="${esc(profile.link_portfolio || '')}" placeholder="https://yoursite.com" /></label>
      <label>GitHub<input type="text" id="editGithub" value="${esc(profile.link_github || '')}" placeholder="username or full URL" /></label>
      <label>LinkedIn<input type="text" id="editLinkedin" value="${esc(profile.link_linkedin || '')}" placeholder="username or full URL" /></label>
      <div class="d-flex gap-2 mt-3">
        <button type="submit" class="btn btn-primary">Save profile</button>
        <button type="button" class="btn btn-outline-secondary" id="btnCancelEdit">Cancel</button>
      </div>
    </form>`;
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('btnCancelEdit').addEventListener('click', () => {
    edit.classList.add('d-none');
    document.getElementById('profileRoot').classList.remove('d-none');
  });
}

async function saveProfile(e) {
  e.preventDefault();
  const skillsRaw = document.getElementById('editSkills').value;
  const skills = skillsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  try {
    const updated = await authFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({
        display_name: document.getElementById('editDisplayName').value,
        headline: document.getElementById('editHeadline').value,
        location: document.getElementById('editLocation').value,
        bio: document.getElementById('editBio').value,
        skills,
        link_portfolio: document.getElementById('editPortfolio').value,
        link_github: document.getElementById('editGithub').value,
        link_linkedin: document.getElementById('editLinkedin').value,
      }),
    });
    currentProfile = updated;
    document.getElementById('profileEdit').classList.add('d-none');
    document.getElementById('profileRoot').classList.remove('d-none');
    renderView(updated);
    const user = getStoredUser();
    if (user) {
      setAuth({ ...user, display_name: updated.display_name, name: updated.name }, getToken());
    }
  } catch (err) {
    alert(err.message);
  }
}

async function uploadAvatar(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('avatar', file);
  const res = await fetch(`${API_BASE}/auth/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Upload failed');
  currentProfile.profile_image = data.profile_image;
  renderView(currentProfile);
}

async function uploadCover(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('cover', file);
  const res = await fetch(`${API_BASE}/auth/cover`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Upload failed');
  currentProfile.cover_image = data.cover_image;
  renderView(currentProfile);
}

async function loadUserProfile() {
  const loading = document.getElementById('profileLoading');
  const errEl = document.getElementById('profileError');
  const root = document.getElementById('profileRoot');

  if (!isLoggedIn()) {
    redirectToLogin('profile.html' + window.location.search);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const targetId = params.get('id');
  const me = getStoredUser();

  try {
    let profile;
    if (!targetId || String(targetId) === String(me?.id)) {
      profile = await authFetch('/auth/me');
      isOwnProfile = true;
    } else {
      const data = await authFetch(`/friends/users/${targetId}/profile`);
      profile = data.profile;
      isOwnProfile = false;
    }
    currentProfile = profile;

    const isPrivate = profile.is_private && !isOwnProfile && profile.relationship !== 'friends';

    document.title = `${profile.display_name || profile.name} — Spindle`;
    loading.classList.add('d-none');
    root.classList.remove('d-none');
    renderView(profile);
    loadBadges(profile.id);
    loadProfilePosts(profile.id, isPrivate);
  } catch (err) {
    loading.classList.add('d-none');
    errEl.textContent = err.message || 'Could not load profile.';
    errEl.classList.remove('d-none');
  }
}

async function loadBadges(userId) {
  const grid = document.getElementById('badgesGrid');
  if (!grid) return;

  try {
    const badges = await authFetch(`/badges/${userId}`);
    if (!badges.length) {
      grid.innerHTML = '<span class="text-muted small">No badges yet.</span>';
      return;
    }

    grid.innerHTML = '';
    badges.forEach((badge) => {
      const el = document.createElement('div');
      el.className = `pro-profile__badge${badge.unlocked ? '' : ' pro-profile__badge--locked'}`;
      el.title = badge.unlocked
        ? `${badge.name} — ${badge.description}`
        : `${badge.name} (Locked) — ${badge.description}`;

      el.innerHTML = `
        <img src="${esc(badge.image_url)}" alt="${esc(badge.name)}">
        <span class="pro-profile__badge-name">${esc(badge.name)}</span>
        ${
          badge.unlocked && badge.awarded_at
            ? `<span class="pro-profile__badge-date">${new Date(badge.awarded_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>`
            : ''
        }`;

      grid.appendChild(el);
    });
  } catch (e) {
    const grid2 = document.getElementById('badgesGrid');
    if (grid2) grid2.innerHTML = '<span class="text-muted small">Could not load badges.</span>';
  }
}

// Profile activity tabs
function setupProfileTabs() {
  const tabsEl = document.getElementById('profileActivityTabs');
  if (!tabsEl) return;

  tabsEl.querySelectorAll('.pro-profile__tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      tabsEl.querySelectorAll('.pro-profile__tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const tab = btn.dataset.tab;
      const userId = currentProfile?.id;
      if (!userId) return;

      if (tab === 'posts') loadProfilePosts(userId);
      if (tab === 'comments') loadProfileComments(userId);
      if (tab === 'liked') loadProfileLiked(userId);
    });
  });
}

async function loadProfilePosts(userId, isPrivate = false) {
  const container = document.getElementById('profileTabContent');
  if (!container) return;

  if (isPrivate) {
    container.innerHTML =
      '<p class="text-muted small text-center py-3">This profile is private.</p>';
    return;
  }

  container.innerHTML = `
    <div class="text-muted text-center py-3">
      <div class="spinner-border spinner-border-sm" role="status"></div>
      Loading posts…
    </div>`;

  try {
    const allPosts = await authFetch(`/posts/user/${userId}`);
    const posts = (allPosts || []).filter((post) => !post.is_anonymous);

    if (!posts.length) {
      container.innerHTML = `
        <div class="text-muted text-center py-4">
          <i class="fas fa-comment-slash fa-2x mb-2 d-block"></i>
          No posts yet.
        </div>`;
      setupProfileTabs();
      return;
    }

    container.innerHTML = '';

    posts.forEach((post) => {
      const card = buildProfilePostCard(post);
      container.appendChild(card);
    });

    setupProfileTabs();
  } catch (e) {
    container.innerHTML = '<p class="text-muted text-center py-3">Could not load posts.</p>';
  }
}

async function loadProfileComments(userId) {
  const container = document.getElementById('profileTabContent');
  if (!container) return;

  container.innerHTML = `
    <div class="text-muted text-center py-3">
      <div class="spinner-border spinner-border-sm" role="status"></div>
      Loading comments…
    </div>`;

  try {
    const comments = await authFetch(`/comments/user/${userId}`);

    if (!comments || !comments.length) {
      container.innerHTML = `
        <div class="text-muted text-center py-4">
          <i class="fas fa-comment-slash fa-2x mb-2 d-block"></i>
          No comments yet.
        </div>`;
      return;
    }

    container.innerHTML = '';
    comments.forEach((comment) => container.appendChild(buildProfileCommentCard(comment)));
  } catch (e) {
    container.innerHTML = '<p class="text-muted text-center py-3">Could not load comments.</p>';
  }
}

async function loadProfileLiked(userId) {
  const container = document.getElementById('profileTabContent');
  if (!container) return;

  container.innerHTML = `
    <div class="text-muted text-center py-3">
      <div class="spinner-border spinner-border-sm" role="status"></div>
      Loading liked posts…
    </div>`;

  try {
    const posts = await authFetch(`/posts/liked/${userId}`);

    if (!posts || !posts.length) {
      container.innerHTML = `
        <div class="text-muted text-center py-4">
          <i class="fas fa-heart fa-2x mb-2 d-block"></i>
          No liked posts yet.
        </div>`;
      return;
    }

    container.innerHTML = '';
    posts.forEach((post) => container.appendChild(buildProfilePostCard(post, false)));
  } catch (e) {
    container.innerHTML = '<p class="text-muted text-center py-3">Could not load liked posts.</p>';
  }
}

function buildProfilePostCard(post, allowInsights = true) {
  const el = document.createElement('div');
  el.className = 'pro-profile__post-card';

  const categoryLabels = {
    confession: 'Confession',
    qna: 'Q&A',
    general: 'General Talk',
    events: 'Events',
    news: 'News',
    cca: 'CCA',
    internship: 'Internship',
    SOC: 'SOC',
    ABE: 'ABE',
    SB: 'SB',
    CLS: 'CLS',
    EEE: 'EEE',
    MAD: 'MAD',
    MAE: 'MAE',
    SMA: 'SMA',
  };
  const categoryClasses = {
    confession: 'category-confession',
    qna: 'category-qna',
    general: 'category-general',
    events: 'category-events',
    news: 'category-news',
    internship: 'category-internship',
    cca: 'category-cca',
    SOC: 'category-SOC',
    ABE: 'category-ABE',
    SB: 'category-SB',
    CLS: 'category-CLS',
    EEE: 'category-EEE',
    MAD: 'category-MAD',
    MAE: 'category-MAE',
    SMA: 'category-SMA',
  };

  const label = categoryLabels[post.category] || post.category || '';
  const cls = categoryClasses[post.category] || 'category-general';

  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const plainContent = (post.content || '').replace(/<[^>]*>/g, '');
  const preview = plainContent.length > 180 ? plainContent.slice(0, 180) + '…' : plainContent;

  el.innerHTML = `
    <div class="pro-profile__post-meta">
      <span class="post-category ${cls}">${esc(label)}</span>
      <span class="pro-profile__post-date">${esc(date)}</span>
    </div>
    <div class="pro-profile__post-title">${esc(post.title || '')}</div>
    ${preview ? `<div class="pro-profile__post-preview">${esc(preview)}</div>` : ''}
    <div class="pro-profile__post-footer">
      <div class="pro-profile__post-stats">
        <span><i class="far fa-eye"></i> ${post.view_count ?? 0}</span>
        <span><i class="far fa-thumbs-up"></i> ${post.like_count ?? 0}</span>
        <span><i class="far fa-comment"></i> ${post.comment_count ?? 0}</span>
      </div>
       ${
         isOwnProfile && allowInsights
           ? `
        <button class="pro-profile__analytics-btn" data-post-id="${post.id}" title="View analytics"> View Insights
        </button>`
           : ''
       }
    </div>`;

  el.style.cursor = 'pointer';

  el.addEventListener('click', (e) => {
    if (e.target.closest('.pro-profile__analytics-btn')) return;
    window.location.href = `posts.html?id=${post.id}`;
  });

  // Analytics
  if (isOwnProfile && allowInsights) {
    el.querySelector('.pro-profile__analytics-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = `postAnalytics.html?id=${post.id}`;
    });
  }

  return el;
}

function buildProfileCommentCard(comment) {
  const el = document.createElement('div');
  el.className = 'pro-profile__post-card';
  el.style.cursor = 'pointer';

  const categoryLabels = {
    confession: 'Confession',
    qna: 'Q&A',
    general: 'General Talk',
    events: 'Events',
    news: 'News',
    cca: 'CCA',
    internship: 'Internship',
    SOC: 'SOC',
    ABE: 'ABE',
    SB: 'SB',
    CLS: 'CLS',
    EEE: 'EEE',
    MAD: 'MAD',
    MAE: 'MAE',
    SMA: 'SMA',
  };
  const categoryClasses = {
    confession: 'category-confession',
    qna: 'category-qna',
    general: 'category-general',
    events: 'category-events',
    news: 'category-news',
    internship: 'category-internship',
    cca: 'category-cca',
    SOC: 'category-SOC',
    ABE: 'category-ABE',
    SB: 'category-SB',
    CLS: 'category-CLS',
    EEE: 'category-EEE',
    MAD: 'category-MAD',
    MAE: 'category-MAE',
    SMA: 'category-SMA',
  };

  const label = categoryLabels[comment.post_category] || comment.post_category || '';
  const cls = categoryClasses[comment.post_category] || 'category-general';

  const date = comment.created_at
    ? new Date(comment.created_at).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const preview =
    (comment.content || '').length > 180 ? comment.content.slice(0, 180) + '…' : comment.content;

  el.innerHTML = `
    <div class="pro-profile__post-meta">
      <span class="post-category ${cls}">${esc(label)}</span>
      <span class="pro-profile__post-date">${esc(date)}</span>
    </div>
    <div class="pro-profile__comment-context">
      <i class="fas fa-reply me-1"></i> On:
      <strong>${esc(comment.post_title || 'a post')}</strong>
    </div>
    <div class="pro-profile__post-preview" style="margin-top:0.3rem;">
      ${esc(preview)}
    </div>
    ${
      comment.attachment_url
        ? `
    <div class="mt-2">
      <img src="${esc(comment.attachment_url)}" alt="Attachment"
        style="max-height:100px; border-radius:8px; object-fit:cover;">
    </div>`
        : ''
    }`;

  el.addEventListener('click', () => {
    window.location.href = `posts.html?id=${comment.post_id}#comment-${comment.id}`;
  });

  return el;
}

document.addEventListener('DOMContentLoaded', loadUserProfile);
