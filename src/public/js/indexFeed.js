//  Spindle — Home Page

function feedApiBase() {
  if (typeof currentUrl !== 'undefined' && currentUrl) return currentUrl;
  if (typeof getApiBase === 'function') {
    const base = getApiBase();
    if (base) return base;
  }
  return window.location.origin || '';
}

function feedUserId() {
  const id = localStorage.getItem('loggedInUserId');
  if (id) return id;
  if (typeof getStoredUser === 'function') {
    const u = getStoredUser();
    if (u?.id) return String(u.id);
  }
  try {
    const u = JSON.parse(localStorage.getItem('pineappleUser') || '{}');
    if (u.id) return String(u.id);
  } catch {
    /* ignore */
  }
  return null;
}

function feedToken() {
  if (typeof getToken === 'function') return getToken();
  return localStorage.getItem('token');
}

let uploadedAttachmentUrl = null;
let selectedGiphyUrl = null;
let currentCategory = 'all';
let savedPostIds = new Set();

function initFeedPage() {
  setupCreatePostAvatar();

  loadUserReactions();
  loadSuggestedGroups();

  loadSavedIds().then(() => {
    loadPosts();
  });

  try {
    populateFeedUser();

    setupCategoryPills();
    setupCreatePost();

    setupSearch();
    setupAuthPopup();
    protectCreatePostUI();

    setupAttachmentUpload();
    setupGifPicker();
    setupGifSearch();

  } catch (err) {
    console.error('Feed setup error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFeedPage);
} else {
  initFeedPage();
}

async function populateFeedUser() {
  let user = typeof getStoredUser === 'function' ? getStoredUser() : null;

  if (user?.id && !user.name && !user.display_name && typeof authFetch === 'function') {
    try {
      const me = await authFetch('/auth/me');
      user = { ...user, ...me };
      if (typeof setAuth === 'function' && getToken()) {
        setAuth(user, getToken());
      }
    } catch {
      /* keep partial user */
    }
  }

  const name = user?.display_name || user?.name || 'User';
  const initial = name.charAt(0).toUpperCase();

  const avatar = document.querySelector('.create-post-box .post-avatar');
  if (avatar) avatar.textContent = initial;

  const postAs = document.getElementById('postAs');
  if (postAs) {
    postAs.innerHTML = `
      <option value="named">${escapeHtml(name)}</option>
      <option value="Anonymous">Anonymous</option>`;
  }
}

// gif 
function setupGifPicker() {
  const toggleBtn = document.getElementById('gifToggleBtn');
  const panel     = document.getElementById('gifPickerPanel');
  const removeBtn = document.getElementById('removeGifBtn');

  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      document.getElementById('gifSearchInput')?.focus();
    }
  });

  removeBtn?.addEventListener('click', () => {
    clearSelectedMediaPreview();
  });

  // Close panel
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== toggleBtn) {
      panel.classList.remove('open');
    }
  });
}

function clearSelectedMediaPreview() {
  const previewContainer = document.getElementById('attachmentPreviewContainer');
  if (previewContainer) previewContainer.innerHTML = '';
  selectedGiphyUrl = null;
  const attachmentInput = document.getElementById('postAttachment');
  if (attachmentInput) attachmentInput.value = '';
}

function showSelectedGifPreview() {
  const previewContainer = document.getElementById('attachmentPreviewContainer');
  if (!previewContainer) return;

  if (!selectedGiphyUrl) {
    previewContainer.innerHTML = '';
    return;
  }

  previewContainer.innerHTML = `
    <div class="mt-2 position-relative d-inline-block">
      <button
        type="button"
        class="btn btn-sm btn-dark rounded-circle position-absolute top-0 end-0 p-1"
        style="width:24px; height:24px; line-height:1; z-index:2;"
        data-action="remove-preview"
        aria-label="Remove GIF"
      >
        <i class="fas fa-times" style="font-size:0.7rem;"></i>
      </button>
      <div class="small text-muted mb-1">GIF selected</div>
      <img
        src="${selectedGiphyUrl}"
        alt="Selected GIF"
        style="max-width:120px; max-height:120px; border-radius:12px; object-fit:cover;"
      >
    </div>
  `;

  const removeBtn = previewContainer.querySelector('[data-action="remove-preview"]');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearSelectedMediaPreview();
    });
  }
}

// Load saved post IDs 
function loadSavedIds() {
  const userId = feedUserId();
  const token = feedToken();

  if (!userId || !token) return Promise.resolve();

  return new Promise((resolve) => {
    fetchMethod(
      `${feedApiBase()}/posts/saved/${userId}`,
      (status, data) => {
        if (status === 200 && Array.isArray(data)) {
          savedPostIds = new Set(data.map((row) => parseInt(row.post_id)));
        }
        resolve();
      },
      'GET',
      null,
      token,
    );
  });
}

