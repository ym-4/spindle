//  Spindle — Saved Posts Page
//  GET /posts/saved/:user_id  → display saved posts
//  DELETE /posts/saved/:id    → unsave

function savedApiBase() {
  if (typeof currentUrl !== 'undefined' && currentUrl) return currentUrl;
  if (typeof getApiBase === 'function') {
    const base = getApiBase();
    if (base) return base;
  }
  return window.location.origin || '';
}
let savedRows = [];

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  loadYourGroups();
  loadHotPosts();
  setupSavedTabs();

  if (!token || !userId) {
    showLoginPrompt();
    return;
  }

  loadSavedPosts(userId, token);
});

// Confirmation modal
function showConfirm(title, message, onConfirm) {
  const overlay = document.getElementById('confirmOverlay');
  const titleEl = document.getElementById('confirmTitle');
  const msgEl = document.getElementById('confirmMessage');
  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');

  titleEl.textContent = title;
  msgEl.textContent = message;
  overlay.classList.remove('d-none');
  document.body.style.overflow = 'hidden';

  const newOk = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  okBtn.replaceWith(newOk);
  cancelBtn.replaceWith(newCancel);

  function close() {
    overlay.classList.add('d-none');
    document.body.style.overflow = '';
  }
  newOk.addEventListener('click', () => {
    close();
    onConfirm();
  });
  newCancel.addEventListener('click', close);
  overlay.addEventListener(
    'click',
    (e) => {
      if (e.target === overlay) close();
    },
    { once: true },
  );
}

//  Load saved posts
function loadSavedPosts(userId, token) {
  const container = document.getElementById('savedContainer');
  container.innerHTML = `
    <div class="post-card text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      Loading saved posts...
    </div>`;

  fetchMethod(`${savedApiBase()}/posts/saved/${userId}`, (status, data) => {
    if (status !== 200 || !Array.isArray(data) || data.length === 0) {
      showEmpty();
      return;
    }

    savedRows = data;

    fetchMethod(
      `${savedApiBase()}/posts`,
      (pStatus, posts) => {
        if (pStatus !== 200) {
          showError();
          return;
        }

        const savedPostIdSet = new Set(data.map((r) => parseInt(r.post_id)));
        const savedPosts = posts.filter((p) => savedPostIdSet.has(parseInt(p.id)));

        if (savedPosts.length === 0) {
          showEmpty();
          return;
        }

        container.innerHTML = '';
        savedPosts.forEach((post) => {
          const saveRow = savedRows.find((r) => parseInt(r.post_id) === parseInt(post.id));
          container.appendChild(buildSavedPostCard(post, saveRow));
        });
      },
      'GET',
      null,
      token,
    );
  });
}