//  Save / Unsave a post
function savePost(postId, onSuccess) {
  const token = feedToken();
  const userId = feedUserId();
  if (!token) {
    showAuthPopup();
    return;
  }

  fetchMethod(
    `${feedApiBase()}/posts/saved`,
    (status, data) => {
      if (status === 201) {
        savedPostIds.add(parseInt(postId));
        if (onSuccess) onSuccess(true);
      } else {
        alert(data.message || 'Failed to save post.');
      }
    },
    'POST',
    { user_id: userId, post_id: postId },
    token,
  );
}

function unsavePost(postId, onSuccess) {
  const token = feedToken();
  const userId = feedUserId();
  if (!token) {
    showAuthPopup();
    return;
  }

  fetchMethod(
    `${feedApiBase()}/posts/saved/${userId}`,
    (status, data) => {
      if (status !== 200) return;
      const row = data.find((r) => parseInt(r.post_id) === parseInt(postId));
      if (!row) return;

      fetchMethod(
        `${feedApiBase()}/posts/saved/${row.id}`,
        (delStatus) => {
          if (delStatus === 200) {
            savedPostIds.delete(parseInt(postId));
            if (onSuccess) onSuccess(false);
          } else {
            alert('Failed to unsave post.');
          }
        },
        'DELETE',
        null,
        token,
      );
    },
    'GET',
    null,
    token,
  );
}

//  Confirmation modal
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

//  Timestamp
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

  let editedStr = null;
  if (wasEdited) {
    editedStr =
      updated.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' +
      updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return { timeStr, wasEdited, editedStr };
}

const CATEGORIES = [
  // Primary pills 
  { value: 'all',        label: 'All',        primary: true  },
  { value: 'general',    label: 'General',    primary: true  },
  { value: 'events',     label: 'Events',     primary: true  },
  { value: 'news',       label: 'News',       primary: true  },
  { value: 'cca',        label: 'CCA',        primary: true  },
  { value: 'internship', label: 'Internship', primary: true  },
  // Secondary shown in "More" dropdown
  { value: 'confession', label: 'Confession', primary: false },
  { value: 'qna',        label: 'Q&A',        primary: false },
  { value: 'SOC',        label: 'SOC',        primary: false },
  { value: 'ABE',        label: 'ABE',        primary: false },
  { value: 'SB',         label: 'SB',         primary: false },
  { value: 'CLS',        label: 'CLS',        primary: false },
  { value: 'EEE',        label: 'EEE',        primary: false },
  { value: 'MAD',        label: 'MAD',        primary: false },
  { value: 'MAE',        label: 'MAE',        primary: false },
  { value: 'SMA',        label: 'SMA',        primary: false },
];

function getCategoryLabel(category) {
  const found = CATEGORIES.find(c => c.value === category);
  return found ? found.label : category;
}

function getCategoryClass(category) {
  const map = {
    confession: 'category-confession',
    qna:        'category-qna',
    general:    'category-general',
    events:     'category-events',
    news:       'category-news',
    internship: 'category-internship',
    cca:        'category-cca',
    SOC:        'category-SOC',
    ABE:        'category-ABE',
    SB:         'category-SB',
    CLS:        'category-CLS',
    EEE:        'category-EEE',
    MAD:        'category-MAD',
    MAE:        'category-MAE',
    SMA:        'category-SMA',
  };
  return map[category] || 'category-general';
}

function getAvatarInitial(post) {
  if (post.is_anonymous) return 'A';
  if (post.author_name) {
    return post.author_name.charAt(0).toUpperCase();
  }
  return 'U';
}

function getAuthorName(post) {
  if (post.is_anonymous) {
    return 'Anonymous';
  }
  return post.author_name || `User ${post.user_id}`;
}

function setupCreatePostAvatar() {
  const avatar = document.getElementById('createPostAvatar');

  if (!avatar) return;

  const displayName = localStorage.getItem('displayName');
  if (displayName && displayName.trim()) {
    avatar.textContent = displayName.charAt(0).toUpperCase();
  } else {
    avatar.textContent = '\uD83D\uDC3C';
  }
}

// post card
function buildPostCard(post) {
  const { timeStr, wasEdited } = formatTimestamp(post.created_at, post.updated_at);

  const loggedInUserId = parseInt(feedUserId(), 10);
  const isOwner = loggedInUserId && parseInt(post.user_id, 10) === loggedInUserId;
  const isSaved = savedPostIds.has(parseInt(post.id, 10));
  const isLoggedIn = feedIsLoggedIn();

  // save/unsave option
  const saveOption = isLoggedIn
    ? `
    <li><button class="dropdown-item save-post-btn" data-post-id="${post.id}" data-saved="${isSaved}">
      <i class="fa${isSaved ? 's' : 'r'} fa-bookmark me-2"></i>${isSaved ? 'Unsave post' : 'Save post'}
    </button></li>`
    : '';

  const ownerOptions = isOwner
    ? `
    <li><hr class="dropdown-divider"></li>
    <li><a class="dropdown-item edit-post-btn" href="#" data-post-id="${post.id}">
      <i class="fas fa-pen me-2"></i>Edit post
    </a></li>
    <li><button class="dropdown-item text-danger delete-post-btn" data-post-id="${post.id}">
      <i class="fas fa-trash-alt me-2"></i>Delete post
    </button></li>`
    : '';

  const card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.postId = post.id;
  card.dataset.postType = post.category;

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
          ${saveOption}
          <li><a class="dropdown-item report-post-btn" href="#">Report</a></li>
          ${ownerOptions}
        </ul>
      </div>
    </div>

    <div class="d-flex gap-1 align-items-center flex-wrap">
      <span class="post-category ${getCategoryClass(post.category)}">${getCategoryLabel(post.category)}</span>
      ${post.visibility === 'friends_only' ? '<span class="badge bg-warning text-dark" style="font-size:0.65rem;"><i class="fas fa-user-friends me-1"></i>Friends</span>' : ''}
      ${post.pinned ? '<span class="badge bg-info text-dark" style="font-size:0.65rem;"><i class="fas fa-thumbtack me-1"></i>Pinned</span>' : ''}
    </div>

    <div class="post-content">
      ${escapeHtml(post.content)}
    </div>
    ${
    (post.gif_url || post.giphy_url || post.attachment_url) ? `
      <div class="post-image-container mt-2">
        <img
          src="${post.gif_url || post.giphy_url || post.attachment_url}"
          class="img-fluid rounded post-image"
          alt="Post attachment"
        >
      </div>
    ` : ''
    }

    <div class="post-actions">
      <button class="post-action-btn like-btn" data-post-id="${post.id}">
        <i class="far fa-thumbs-up"></i>
        <span class="like-count">${post.like_count ?? '0'}</span>
      </button>
      <button class="post-action-btn dislike-btn" data-post-id="${post.id}">
        <i class="far fa-thumbs-down"></i>
        <span class="dislike-count">${post.dislike_count ?? '0'}</span>
      </button>
      <button class="post-action-btn comment-btn" data-post-id="${post.id}">
        <i class="far fa-comment"></i> <span class="comment-count">${post.comment_count ?? '0'}</span>
      </button>
      <button class="post-action-btn share-btn">
        <i class="far fa-share-square"></i> Share
      </button>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('.post-actions') || e.target.closest('.dropdown')) return;
    window.location.href = `posts.html?id=${post.id}`;
  });

  card.querySelector('.comment-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = `posts.html?id=${post.id}`;
  });

  card.querySelector('.post-menu-btn').addEventListener('click', (e) => e.stopPropagation());
  card.querySelector('.share-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openShareDropdown(e.currentTarget, post.id);
  });
  const likeBtn = card.querySelector('.like-btn');
  const dislikeBtn = card.querySelector('.dislike-btn');

  initReactionButtons(post.id, likeBtn, dislikeBtn);

  setupReactionEvents(post.id, likeBtn, dislikeBtn);

  // save/unsave
  if (isLoggedIn) {
    card.querySelector('.save-post-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const currentlySaved = btn.dataset.saved === 'true';

      if (currentlySaved) {
        unsavePost(post.id, () => {
          btn.dataset.saved = 'false';
          btn.innerHTML = `<i class="far fa-bookmark me-2"></i>Save post`;
        });
      } else {
        savePost(post.id, () => {
          btn.dataset.saved = 'true';
          btn.innerHTML = `<i class="fas fa-bookmark me-2"></i>Unsave post`;
        });
      }
    });
  }

  // report
  card.querySelector('.report-post-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openReportModal(post.id, post.user_id);
  });
  // owner actions
  if (isOwner) {
    card.querySelector('.edit-post-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `posts.html?id=${post.id}&edit=true`;
    });

    card.querySelector('.delete-post-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showConfirm(
        'Delete post?',
        'This will permanently remove the post and all its comments.',
        () => deletePost(post.id, card),
      );
    });
  }

  return card;
}

// delete posts
function deletePost(postId, cardEl) {
  const token = localStorage.getItem('token');
  fetchMethod(
    `${feedApiBase()}/posts/${postId}`,
    (status, data) => {
      if (status === 200) {
        cardEl.style.transition = 'opacity 0.2s';
        cardEl.style.opacity = '0';
        setTimeout(() => cardEl.remove(), 200);
      } else {
        alert(data.message || 'Failed to delete post.');
      }
    },
    'DELETE',
    null,
    token,
  );
}

// render posts .
function renderPosts(posts) {
  const container = document.getElementById('postsContainer');
  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.innerHTML = `
      <div class="post-card text-center py-4 text-muted">
        <i class="fas fa-comment-slash fa-2x mb-2 d-block"></i>
        No posts yet. Be the first to share!
      </div>`;
    return;
  }

  posts.forEach((post) => container.appendChild(buildPostCard(post)));
}