//  Build saved post card
function buildSavedPostCard(post, saveRow) {
  const { timeStr, wasEdited } = formatTimestamp(post.created_at, post.updated_at);

  const card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.postId = post.id;

  card.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">${getAvatarInitial(post)}</div>
      <div class="post-author">
        <div class="post-author-name">${getAuthorName(post)}</div>
        <div class="post-timestamp">
          ${timeStr}
          ${wasEdited ? `<span class="post-edited-tag text-muted">·&nbsp;&nbsp;edited</span>` : ''}
        </div>
      </div>
      <div class="dropdown">
        <button class="btn btn-sm post-menu-btn" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="fas fa-ellipsis-h"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li>
            <button class="dropdown-item unsave-btn">
              <i class="fas fa-bookmark me-2"></i>Unsave post
            </button>
          </li>
          <li>
            <button class="dropdown-item report-post-btn">
              <i class="fas fa-flag me-2"></i>Report
            </button>
          </li>
        </ul>
      </div>
    </div>

    <span class="post-category ${getCategoryClass(post.category)}">${getCategoryLabel(post.category)}</span>
    <div class="post-content">${escapeHtml(post.content)}</div>
    ${
      post.attachment_url
        ? `
      <div class="post-attachment mt-2">
        ${
          post.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
            ? `
              <img src="${currentUrl}${post.attachment_url}" alt="Post attachment" class="img-fluid rounded post-image">`
            : `
              <video controls class="img-fluid rounded post-video">
                <source src="${currentUrl}${post.attachment_url}">
              </video>
            `
        }
      </div>
    `
        : ''
    }

    <div class="post-actions">
        <button class="post-action-btn like-btn" data-post-id="${post.id}">
          <i class="far fa-thumbs-up"></i> <span class="like-count">${post.like_count ?? '0'}</span>
        </button>
        <button class="post-action-btn dislike-btn" data-post-id="${post.id}">
          <i class="far fa-thumbs-down"></i> <span class="dislike-count">${post.dislike_count ?? '0'}</span>
        </button>
        <button class="post-action-btn comment-btn">
        <i class="far fa-comment"></i> <span class="comment-count">${post.comment_count ?? '0'}</span>
      </button>
      <button class="post-action-btn share-btn">
        <i class="far fa-share-square"></i> Share
      </button>
    </div>`;

  // indiv post page redirect
  card.addEventListener('click', (e) => {
    if (e.target.closest('.post-actions') || e.target.closest('.dropdown')) return;
    window.location.href = `posts.html?id=${post.id}`;
  });

  card.querySelector('.comment-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = `posts.html?id=${post.id}`;
  });

  const likeBtn = card.querySelector('.like-btn');
  const dislikeBtn = card.querySelector('.dislike-btn');

  initReactionButtons(post.id, likeBtn, dislikeBtn);
  setupReactionEvents(post.id, likeBtn, dislikeBtn);

  card.querySelector('.post-menu-btn').addEventListener('click', (e) => e.stopPropagation());

  // Report
  card.querySelector('.report-post-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) {
      showLoginPrompt();
      return;
    }
    openReportModal(post.id);
  });

  // Share
  card.querySelector('.share-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openShareDropdown(e.currentTarget, post.id);
  });

  // unsave
  card.querySelector('.unsave-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm('Unsave post?', 'This post will be removed from your saved posts.', () =>
      unsavePost(saveRow.id, card),
    );
  });

  return card;
}

//  DELETE /posts/saved/:id
function unsavePost(saveRowId, cardEl) {
  const token = localStorage.getItem('token');

  fetchMethod(
    `${savedApiBase()}/posts/saved/${saveRowId}`,
    (status) => {
      if (status === 200) {
        cardEl.style.transition = 'opacity 0.2s';
        cardEl.style.opacity = '0';
        setTimeout(() => {
          cardEl.remove();
          if (document.querySelectorAll('#savedContainer .post-card').length === 0) {
            showEmpty();
          }
        }, 200);
      } else {
        alert('Failed to unsave post. Please try again.');
      }
    },
    'DELETE',
    null,
    token,
  );
}

function setupSavedTabs() {
  const postsTab = document.getElementById('savedPostsTab');
  const commentsTab = document.getElementById('savedCommentsTab');
  const postsPanel = document.getElementById('savedPostsPanel');
  const commentsPanel = document.getElementById('savedCommentsPanel');

  postsTab.addEventListener('click', (e) => {
    e.preventDefault();
    postsTab.classList.add('active');
    commentsTab.classList.remove('active');
    postsPanel.style.display = 'block';
    commentsPanel.style.display = 'none';
  });

  commentsTab.addEventListener('click', (e) => {
    e.preventDefault();
    commentsTab.classList.add('active');
    postsTab.classList.remove('active');
    commentsPanel.style.display = 'block';
    postsPanel.style.display = 'none';

    if (!commentsPanel.dataset.loaded) {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('loggedInUserId');
      loadSavedComments(userId, token);
      commentsPanel.dataset.loaded = 'true';
    }
  });
}

function loadSavedComments(userId, token) {
  const container = document.getElementById('savedCommentsContainer');
  container.innerHTML = `
    <div class="post-card text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      Loading saved comments...
    </div>`;

  fetchMethod(
    `${savedApiBase()}/comments/saved/${userId}`,
    (status, data) => {
      container.innerHTML = '';

      if (status !== 200 || !Array.isArray(data) || data.length === 0) {
        container.innerHTML = `
        <div class="post-card text-center py-4 text-muted">
          <i class="fas fa-comment-slash fa-2x mb-2 d-block"></i>
          No saved comments yet.
        </div>`;
        return;
      }

      data.forEach((item) => container.appendChild(buildSavedCommentCard(item, token)));
    },
    'GET',
    null,
    token,
  );
}

function buildSavedCommentCard(item, token) {
  const el = document.createElement('div');
  el.className = 'post-card';

  const { timeStr } = formatTimestamp(item.created_at, null);
  const initial = item.author_name ? item.author_name.charAt(0).toUpperCase() : 'U';

  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">${initial}</div>
      <div class="post-author">
        <div class="post-author-name">${escapeHtml(item.author_name || 'User')}</div>
        <div class="post-timestamp">${timeStr}</div>
      </div>
      <div class="dropdown">
        <button class="btn btn-sm post-menu-btn" data-bs-toggle="dropdown">
          <i class="fas fa-ellipsis-h"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li>
            <button class="dropdown-item text-danger unsave-comment-btn"
              data-save-id="${item.save_id}">
              <i class="fas fa-bookmark me-2"></i>Unsave
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="text-muted small mb-2">
      Commented on post: <strong>${escapeHtml(item.post_title)}</strong>
    </div>

    <div class="post-content"
      style="background:var(--hover-bg); border-radius:8px; padding:0.75rem; font-size:0.95rem;">
      ${escapeHtml(item.content)}
    </div>
  `;

  el.addEventListener('click', (e) => {
    if (e.target.closest('.dropdown')) return;
    window.location.href = `posts.html?id=${item.post_id}`;
  });

  el.querySelector('.post-menu-btn').addEventListener('click', (e) => e.stopPropagation());

  // Unsave
  el.querySelector('.unsave-comment-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const saveId = e.currentTarget.dataset.saveId;

    fetchMethod(
      `${savedApiBase()}/comments/saved/${saveId}`,
      (status) => {
        if (status === 200) {
          el.style.transition = 'opacity 0.2s';
          el.style.opacity = '0';
          setTimeout(() => {
            el.remove();
            const remaining = document.querySelectorAll(
              '#savedCommentsContainer .post-card',
            ).length;
            if (remaining === 0) {
              document.getElementById('savedCommentsContainer').innerHTML = `
              <div class="post-card text-center py-4 text-muted">
                <i class="fas fa-comment-slash fa-2x mb-2 d-block"></i>
                No saved comments yet.
              </div>`;
            }
          }, 200);
        } else {
          alert('Failed to unsave comment.');
        }
      },
      'DELETE',
      null,
      token,
    );
  });

  return el;
}