function sortNewestFirst(posts) {
  return posts.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function loadPosts() {
  showPostsLoading();
  resetHotPostsLoading();
  fetchMethod(`${feedApiBase()}/posts`, (status, data) => {
    try {
      if (status === 200 && Array.isArray(data)) {
        renderPosts(sortNewestFirst(data));
        renderTop3(data);
      } else {
        showPostsError();
        renderTop3([]);
      }
    } catch (err) {
      console.error('loadPosts error:', err);
      showPostsError();
      renderTop3([]);
    }
  });
}

function loadPostsByCategory(category) {
  showPostsLoading();
  fetchMethod(`${feedApiBase()}/posts/tag/${category}`, (status, data) => {
    if (status === 200 && Array.isArray(data)) {
      renderPosts(sortNewestFirst(data));
    } else {
      showPostsError();
    }
  });
}

function resetHotPostsLoading() {
  const container = document.getElementById('top5Container');
  if (!container) return;
  container.innerHTML = `<div class="list-group-item text-muted small text-center py-3">
    <div class="spinner-border spinner-border-sm" role="status"></div></div>`;
}

function setupCategoryPills() {
  const wrapper = document.getElementById('categoryPills');
  if (!wrapper) return;

  const primary   = CATEGORIES.filter(c => c.primary);
  const secondary = CATEGORIES.filter(c => !c.primary);

  // Render pills
  primary.forEach(cat => {
    const pill = document.createElement('button');
    pill.className   = `category-pill${cat.value === 'all' ? ' active' : ''}`;
    pill.textContent = cat.label;
    pill.dataset.category = cat.value;
    pill.addEventListener('click', () => selectCategory(cat.value));
    wrapper.appendChild(pill);
  });

  // "More" 
  const moreWrapper = document.createElement('div');
  moreWrapper.className = 'pill-more-wrapper';

  const morePill = document.createElement('button');
  morePill.className   = 'category-pill more-pill';
  morePill.id          = 'morePill';
  morePill.innerHTML   = 'More <i class="fas fa-chevron-down ms-1" style="font-size:0.7rem;"></i>';

  const dropdown = document.createElement('div');
  dropdown.className = 'pill-more-dropdown';
  dropdown.id        = 'moreDropdown';
  dropdown.style.display = 'none';
  dropdown.style.position = 'absolute';
  dropdown.style.zIndex = '9999';

  secondary.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent       = cat.label;
    btn.dataset.category  = cat.value;
    btn.addEventListener('click', () => {
      selectCategory(cat.value);
      dropdown.style.display = 'none';
    });
    dropdown.appendChild(btn);
  });

  function updateDropdownPosition() {
    const pillRect = morePill.getBoundingClientRect();
    dropdown.style.left = `${pillRect.left + window.scrollX}px`;
    dropdown.style.top = `${pillRect.bottom + window.scrollY + 6}px`;
    dropdown.style.minWidth = `${pillRect.width}px`;
  }

  morePill.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display === 'block';
    if (isOpen) {
      dropdown.style.display = 'none';
      return;
    }
    updateDropdownPosition();
    dropdown.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (dropdown.style.display === 'block' && !dropdown.contains(e.target) && e.target !== morePill) {
      dropdown.style.display = 'none';
    }
  });

  moreWrapper.appendChild(morePill);
  wrapper.appendChild(moreWrapper);
  document.body.appendChild(dropdown);
}

function selectCategory(category) {
  currentCategory = category;

  document.querySelectorAll('.category-pill:not(.more-pill)').forEach(p => {
    p.classList.toggle('active', p.dataset.category === category);
  });

  // More dropdown
  document.querySelectorAll('#moreDropdown button').forEach(b => {
    b.classList.toggle('active', b.dataset.category === category);
  });

  const morePill = document.getElementById('morePill');
  const selectedCategory = CATEGORIES.find(c => c.value === category);
  const isSecondary = selectedCategory && !selectedCategory.primary;

  if (morePill) {
    morePill.classList.toggle('active', !!isSecondary);
    const labelText = isSecondary ? selectedCategory.label : 'More';
    morePill.innerHTML = `${labelText} <i class="fas fa-chevron-down ms-1" style="font-size:0.7rem;"></i>`;
  }

  if (category === 'all') loadPosts();
  else loadPostsByCategory(category);
}

const REPORT_REASONS = [
  { label: 'Spam', icon: 'fa-shield' },
  { label: 'Harassment', icon: 'fa-user-slash' },
  { label: 'Hate speech', icon: 'fa-exclamation-triangle' },
  { label: 'Misinformation', icon: 'fa-circle-exclamation' },
  { label: 'NSFW / inappropriate', icon: 'fa-eye-slash' },
  { label: 'Other', icon: 'fa-ellipsis' },
];

let currentReportPostId = null;
let currentReportUserId = null;
let currentReportReason = null;

function openReportModal(postId, authorUserId) {
  currentReportPostId = postId;
  currentReportUserId = authorUserId;
  currentReportReason = null;
  const overlay = document.getElementById('reportModalOverlay');
  const reasonsContainer = document.getElementById('reportReasonsContainer');
  const thanksContainer = document.getElementById('reportThanks');
  const descStep = document.getElementById('reportDescriptionStep');
  const modalSub = document.getElementById('reportModalSub');
  document.getElementById('reportCancelBtn').style.display = '';
  reasonsContainer.style.display = '';
  descStep.style.display = 'none';
  thanksContainer.style.display = 'none';
  modalSub.textContent = 'Why are you reporting this post?';
  reasonsContainer.innerHTML = REPORT_REASONS.map(
    (r) =>
      `<button class="report-reason-btn" data-reason="${r.label}"><i class="fas ${r.icon}"></i> ${r.label}</button>`,
  ).join('');
  overlay.querySelectorAll('.report-reason-btn').forEach((btn) => {
    btn.addEventListener('click', () => showReportDescriptionStep(btn.dataset.reason));
  });
  document.getElementById('reportSubmitDescBtn').onclick = submitReport;
  overlay.classList.remove('d-none');
}

function showReportDescriptionStep(reason) {
  currentReportReason = reason;
  const overlay = document.getElementById('reportModalOverlay');
  const reasonsContainer = document.getElementById('reportReasonsContainer');
  const descStep = document.getElementById('reportDescriptionStep');
  const modalSub = document.getElementById('reportModalSub');
  reasonsContainer.style.display = 'none';
  descStep.style.display = 'block';
  document.getElementById('reportDescriptionInput').value = '';
  modalSub.textContent = 'Report: ' + reason;
}

function closeReportModal() {
  document.getElementById('reportModalOverlay').classList.add('d-none');
  currentReportPostId = null;
  currentReportUserId = null;
  currentReportReason = null;
}

function submitReport() {
  const postId = currentReportPostId;
  const reason = currentReportReason;
  const description = document.getElementById('reportDescriptionInput').value.trim();
  if (!postId || !reason) return;
  const userId = feedUserId();
  fetchMethod(
    `${feedApiBase()}/posts/${postId}/report`,
    (status, data) => {
      const reasonsContainer = document.getElementById('reportReasonsContainer');
      const descStep = document.getElementById('reportDescriptionStep');
      const thanksContainer = document.getElementById('reportThanks');
      const cancelBtn = document.getElementById('reportCancelBtn');
      reasonsContainer.style.display = 'none';
      descStep.style.display = 'none';
      cancelBtn.style.display = 'none';
      thanksContainer.style.display = '';
      if (status === 409) {
        thanksContainer.innerHTML =
          '<div class="fw-bold">Already reported</div><div class="text-muted small mt-1">You have already reported this post.</div>';
        setTimeout(closeReportModal, 2500);
      } else if (status === 200 || status === 201) {
        thanksContainer.innerHTML =
          '<div class="fw-bold">Thanks for your report</div><div class="text-muted small mt-1">Our team will review it.</div>';
        setTimeout(() => {
          if (confirm('Do you also want to block this user?')) {
            blockReportedUser();
          }
          closeReportModal();
        }, 800);
      } else {
        thanksContainer.innerHTML =
          '<div class="fw-bold text-danger">Something went wrong</div><div class="text-muted small mt-1">Please try again later.</div>';
        setTimeout(closeReportModal, 2500);
      }
    },
    'POST',
    { user_id: userId, reason, description },
    feedToken(),
  );
}

function blockReportedUser() {
  const blockerId = feedUserId();
  const blockedId = currentReportUserId;
  if (!blockerId || !blockedId) return;
  fetchMethod(
    `${feedApiBase()}/block`,
    (status) => {
      if (status === 200 || status === 201) {
        alert('User has been blocked.');
      } else {
        alert('Failed to block user.');
      }
    },
    'POST',
    { blocker_id: blockerId, blocked_id: blockedId },
    feedToken(),
  );
}

document.getElementById('reportCancelBtn')?.addEventListener('click', closeReportModal);
document.getElementById('reportModalOverlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeReportModal();
});

function renderTop3(posts) {
  const container = document.getElementById('top5Container');
  if (!container) return;

  const list = Array.isArray(posts) ? posts : [];
  const top3 = list
    .slice()
    .sort(
      (a, b) =>
        (b.like_count || 0) - (a.like_count || 0) ||
        (b.comment_count || 0) - (a.comment_count || 0),
    )
    .slice(0, 3);

  container.innerHTML = '';

  if (top3.length === 0) {
    container.innerHTML = `<div class="list-group-item text-muted small text-center py-3">No posts yet.</div>`;
    return;
  }

  top3.forEach((post, index) => {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'list-group-item list-group-item-action py-2';
    item.innerHTML = `
      <div class="text-muted mb-1" style="font-size:0.75rem;">Trending #${index + 1}</div>
      <div class="fw-bold" style="font-size:0.9rem;">${escapeHtml(post.title)}</div>`;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `posts.html?id=${post.id}`;
    });
    container.appendChild(item);
  });
}