function showEmpty() {
  document.getElementById('savedContainer').innerHTML = `
    <div class="post-card text-center py-5 text-muted">
      <i class="fas fa-bookmark fa-2x mb-3 d-block"></i>
      <p class="mb-1 fw-semibold">No saved posts yet</p>
      <p style="font-size:0.9rem;">Posts you save will appear here.</p>
      <a href="index.html" class="btn btn-primary btn-sm mt-2">Browse posts</a>
    </div>`;
}

function showError() {
  document.getElementById('savedContainer').innerHTML = `
    <div class="post-card text-center py-4 text-danger">
      <i class="fas fa-exclamation-circle fa-2x mb-2 d-block"></i>
      Could not load saved posts. Please refresh.
    </div>`;
}

function showLoginPrompt() {
  document.getElementById('savedContainer').innerHTML = `
    <div class="post-card text-center py-5 text-muted">
      <i class="fas fa-lock fa-2x mb-3 d-block"></i>
      <p class="mb-2 fw-semibold">You need to be logged in to view saved posts.</p>
      <a href="login.html" class="btn btn-primary btn-sm">Log In</a>
    </div>`;
}

function formatTimestamp(createdAt, updatedAt) {
  const created = new Date(createdAt);
  const updated = updatedAt ? new Date(updatedAt) : null;
  const wasEdited = updated && Math.abs(updated - created) > 5000;

  const now = new Date();
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeStr;
  if (diffMins < 1) timeStr = 'Just now';
  else if (diffMins < 60) timeStr = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  else if (diffHours < 24) timeStr = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  else if (diffDays === 1)
    timeStr = `Yesterday at ${created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  else if (diffDays < 7) timeStr = `${diffDays} days ago`;
  else
    timeStr = created.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  const wasEditedResult = wasEdited;
  return { timeStr, wasEdited: wasEditedResult };
}

function getCategoryLabel(c) {
  return { confession: 'Confession', qna: 'Q&A', general: 'General Talk' }[c] || c;
}

function getCategoryClass(c) {
  return (
    { confession: 'category-confession', qna: 'category-qna', general: 'category-general' }[c] || ''
  );
}

function getAvatarInitial(post) {
  if (post.category === 'confession') return 'A';
  if (post.author_name) return post.author_name.charAt(0).toUpperCase();
  return 'U';
}

function getAuthorName(post) {
  if (post.category === 'confession') return 'Anonymous';
  return post.author_name || `User ${post.user_id}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Your Groups
function loadYourGroups() {
  const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');
  const section = document.getElementById('yourGroupsSection');
  const divider = document.getElementById('yourGroupsDivider');

  if (!token) {
    if (section) section.style.display = 'none';
    if (divider) divider.style.display = 'none';
    return;
  }

  if (section) section.style.setProperty('display', 'block', 'important');
  if (divider) divider.style.setProperty('display', 'block', 'important');

  fetchMethod(
    `${savedApiBase()}/groups/joined_groups`,
    (status, data) => {
      if (status === 401) {
        console.warn('Unauthorized access to joined groups from saved page.');
        return;
      }
      if (status !== 200) return;
      renderYourGroups(data || []);
    },
    'GET',
    null,
    token,
  );
}

function renderYourGroups(groups) {
  const container = document.getElementById('yourGroupsContainer');
  if (!container) return;

  container.innerHTML = '';

  if (!groups.length) {
    const emptyState = document.createElement('a');
    emptyState.href = 'groups.html';
    emptyState.className = 'sidebar-item d-flex align-items-center text-decoration-none';
    emptyState.style.cssText = `
      border: 1.5px dashed var(--border-color);
      border-radius: 10px;
      margin: 0.25rem 0.5rem;
      color: var(--text-secondary);
      transition: border-color 0.2s, color 0.2s;
    `;
    emptyState.innerHTML = `
      <i class="fas fa-plus-circle me-2" style="font-size:1.2rem; color:var(--primary-color);"></i>
      <span style="font-size:0.9rem; font-weight:600;">Join study groups</span>
    `;
    emptyState.addEventListener('mouseenter', () => {
      emptyState.style.borderColor = 'var(--primary-color)';
      emptyState.style.color = 'var(--primary-color)';
    });
    emptyState.addEventListener('mouseleave', () => {
      emptyState.style.borderColor = 'var(--border-color)';
      emptyState.style.color = 'var(--text-secondary)';
    });
    container.appendChild(emptyState);
    return;
  }

  groups.forEach((group) => {
    const item = document.createElement('a');
    item.href = `groups.html?id=${group.id}`;
    item.className = 'sidebar-item';
    item.innerHTML = `
      <i class="fas fa-circle" style="font-size:0.5rem; color:#1877f2;"></i>
      <span>${escapeHtml(group.name)}</span>
    `;
    container.appendChild(item);
  });

  const seeAll = document.createElement('a');
  seeAll.href = 'groups.html';
  seeAll.className = 'sidebar-item';
  seeAll.innerHTML = `<i class="fas fa-plus-circle"></i><span>See all groups</span>`;
  container.appendChild(seeAll);
}

// Hot Posts
function loadHotPosts() {
  fetchMethod(`${API_BASE}/posts`, (status, data) => {
    const container = document.getElementById('top5Container');
    if (!container) return;

    if (status !== 200 || !data.length) {
      container.innerHTML = `
        <div class="list-group-item text-muted small text-center py-3">
          No posts yet.
        </div>`;
      return;
    }

    const top3 = data
      .slice()
      .sort((a, b) => b.like_count - a.like_count || b.comment_count - a.comment_count)
      .slice(0, 3);

    container.innerHTML = '';

    top3.forEach((post, index) => {
      const item = document.createElement('a');
      item.href = `posts.html?id=${post.id}`;
      item.className = 'list-group-item list-group-item-action py-2';
      item.innerHTML = `
        <div class="text-muted mb-1" style="font-size:0.75rem;">Trending #${index + 1}</div>
        <div class="fw-bold" style="font-size:0.9rem;">${escapeHtml(post.title)}</div>
      `;
      container.appendChild(item);
    });
  });
}

// Share dropdown
let activeShareDropdown = null;

function openShareDropdown(btn, postId) {
  if (activeShareDropdown) {
    activeShareDropdown.remove();
    activeShareDropdown = null;
  }

  const postUrl = `${window.location.origin}/posts.html?id=${postId}`;

  const dropdown = document.createElement('div');
  dropdown.className = 'share-dropdown';
  dropdown.innerHTML = `
    <button class="share-dropdown-item" id="shareCopyLink">
      <i class="fas fa-link"></i> Copy link
    </button>
    <button class="share-dropdown-item" id="shareWhatsApp">
      <i class="fab fa-whatsapp"></i> Share via WhatsApp
    </button>
    <button class="share-dropdown-item" id="shareTelegram">
      <i class="fab fa-telegram"></i> Share via Telegram
    </button>
  `;

  btn.style.position = 'relative';
  btn.appendChild(dropdown);
  activeShareDropdown = dropdown;

  dropdown.querySelector('#shareCopyLink').addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(postUrl).then(() => {
      const copyBtn = dropdown.querySelector('#shareCopyLink');
      copyBtn.innerHTML = `<i class="fas fa-check"></i> Copied!`;
      copyBtn.style.color = 'var(--secondary-color)';
      setTimeout(() => closeShareDropdown(), 1200);
    });
  });

  dropdown.querySelector('#shareWhatsApp').addEventListener('click', (e) => {
    e.stopPropagation();
    window.open(`https://wa.me/?text=${encodeURIComponent(postUrl)}`, '_blank');
    closeShareDropdown();
  });

  dropdown.querySelector('#shareTelegram').addEventListener('click', (e) => {
    e.stopPropagation();
    window.open(`https://t.me/share/url?url=${encodeURIComponent(postUrl)}`, '_blank');
    closeShareDropdown();
  });

  setTimeout(() => {
    document.addEventListener('click', closeShareDropdown, { once: true });
  }, 0);
}