function setupCreatePost() {
  const submitBtn = document.getElementById('submitPostBtn');
  if (!submitBtn) return;

  const titleInput = document.getElementById('postTitle');
  const categoryInput = document.getElementById('postCategory');
  const contentInput = document.getElementById('postContent');

  function validateForm() {
    submitBtn.disabled = !(
      titleInput.value.trim() &&
      categoryInput.value &&
      contentInput.value.trim()
    );
  }

  validateForm();
  [titleInput, categoryInput, contentInput].forEach((i) => {
    i.addEventListener('input', validateForm);
    i.addEventListener('change', validateForm);
  });

  submitBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    const category = categoryInput.value;
    const content  = contentInput.value.trim();
    const user_id  = localStorage.getItem('loggedInUserId');
    const token  = localStorage.getItem('token');
    const isAnonymous = document.getElementById('postAnonymous').checked;

    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    const formData = new FormData();

    formData.append('user_id', user_id);
    formData.append('title', title);
    formData.append('category', category);
    formData.append('content', content);
    formData.append('is_anonymous', isAnonymous);
    formData.append('visibility', document.getElementById('postVisibility').value);

    const attachmentInput = document.getElementById('postAttachment');

    if (attachmentInput.files[0]) {
      formData.append('attachment', attachmentInput.files[0]);
    } else if (selectedGiphyUrl) {
      formData.append('gif_url', selectedGiphyUrl);
    }

    fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
      .then(async (response) => {
        const data = await response.json();

        submitBtn.textContent = 'Post';

        if (response.status === 201) {
          bootstrap.Modal.getInstance(document.getElementById('createPostModal')).hide();

          clearCreatePostForm();
          validateForm();

          if (currentCategory === 'all') loadPosts();
          else loadPostsByCategory(currentCategory);
        } else {
          submitBtn.disabled = false;
          showModalError(data.message || 'Failed to create post.');
        }
      })
      .catch((err) => {
        console.error(err);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';

        showModalError('Upload failed.');
      });
  });
}

// search bar
function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (!query) {
      loadPosts();
      return;
    }
    debounceTimer = setTimeout(() => runSearch(query), 400);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceTimer);
      const query = input.value.trim();
      if (query) runSearch(query);
    }
  });
}

function runSearch(query) {
  showPostsLoading();
  fetchMethod(`${feedApiBase()}/search?q=${encodeURIComponent(query)}`, (status, data) => {
    if (status !== 200) {
      showPostsError();
      return;
    }
    renderSearchResults(data, query);
  });
}

function renderSearchResults(results, query) {
  const container = document.getElementById('postsContainer');
  container.innerHTML = '';

  if (!results || results.length === 0) {
    container.innerHTML = `
      <div class="post-card text-center py-4 text-muted">
        <i class="fas fa-search fa-2x mb-2 d-block"></i>
        No results found for "<strong>${escapeHtml(query)}</strong>"
      </div>`;
    return;
  }

  const header = document.createElement('div');
  header.className = 'text-muted mb-2 px-1';
  header.style.fontSize = '0.9rem';
  header.innerHTML = `<i class="fas fa-search me-1"></i> ${results.length} result${results.length !== 1 ? 's' : ''} for "<strong>${escapeHtml(query)}</strong>"`;
  container.appendChild(header);

  results.forEach((result) => {
    if (result.result_type === 'post') container.appendChild(buildPostCard(result));
    else if (result.result_type === 'group') container.appendChild(buildGroupResult(result));
    else if (result.result_type === 'user') container.appendChild(buildUserResult(result));
  });
}

function buildGroupResult(group) {
  const el = document.createElement('div');
  el.className = 'post-card';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar" style="background:var(--secondary-color);">
        <i class="fas fa-users" style="font-size:1rem;"></i>
      </div>
      <div class="post-author">
        <div class="post-author-name">${escapeHtml(group.title)}</div>
        <div class="post-timestamp">Study Group · by ${escapeHtml(group.author_name)}</div>
      </div>
      <span class="post-category category-general">Group</span>
    </div>
    <div class="post-content text-muted" style="font-size:0.9rem;">
      ${escapeHtml(group.description || 'No description available.')}
    </div>`;
  el.addEventListener('click', () => {
    window.location.href = `study-groups.html?id=${group.id}`;
  });
  return el;
}

function buildUserResult(user) {
  const el = document.createElement('div');
  el.className = 'post-card';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">${escapeHtml(user.title.charAt(0).toUpperCase())}</div>
      <div class="post-author">
        <div class="post-author-name">${escapeHtml(user.title)}</div>
        <div class="post-timestamp">User</div>
      </div>
      <span class="post-category" style="background:#f0f0f0;color:#555;">Profile</span>
    </div>`;
  el.addEventListener('click', () => {
    window.location.href = `profile.html?id=${user.id}`;
  });
  return el;
}