function closeShareDropdown() {
  if (activeShareDropdown) {
    activeShareDropdown.remove();
    activeShareDropdown = null;
  }
}

// Report modal
function openReportModal(postId) {
  const existing = document.getElementById('reportModalOverlay');
  if (existing) existing.remove();

  const reasons = [
    { icon: 'fas fa-ban', label: 'Spam or misleading' },
    { icon: 'fas fa-exclamation-triangle', label: 'Harassment or bullying' },
    { icon: 'fas fa-heart-broken', label: 'Harmful or dangerous content' },
    { icon: 'fas fa-user-slash', label: 'Hate speech or discrimination' },
    { icon: 'fas fa-copyright', label: 'Intellectual property violation' },
    { icon: 'fas fa-flag', label: 'Other' },
  ];

  const overlay = document.createElement('div');
  overlay.className = 'report-modal-overlay';
  overlay.id = 'reportModalOverlay';

  overlay.innerHTML = `
    <div class="report-modal-card">
      <h5>Report post</h5>
      <p class="report-modal-sub">Why are you reporting this post?</p>
      <div id="reportReasonsContainer">
        ${reasons
          .map(
            (r) => `
          <button class="report-reason-btn" data-reason="${r.label}">
            <i class="${r.icon}"></i> ${r.label}
          </button>
        `,
          )
          .join('')}
      </div>
      <div id="reportThanks" style="display:none; text-align:center; padding:1rem 0;"></div>
      <div class="report-modal-actions">
        <button class="btn btn-outline-secondary btn-sm" id="reportCancelBtn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  overlay.querySelectorAll('.report-reason-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const token = localStorage.getItem('token');
      const user_id = localStorage.getItem('loggedInUserId');

      fetchMethod(
        `${API_BASE}/posts/${postId}/report`,
        (status) => {
          const reasonsContainer = overlay.querySelector('#reportReasonsContainer');
          const thanksEl = overlay.querySelector('#reportThanks');
          const cancelBtn = overlay.querySelector('#reportCancelBtn');

          reasonsContainer.style.display = 'none';
          cancelBtn.textContent = 'Close';

          if (status === 409) {
            thanksEl.innerHTML = `
            <i class="fas fa-info-circle fa-2x mb-2 d-block" style="color:var(--primary-color);"></i>
            <div class="fw-bold">Already reported</div>
            <div class="text-muted small mt-1">You've already submitted a report for this post.</div>
          `;
          } else {
            thanksEl.innerHTML = `
            <i class="fas fa-check-circle fa-2x mb-2 d-block" style="color:var(--secondary-color);"></i>
            <div class="fw-bold">Thanks for your report</div>
            <div class="text-muted small mt-1">We'll review this post and take action if needed.</div>
          `;
          }

          thanksEl.style.display = 'block';
          setTimeout(() => closeReportModal(), 2500);
        },
        'POST',
        { user_id, reason: btn.dataset.reason },
        token,
      );
    });
  });

  overlay.querySelector('#reportCancelBtn').addEventListener('click', closeReportModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeReportModal();
  });
}

function closeReportModal() {
  const overlay = document.getElementById('reportModalOverlay');
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  }
}

// =========================
// Quick Links
// =========================
const helpCenterLink = document.getElementById('helpCenterLink');
const privacyLink = document.getElementById('privacyLink');
const guidelinesLink = document.getElementById('guidelinesLink');

const infoModal = new bootstrap.Modal(document.getElementById('infoModal'));

const modalTitle = document.getElementById('infoModalTitle');
const modalBody = document.getElementById('infoModalBody');

function openInfoModal(title, content) {
  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  infoModal.show();
}

helpCenterLink?.addEventListener('click', (e) => {
  e.preventDefault();

  openInfoModal(
    'Help Center',
    `
    <h6>Frequently Asked Questions</h6>
    <p><strong>How do I create a post?</strong><br>
    To share your thoughts, click on the "What's on your mind?" field, add your text or media, and then select <em>Post</em>. Your content will appear in the community feed.</p>
    <p><strong>Can I post anonymously?</strong><br>
    Yes. Before submitting, enable the <em>Anonymous</em> option. This ensures your identity is hidden from other users, though Spindle may still retain internal records for security purposes.</p>
    <p><strong>How do I join study groups?</strong><br>
    Navigate to the <em>Study Groups</em> section from the main menu. Browse available groups and click <em>Join</em> to become a member. Some groups may require approval from moderators.</p>
    <p><strong>How do I save or bookmark posts?</strong><br>
    Click the bookmark icon beneath any post to save it. You can access your saved posts later from your profile under the <em>Saved</em> tab.</p>
    <p><strong>How do I manage my account settings?</strong><br>
    Go to your profile and select <em>Settings</em>. From there, you can update your email, change your password, adjust privacy preferences, and manage notifications.</p>
    <p><strong>What happens to deleted posts?</strong><br>
    When you delete a post, it is removed from public view immediately. However, copies may remain in backup storage for a limited time as part of our security and compliance processes.</p>
    <p><strong>How do I report inappropriate content?</strong><br>
    Click the three-dot menu on the post or comment and select <em>Report</em>. Our moderation team will review the report and take appropriate action.</p>
    <p><strong>Can I deactivate or delete my account?</strong><br>
    Yes. Visit <em>Settings</em> → <em>Account</em> → <em>Deactivate/Delete</em>. Deactivation allows you to return later, while deletion permanently removes your account and associated data (subject to legal retention requirements).</p>

    <hr>
    <h6>Getting Started</h6>
    <p>
    New to Spindle? Begin by creating your account, customizing your profile, and exploring communities that match your interests. Visit the <em>Quick Start Guide</em> for step-by-step instructions.
    </p>
    <h6>Community Guidelines</h6>
    <p>
    To keep Spindle safe and welcoming, please follow our <em>Community Rules</em>. Respect others, avoid harmful content, and report inappropriate behavior. Violations may result in warnings or account suspension.
    </p>
    <h6>Account & Privacy</h6>
    <p>
    You can manage your account settings under <em>Profile → Settings</em>. Options include updating your email, changing your password, adjusting privacy preferences, and controlling notifications. For details on how we protect your data, see our Privacy Policy.
    </p>
    <h6>Moderation & Reporting</h6>
    <p>
    Our moderation team works to ensure a safe environment. If you encounter harmful or inappropriate content, use the <em>Report</em> option. Reports are reviewed promptly, and appropriate action will be taken.
    </p>
    <h6>Technical Support</h6>
    <p>
    If you experience technical issues such as login errors, app crashes, or missing features, check the <em>Troubleshooting Guide</em>. If the issue persists, contact our support team.
    </p>
    <hr>
    <p class="text-muted mb-0">
    Need further assistance? Contact the Spindle Support Team at <a href="mailto:support@spindleapp.com">support@spindleapp.com</a>.
    </p>

    `,
  );
});

privacyLink?.addEventListener('click', (e) => {
  e.preventDefault();

  openInfoModal(
    'Privacy Policy',
    `
    <p>
      Spindle values your trust and is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our services.
    </p>
    <h5>Information We Collect</h5>
    <ul>
      <li><strong>Account Information:</strong> We collect only the information necessary to create and maintain your account, such as your username, email address, and password.</li>
      <li><strong>Content:</strong> Posts, comments, and files you upload are stored securely and used solely within the platform.</li>
      <li><strong>Usage Data:</strong> We may collect information about how you interact with Spindle, including log data, device information, and preferences, to improve user experience.</li>
    </ul>
    <h5>How We Use Your Information</h5>
    <ul>
      <li>To provide, maintain, and improve our services.</li>
      <li>To protect the security and integrity of the platform.</li>
      <li>To personalize your experience and deliver relevant content.</li>
      <li>To comply with legal obligations and enforce our policies.</li>
    </ul>
    <h5>Data Protection</h5>
    <ul>
      <li><strong>Password Security:</strong> All passwords are encrypted using industry-standard methods.</li>
      <li><strong>Anonymous Posting:</strong> When you choose to post anonymously, your identity is hidden from other users.</li>
      <li><strong>File Usage:</strong> Uploaded files are used exclusively within the platform and are not shared externally.</li>
    </ul>
    <h5>Data Sharing</h5>
    <ul>
      <li>We do not sell or rent your personal information to third parties.</li>
      <li>We may share limited information with trusted service providers who assist us in operating the platform, subject to strict confidentiality agreements.</li>
      <li>We may disclose information if required by law or to protect the rights, safety, and security of our users and services.</li>
    </ul>
    <h5>Your Rights</h5>
    <ul>
      <li>You have the right to access, update, or delete your account information.</li>
      <li>You may request a copy of the personal data we hold about you.</li>
      <li>You can adjust your privacy settings within the platform at any time.</li>
    </ul>
    <h5>Changes to This Policy</h5>
    <p>
      We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. Updates will be posted here, and the "Last Updated" date will be revised accordingly.
    </p>
    <p class="text-muted mb-0">
      Last updated: May 2026
    </p>
    `,
  );
});

guidelinesLink?.addEventListener('click', (e) => {
  e.preventDefault();

  openInfoModal(
    'Community Guidelines',
    `
    <p>
      Spindle is committed to maintaining a safe, respectful, and productive environment for all users. By participating in the platform, you agree to follow these guidelines to help us keep Spindle welcoming and useful for everyone.
    </p>

    <h5>Respect and Conduct</h5>
    <ul>
      <li><strong>Be respectful:</strong> Treat fellow students and community members with courtesy and consideration.</li>
      <li><strong>No harassment or hate speech:</strong> Harassment, bullying, discrimination, or hate speech of any kind is strictly prohibited.</li>
      <li><strong>Constructive participation:</strong> Engage in discussions thoughtfully and avoid disruptive behavior.</li>
    </ul>

    <h5>Content Standards</h5>
    <ul>
      <li><strong>No illegal or harmful content:</strong> Do not post content that promotes illegal activity, violence, or harm.</li>
      <li><strong>Stay relevant:</strong> Keep discussions aligned with the category or group you are posting in.</li>
      <li><strong>No spam:</strong> Avoid posting advertisements, repetitive content, or duplicate posts.</li>
      <li><strong>Respect academic integrity:</strong> Do not share or encourage cheating, plagiarism, or violations of school policies.</li>
    </ul>

    <h5>Privacy and Safety</h5>
    <ul>
      <li><strong>Protect personal information:</strong> Do not share sensitive personal details about yourself or others.</li>
      <li><strong>Anonymous posting:</strong> Use the anonymous option responsibly to contribute without revealing your identity.</li>
      <li><strong>Reporting issues:</strong> If you encounter harmful or inappropriate content, use the <em>Report</em> feature to notify moderators.</li>
    </ul>

    <h5>Enforcement</h5>
    <p>
      Violations of these guidelines may result in content removal, warnings, temporary restrictions, or permanent account suspension. Enforcement decisions are made at the discretion of the moderation team to protect the integrity of the community.
    </p>

    <p class="text-muted mb-0">
      Last updated: May 2026
    </p>
    `,
  );
});