function escapeHtml(str) {
  if (!str) return '';
  switch (str) {
    case 'SOC':
      return '&#127760;';
    case 'MAD':
      return '&#127912;';
    case 'EEE':
      return '&#9889;';
    case 'ABE':
      return '&#127963;';
    case 'SB':
      return '&#129309;';
    case 'SMA':
      return '&#9875;';
    case 'MAE':
      return '&#128640;';
    case 'CLS':
      return '&#129516;';
    default:
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
  }
}

function showPostsLoading() {
  const el = document.getElementById('postsContainer');
  if (!el) return;
  el.innerHTML = `
    <div class="post-card text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      Loading posts...
    </div>`;
}

function showPostsError() {
  const el = document.getElementById('postsContainer');
  if (!el) return;
  el.innerHTML = `
    <div class="post-card text-center py-4 text-danger">
      <i class="fas fa-exclamation-circle fa-2x mb-2 d-block"></i>
      Could not load posts. Please refresh the page.
    </div>`;
}

function showModalError(message) {
  let errEl = document.getElementById('postModalError');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.id = 'postModalError';
    errEl.className = 'alert alert-danger py-2 mt-2';
    document.querySelector('#createPostModal .modal-body').prepend(errEl);
  }
  errEl.textContent = message;
  errEl.style.display = 'block';
}

function clearCreatePostForm() {
  const errEl = document.getElementById('postModalError');
  if (errEl) errEl.style.display = 'none';

  document.getElementById('postTitle').value = '';
  document.getElementById('postContent').value = '';
  document.getElementById('postCategory').value = 'confession';
  document.getElementById('postAnonymous').checked = false;
  document.getElementById('submitPostBtn').disabled = true;

  // Reset attachment
  uploadedAttachmentUrl = null;
  selectedGiphyUrl      = null;

  const attachmentInput = document.getElementById('postAttachment');
  if (attachmentInput) attachmentInput.value = '';

  const preview = document.getElementById('attachmentPreviewContainer');
  if (preview) preview.innerHTML = '';

  // Reset GIF picker
  const gifPanel = document.getElementById('gifPickerPanel');
  const gifSearch = document.getElementById('gifSearchInput');
  const gifResults = document.getElementById('giphyResults');

  if (gifPanel) gifPanel.classList.remove('open');
  if (gifSearch) gifSearch.value  = '';
  if (gifResults) gifResults.innerHTML = '';
}

function feedIsLoggedIn() {
  return !!feedToken();
}

function showAuthPopup() {
  document.getElementById('authOverlay').classList.remove('d-none');
  document.body.style.overflow = 'hidden';
}

function hideAuthPopup() {
  document.getElementById('authOverlay').classList.add('d-none');
  document.body.style.overflow = '';
}

function setupAuthPopup() {
  const closeBtn = document.getElementById('closeAuthPopup');
  if (closeBtn) closeBtn.addEventListener('click', hideAuthPopup);
  const overlay = document.getElementById('authOverlay');
  if (overlay)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideAuthPopup();
    });
}

function protectCreatePostUI() {
  // Input bar
  const inputTrigger = document.querySelector('.create-post-input');
  if (inputTrigger) {
    inputTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isLoggedIn()) { showAuthPopup(); return; }
      clearCreatePostForm();
      new bootstrap.Modal(document.getElementById('createPostModal')).show();
    });
  }

  document.querySelectorAll('.create-post-option[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isLoggedIn()) {
        showAuthPopup();
        return;
      }
      const modal = new bootstrap.Modal(document.getElementById('createPostModal'));
      clearCreatePostForm();
      const action = btn.dataset.action;

      if (action === 'ask') {
        // Preselect Q&A
        document.getElementById('postCategory').value = 'qna';

      } else if (action === 'confess') {
        // Preselect Confession + check anonymous
        document.getElementById('postCategory').value    = 'confession';
        document.getElementById('postAnonymous').checked = true;
      }
      // 'write' opens with default
      new bootstrap.Modal(document.getElementById('createPostModal')).show();
    });
  });
}

// =========================
// Groups display
// =========================
function loadSuggestedGroups() {
  const container = document.getElementById('suggestedGroupsContainer');
  if (!container) return;

  const token = feedToken();
  fetchMethod(
    `${feedApiBase()}/groups/suggested`,
    (status, data) => {
      container.innerHTML = '';

      if (status === 401) {
        console.warn('Suggested groups unauthorized. Leftover session tokens cleared.');
        return;
      }

      if (status !== 200 || !data || !data.length) {
        container.innerHTML = `
        <div class="list-group-item text-muted small text-center py-3">
          No suggestions available.
        </div>`;
        return;
      }

      data.forEach((group) => {
        const item = document.createElement('div');
        item.className = 'list-group-item';
        item.innerHTML = `
        <div class="d-flex align-items-center mb-2">
          <div class="post-avatar me-2" style="width:40px;height:40px;font-size:0.8rem;">
            ${escapeHtml(group.school)}
          </div>
          <div class="flex-grow-1">
            <strong style="font-size:0.9rem;">${escapeHtml(group.name)}</strong>
            <div class="small text-muted">${group.member_count} member${group.member_count !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <button class="btn btn-sm btn-primary w-100 join-group-btn" data-group-id="${group.id}">
          Join Group
        </button>
      `;

        item.querySelector('.join-group-btn').addEventListener('click', () => {
          if (!feedIsLoggedIn()) {
            showAuthPopup();
            return;
          }
          window.location.href = `groups.html?id=${group.id}`;
        });

        container.appendChild(item);
      });
    },
    'GET',
    null,
    token,
  );
}

function loadYourGroups() {
  const token = feedToken();
  const section = document.getElementById('yourGroupsSection');
  const divider = document.getElementById('yourGroupsDivider');

  if (!token) return;

  // Signed in display
  if (section) section.style.display = 'block';
  if (divider) divider.style.display = 'block';

  fetchMethod(
    `${feedApiBase()}/groups/joined_groups`,
    (status, data) => {
      if (status === 401) {
        console.warn('Joined groups unauthorized.');
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
    // no study groups yet
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
  seeAll.innerHTML = `
    <i class="fas fa-plus-circle"></i>
    <span>See all groups</span>
  `;
  container.appendChild(seeAll);
}

// =========================
// post actions
// =========================
function setupAttachmentUpload() {
  const input = document.getElementById('postAttachment');
  const previewContainer = document.getElementById('attachmentPreviewContainer');

  if (!input) return;

  input.addEventListener('change', () => {
    const file = input.files[0];

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5MB.');
      input.value = '';
      return;
    }

    selectedGiphyUrl = null;

    const reader = new FileReader();

    reader.onload = function (e) {
      previewContainer.innerHTML = `
        <div class="mt-2 position-relative d-inline-block">
          <button
            type="button"
            class="btn btn-sm btn-dark rounded-circle position-absolute top-0 end-0 p-1"
            style="width:24px; height:24px; line-height:1; z-index:2;"
            data-action="remove-preview"
            aria-label="Remove attachment"
          >
            <i class="fas fa-times" style="font-size:0.7rem;"></i>
          </button>
          <img
            src="${e.target.result}"
            style="
              max-width:120px;
              max-height:120px;
              border-radius:12px;
              object-fit:cover;
            "
          >
        </div>
      `;

      const removeBtn = previewContainer.querySelector('[data-action="remove-preview"]');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          clearSelectedMediaPreview();
        });
      }
    };

    reader.readAsDataURL(file);
  });
}

function setupGifSearch() {
    const input = document.getElementById('gifSearchInput');
    const resultsContainer = document.getElementById('giphyResults');

    if (!input || !resultsContainer) return;

    let timeout;
    input.addEventListener('input', () => {
        clearTimeout(timeout);
        const query = input.value.trim();

        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }

        timeout = setTimeout(() => {
            searchGiphy(query);
        }, 300);
    });
}

async function searchGiphy(query) {
    if (!query.trim()) return;
    const resultsContainer = document.getElementById('giphyResults');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = 'Searching...';

    try {
        const response = await fetch(`/giphy/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('GIF search failed');

        const gifs = await response.json();
        resultsContainer.innerHTML = '';

        if (!Array.isArray(gifs) || gifs.length === 0) {
            resultsContainer.innerHTML = '<div class="text-muted small">No GIFs found.</div>';
            return;
        }

        gifs.forEach((gif) => {
            const previewUrl = gif?.images?.fixed_height_small?.url || gif?.images?.downsized_medium?.url || gif?.images?.original?.url || gif?.url;
            const originalUrl = gif?.images?.original?.url || gif?.images?.downsized_large?.url || gif?.url || previewUrl;

            if (!previewUrl || !originalUrl) return;

            const img = document.createElement('img');
            img.src = previewUrl;
            img.className = 'giphy-thumb';
            img.alt = 'GIF result';

            img.onclick = () => {
                selectedGiphyUrl = originalUrl;
                showSelectedGifPreview();

                resultsContainer
                    .querySelectorAll('.selected')
                    .forEach((x) => x.classList.remove('selected'));

                img.classList.add('selected');
            };
            resultsContainer.appendChild(img);
        });
    } catch (err) {
        console.error(err);
        resultsContainer.innerHTML = 'Failed to load GIFs';
    }
}

// Share dropdown
let activeShareDropdown = null;

function openShareDropdown(btn, postId) {
  // Close any already-open dropdown
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

  // Copy link
  dropdown.querySelector('#shareCopyLink').addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(postUrl).then(() => {
      const btn = dropdown.querySelector('#shareCopyLink');
      btn.innerHTML = `<i class="fas fa-check"></i> Copied!`;
      btn.style.color = 'var(--secondary-color)';
      setTimeout(() => closeShareDropdown(), 1200);
    });
  });

  // WhatsApp
  dropdown.querySelector('#shareWhatsApp').addEventListener('click', (e) => {
    e.stopPropagation();
    window.open(`https://wa.me/?text=${encodeURIComponent(postUrl)}`, '_blank');
    closeShareDropdown();
  });

  // Telegram
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
