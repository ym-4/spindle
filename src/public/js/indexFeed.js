/* global fetchMethod, DOMPurify, currentUrl, getApiBase, getToken, loadUserReactions, getStoredUser, initReactionButtons, setupReactionEvents, API_BASE, validatePostForm, bootstrap */

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
let quillEditor = null;
let pollActive = false;
let selectedTags = [];
let currentSort = 'newest';
let currentTimeframe = 'all';

function initFeedPage() {
  setupCreatePostAvatar();

  loadUserReactions();
  loadRecentlyViewedWidget();

  loadSavedIds().then(() => {
    loadPosts();
  });

  try {
    populateFeedUser();

    setupCategoryPills();
    setupSortButton();
    setupCreatePost();

    setupSearch();
    if (typeof setupSearchDropdown === 'function') setupSearchDropdown();
    setupAuthPopup();
    protectCreatePostUI();

    //create post form buttons
    setupAttachmentUpload();
    setupGifPicker();
    setupGifSearch();
    setupQuillEditor();
    setupPollBuilder();
    setupTagInput();
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
  const profileImage = user?.profile_image || user?.avatar || null;

  const avatar = document.querySelector('.create-post-box .post-avatar');
  if (avatar) {
    if (profileImage) {
      avatar.innerHTML = `<img src="${profileImage}" class="avatar-img" alt="${escapeHtml(name)}">`;
    } else {
      avatar.textContent = initial;
    }
  }
}

// gif
function setupGifPicker() {
  const toggleBtn = document.getElementById('gifToggleBtn');
  const panel = document.getElementById('gifPickerPanel');
  const removeBtn = document.getElementById('removeGifBtn');

  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      document.getElementById('gifSearchInput')?.focus();

      const results = document.getElementById('giphyResults');
      if (results && results.innerHTML.trim() === '') {
        results.innerHTML = `
          <div class="gif-grid-empty">
            <i class="fas fa-search mb-2 d-block" style="font-size:1.2rem;"></i>
            Search GIFs
          </div>`;
      }
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
  { value: 'all', label: 'All', primary: true },
  { value: 'general', label: 'General', primary: true },
  { value: 'events', label: 'Events', primary: true },
  { value: 'news', label: 'News', primary: true },
  { value: 'cca', label: 'CCA', primary: true },
  { value: 'internship', label: 'Internship', primary: true },
  // Secondary shown in "More" dropdown
  { value: 'confession', label: 'Confession', primary: false },
  { value: 'qna', label: 'Q&A', primary: false },
  { value: 'SOC', label: 'SOC', primary: false },
  { value: 'ABE', label: 'ABE', primary: false },
  { value: 'SB', label: 'SB', primary: false },
  { value: 'CLS', label: 'CLS', primary: false },
  { value: 'EEE', label: 'EEE', primary: false },
  { value: 'MAD', label: 'MAD', primary: false },
  { value: 'MAE', label: 'MAE', primary: false },
  { value: 'SMA', label: 'SMA', primary: false },
];

function getCategoryLabel(category) {
  const found = CATEGORIES.find((c) => c.value === category);
  return found ? found.label : category;
}

function getCategoryClass(category) {
  const map = {
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
  return map[category] || 'category-general';
}

function getAvatarInitial(post) {
  if (post.is_anonymous) return 'A';
  if (post.author_name) {
    return post.author_name.charAt(0).toUpperCase();
  }
  return 'U';
}

// profile picture
function getAvatarContent(post) {
  if (!post.is_anonymous && post.author_avatar) {
    return `<img src="${post.author_avatar}" class="avatar-img" alt="${escapeHtml(post.author_name || 'User')}">`;
  }
  return getAvatarInitial(post);
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

  let profileImage = null;
  try {
    const stored = JSON.parse(localStorage.getItem('pineappleUser') || '{}');
    profileImage = stored?.profile_image || stored?.avatar || null;
  } catch {
    /* ignore */
  }

  const displayName = localStorage.getItem('displayName');

  if (profileImage) {
    avatar.innerHTML = `<img src="${profileImage}" class="avatar-img" alt="${escapeHtml(displayName || 'User')}">`;
  } else if (displayName && displayName.trim()) {
    avatar.textContent = displayName.charAt(0).toUpperCase();
  } else {
    avatar.textContent = '\uD83D\uDC3C';
  }
}

// displayed post card
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
    <li><a class="dropdown-item insights-post-btn" href="#" data-post-id="${post.id}">
      <i class="fas fa-chart-bar me-2"></i>View Insights
    </a></li>
    <li><button class="dropdown-item text-danger delete-post-btn" data-post-id="${post.id}">
      <i class="fas fa-trash-alt me-2"></i>Delete post
    </button></li>`
    : '';

  const card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.postId = post.id;
  card.dataset.postType = post.category;

  const canViewProfile = !post.is_anonymous && post.user_id;

  card.innerHTML = `
    <div class="post-header">
      <div class="post-avatar${canViewProfile ? ' post-owner-link' : ''}">${getAvatarContent(post)}</div>
      <div class="post-author">
        <div class="post-author-name${canViewProfile ? ' post-owner-link' : ''}">${getAuthorName(post)}</div>
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

    ${post.title ? `<div class="post-title">${escapeHtml(post.title)}</div>` : ''}

    <div class="post-content">
        ${DOMPurify.sanitize(post.content)}
    </div>

    ${
      post.gif_url || post.giphy_url || post.attachment_url
        ? `
      <div class="post-image-container mt-2">
        <img
          src="${post.gif_url || post.giphy_url || post.attachment_url}"
          class="img-fluid rounded post-image"
          alt="Post attachment"
        >
      </div>
    `
        : ''
    }
    ${post.poll_id ? renderPollCard(post, post.id) : ''}
    <div class="post-tags" id="postTags-${post.id}"></div>

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
    recordRecentlyViewed(post);
    window.location.href = `posts.html?id=${post.id}`;
  });

  card.querySelector('.comment-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    recordRecentlyViewed(post);
    window.location.href = `posts.html?id=${post.id}`;
  });

  if (canViewProfile) {
    card.querySelectorAll('.post-owner-link').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `profile.html?id=${post.user_id}`;
      });
    });
  }

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

    card.querySelector('.insights-post-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `postAnalytics.html?id=${post.id}`;
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

  // Load poll
  if (post.poll_id) {
    loadAndRenderPoll(post.id, card);
  }
  // load tags
  loadPostTags(post.id, card);

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

function renderPollCard(post, postId) {
  return `<div class="poll-container" id="pollContainer-${postId}">
    <div class="text-muted small text-center py-2">
      <div class="spinner-border spinner-border-sm" role="status"></div>
    </div>
  </div>`;
}

function sortNewestFirst(posts) {
  return posts.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// fetch APIs
function loadPosts() {
  showPostsLoading();
  resetHotPostsLoading();

  const params = new URLSearchParams({ sort: currentSort });
  if (currentTimeframe !== 'all') params.set('timeframe', currentTimeframe);

  fetchMethod(`${feedApiBase()}/posts/sorted?${params.toString()}`, (status, data) => {
    try {
      if (status === 200 && Array.isArray(data)) {
        renderPosts(data);
        loadHotPostsSidebar();
      } else {
        showPostsError();
        renderTop3([]);
      }
    } catch (err) {
      console.error('loadPosts error:', err);
      showPostsError();
    }
  });
}

function loadPostsByCategory(category) {
  showPostsLoading();

  const params = new URLSearchParams({ sort: currentSort, category });
  if (currentTimeframe !== 'all') params.set('timeframe', currentTimeframe);

  fetchMethod(`${feedApiBase()}/posts/sorted?${params.toString()}`, (status, data) => {
    if (status === 200 && Array.isArray(data)) {
      renderPosts(data);
    } else {
      showPostsError();
    }
  });
}

function loadHotPostsSidebar() {
  fetchMethod(`${feedApiBase()}/posts/hot`, (status, data) => {
    if (status === 200 && Array.isArray(data)) {
      renderTop3(data);
    } else {
      renderTop3([]);
    }
  });
}

function loadAndRenderPoll(postId, cardEl) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  fetchMethod(`${feedApiBase()}/posts/${postId}/poll`, (status, poll) => {
    const container =
      cardEl?.querySelector(`#pollContainer-${postId}`) ||
      document.getElementById(`pollContainer-${postId}`);
    if (!container || status !== 200) return;

    const totalVotes = poll.options.reduce((sum, o) => sum + (o.vote_count || 0), 0);

    // Check if user already voted
    const userVoteCheck =
      token && userId
        ? new Promise((resolve) => {
            fetchMethod(
              `${feedApiBase()}/posts/${postId}/poll/vote/${userId}`,
              (vs, vd) => resolve(vs === 200 ? vd.vote : null),
              'GET',
              null,
              token,
            );
          })
        : Promise.resolve(null);

    userVoteCheck.then((userVote) => {
      const hasVoted = !!userVote;

      const optionsHtml = poll.options
        .map((opt) => {
          const pct = totalVotes > 0 ? Math.round((opt.vote_count / totalVotes) * 100) : 0;
          const isUserChoice = userVote && parseInt(userVote.option_id) === parseInt(opt.id);
          const votedClass = hasVoted ? 'voted' : '';
          const choiceClass = isUserChoice ? 'user-voted' : '';

          return [
            `<div class="poll-option ${votedClass} ${choiceClass}"`,
            `  data-option-id="${opt.id}"`,
            `  data-poll-id="${poll.id}"`,
            `  data-post-id="${postId}">`,
            `  <div class="poll-option-bar" style="width:${hasVoted ? pct : 0}%"></div>`,
            `  <span class="poll-option-label">${escapeHtml(opt.option_text)}</span>`,
            hasVoted ? `<span class="poll-option-pct">${pct}%</span>` : '',
            `</div>`,
          ].join('');
        })
        .join('');

      const undoHtml = hasVoted
        ? `<button class="btn btn-link btn-sm p-0 mt-1 undo-vote-btn" style="font-size:0.8rem; color:var(--text-secondary);">
             <i class="fas fa-times-circle me-1"></i>Remove vote
           </button>`
        : '';

      container.innerHTML = [
        `<div class="poll-question">${escapeHtml(poll.question)}</div>`,
        optionsHtml,
        `<div class="poll-meta d-flex align-items-center gap-2">`,
        `  <span>${totalVotes} vote${totalVotes !== 1 ? 's' : ''}</span>`,
        undoHtml,
        `</div>`,
      ].join('');

      // Vote
      if (!hasVoted && token) {
        container.querySelectorAll('.poll-option').forEach((optEl) => {
          optEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const optionId = optEl.dataset.optionId;
            const pollId = optEl.dataset.pollId;

            fetchMethod(
              `${feedApiBase()}/posts/${postId}/poll/vote`,
              (vs) => {
                if (vs === 201 || vs === 409) {
                  loadAndRenderPoll(postId, cardEl);
                }
              },
              'POST',
              { poll_id: pollId, option_id: optionId },
              token,
            );
          });
        });
      }

      // Change vote
      if (hasVoted && token) {
        container.querySelectorAll('.poll-option').forEach((optEl) => {
          if (optEl.classList.contains('user-voted')) return;
          optEl.style.cursor = 'pointer';
          optEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const optionId = optEl.dataset.optionId;
            const pollId = optEl.dataset.pollId;

            // Delete old vote then revote
            fetchMethod(
              `${feedApiBase()}/posts/${postId}/poll/vote`,
              (ds) => {
                if (ds === 200) {
                  fetchMethod(
                    `${feedApiBase()}/posts/${postId}/poll/vote`,
                    (vs) => {
                      if (vs === 201 || vs === 409) {
                        loadAndRenderPoll(postId, cardEl);
                      }
                    },
                    'POST',
                    { poll_id: pollId, option_id: optionId },
                    token,
                  );
                }
              },
              'DELETE',
              { poll_id: pollId },
              token,
            );
          });
        });
      }

      // Remove vote
      const undoBtn = container.querySelector('.undo-vote-btn');
      if (undoBtn && token) {
        undoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          fetchMethod(
            `${feedApiBase()}/posts/${postId}/poll/vote`,
            (ds) => {
              if (ds === 200) loadAndRenderPoll(postId, cardEl);
            },
            'DELETE',
            { poll_id: poll.id },
            token,
          );
        });
      }
    });
  });
}

function loadPostTags(postId, cardEl) {
  fetchMethod(`${feedApiBase()}/posts/${postId}/tags`, (status, tags) => {
    if (status !== 200 || !Array.isArray(tags) || !tags.length) return;

    const container = cardEl
      ? cardEl.querySelector(`#postTags-${postId}`)
      : document.getElementById(`postTags-${postId}`);
    if (!container) return;

    container.innerHTML = '';
    tags.forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'post-tag';
      span.textContent = `#${tag.name}`;
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `search.html?q=${encodeURIComponent('#' + tag.name)}&type=tag`;
      });
      container.appendChild(span);
    });
  });
}

function resetHotPostsLoading() {
  const container = document.getElementById('top5Container');
  if (!container) return;
  container.innerHTML = `<div class="list-group-item text-muted small text-center py-3">
    <div class="spinner-border spinner-border-sm" role="status"></div></div>`;
}

function setupSortButton() {
  const btn = document.getElementById('sortPillBtn');
  const dropdown = document.getElementById('sortDropdown');
  const label = document.getElementById('sortPillLabel');
  if (!btn || !dropdown) return;

  const SORT_OPTIONS = [
    { value: 'hot', label: 'Hot', icon: 'fa-fire' },
    { value: 'top', label: 'Top', icon: 'fa-trophy' },
    { value: 'newest', label: 'Newest', icon: 'fa-clock' },
    { value: 'oldest', label: 'Oldest', icon: 'fa-clock-rotate-left' },
  ];

  const TIMEFRAMES = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'year', label: 'This year' },
    { value: 'all', label: 'All time' },
  ];

  function renderDropdown() {
    dropdown.innerHTML = '';

    const sortLabel = document.createElement('div');
    sortLabel.className = 'sort-dropdown-section-label';
    sortLabel.textContent = 'Sort by';
    dropdown.appendChild(sortLabel);

    SORT_OPTIONS.forEach((opt) => {
      const btn2 = document.createElement('button');
      btn2.className = opt.value === currentSort ? 'active' : '';
      btn2.innerHTML = `<i class="fas ${opt.icon}"></i>${opt.label}`;
      btn2.addEventListener('click', () => {
        currentSort = opt.value;
        btn.classList.add('active');
        renderDropdown();

        if (opt.value !== 'newest' && opt.value !== 'oldest') return;
        applySort();
      });
      dropdown.appendChild(btn2);
    });

    if (currentSort === 'hot' || currentSort === 'top') {
      const divider = document.createElement('div');
      divider.className = 'sort-divider';
      dropdown.appendChild(divider);

      const tfLabel = document.createElement('div');
      tfLabel.className = 'sort-dropdown-section-label';
      tfLabel.textContent = 'Time range';
      dropdown.appendChild(tfLabel);

      const tfRow = document.createElement('div');
      tfRow.className = 'sort-timeframe-row';

      TIMEFRAMES.forEach((tf) => {
        const tfBtn = document.createElement('button');
        tfBtn.className = `sort-timeframe-btn${tf.value === currentTimeframe ? ' active' : ''}`;
        tfBtn.textContent = tf.label;
        tfBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          currentTimeframe = tf.value;
          renderDropdown();
          applySort();
        });
        tfRow.appendChild(tfBtn);
      });

      dropdown.appendChild(tfRow);
    } else {
      currentTimeframe = 'all';
    }
  }

  function applySort() {
    dropdown.style.display = 'none';
    if (currentCategory === 'all') loadPosts();
    else loadPostsByCategory(currentCategory);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display === 'block';
    if (isOpen) {
      dropdown.style.display = 'none';
      return;
    }
    renderDropdown();
    closeAllDropdowns();
    dropdown.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

function setupCategoryPills() {
  const wrapper = document.getElementById('categoryPills');
  if (!wrapper) return;

  const primary = CATEGORIES.filter((c) => c.primary);
  const secondary = CATEGORIES.filter((c) => !c.primary);

  // Render pills
  primary.forEach((cat) => {
    const pill = document.createElement('button');
    pill.className = `category-pill${cat.value === 'all' ? ' active' : ''}`;
    pill.textContent = cat.label;
    pill.dataset.category = cat.value;
    pill.addEventListener('click', () => selectCategory(cat.value));
    wrapper.appendChild(pill);
  });

  // "More"
  const moreWrapper = document.createElement('div');
  moreWrapper.className = 'pill-more-wrapper';

  const morePill = document.createElement('button');
  morePill.className = 'category-pill more-pill';
  morePill.id = 'morePill';
  morePill.innerHTML = 'More <i class="fas fa-chevron-down ms-1" style="font-size:0.7rem;"></i>';

  const dropdown = document.createElement('div');
  dropdown.className = 'pill-more-dropdown';
  dropdown.id = 'moreDropdown';
  dropdown.style.display = 'none';
  dropdown.style.position = 'absolute';
  dropdown.style.zIndex = '9999';

  secondary.forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat.label;
    btn.dataset.category = cat.value;
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
    closeAllDropdowns();
    dropdown.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (
      dropdown.style.display === 'block' &&
      !dropdown.contains(e.target) &&
      e.target !== morePill
    ) {
      dropdown.style.display = 'none';
    }
  });

  moreWrapper.appendChild(morePill);
  wrapper.appendChild(moreWrapper);
  document.body.appendChild(dropdown);
}

function selectCategory(category) {
  currentCategory = category;

  document.querySelectorAll('.category-pill:not(.more-pill)').forEach((p) => {
    p.classList.toggle('active', p.dataset.category === category);
  });

  // More dropdown
  document.querySelectorAll('#moreDropdown button').forEach((b) => {
    b.classList.toggle('active', b.dataset.category === category);
  });

  const morePill = document.getElementById('morePill');
  const selectedCategory = CATEGORIES.find((c) => c.value === category);
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

function setupCreatePost() {
  const submitBtn = document.getElementById('submitPostBtn');
  if (!submitBtn) return;

  const titleInput = document.getElementById('postTitle');
  const categoryInput = document.getElementById('postCategory');
  const contentInput = document.getElementById('postContent');

  function validateForm() {
    const hasContent = quillEditor
      ? quillEditor.getText().trim().length > 0
      : contentInput.value.trim().length > 0;
    const hasTitle = titleInput.value.trim().length > 0;
    const hasCategory = !!categoryInput.value;

    if (pollActive) {
      const pollQuestion = document.getElementById('pollQuestion')?.value.trim() || '';
      const pollOptionEls = document.querySelectorAll('.poll-option-input');
      const filledOptions = [...pollOptionEls].filter((el) => el.value.trim().length > 0);
      const validPoll = pollQuestion.length > 0 && filledOptions.length >= 2;

      submitBtn.disabled = !(hasTitle && hasCategory && validPoll);
    } else {
      submitBtn.disabled = !(hasTitle && hasCategory && hasContent);
    }
  }
  window.validatePostForm = validateForm;

  validateForm();
  [titleInput, categoryInput, contentInput].forEach((i) => {
    i.addEventListener('input', validateForm);
    i.addEventListener('change', validateForm);
  });

  submitBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    const category = categoryInput.value;
    const content = quillEditor
      ? quillEditor.getText().trim() === ''
        ? ''
        : quillEditor.root.innerHTML
      : contentInput.value.trim();
    const user_id = localStorage.getItem('loggedInUserId');
    const token = localStorage.getItem('token');
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

    if (selectedTags.length > 0) {
      formData.append('tags', JSON.stringify(selectedTags));
    }

    // Poll data — submitted after post is created
    const pollQuestion = document.getElementById('pollQuestion')?.value.trim();
    const pollOptionEls = document.querySelectorAll('.poll-option-input');
    const pollOptions = [...pollOptionEls].map((el) => el.value.trim()).filter((v) => v.length > 0);
    const hasPoll = pollActive && pollQuestion && pollOptions.length >= 2;

    const attachmentInput = document.getElementById('postAttachment');

    if (attachmentInput.files[0]) {
      formData.append('attachment', attachmentInput.files[0]);
    } else if (selectedGiphyUrl) {
      formData.append('gif_url', selectedGiphyUrl);
    }

    fetch(`${feedApiBase()}/posts`, {
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
          const postId = data.id;
          // poll added
          const afterPost = () => {
            bootstrap.Modal.getInstance(document.getElementById('createPostModal')).hide();
            clearCreatePostForm();
            validateForm();
            if (currentCategory === 'all') loadPosts();
            else loadPostsByCategory(currentCategory);
          };

          if (hasPoll && postId) {
            fetchMethod(
              `${feedApiBase()}/posts/${postId}/poll`,
              (pStatus) => {
                if (pStatus !== 201) console.warn('Poll creation failed');
                afterPost();
              },
              'POST',
              {
                question: pollQuestion,
                options: pollOptions,
              },
              token,
            );
          } else {
            afterPost();
          }
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
  selectedGiphyUrl = null;

  const attachmentInput = document.getElementById('postAttachment');
  if (attachmentInput) attachmentInput.value = '';

  const preview = document.getElementById('attachmentPreviewContainer');
  if (preview) preview.innerHTML = '';

  // Reset GIF picker
  const gifPanel = document.getElementById('gifPickerPanel');
  const gifSearch = document.getElementById('gifSearchInput');
  const gifResults = document.getElementById('giphyResults');

  if (gifPanel) gifPanel.classList.remove('open');
  if (gifSearch) gifSearch.value = '';
  if (gifResults)
    gifResults.innerHTML = `
    <div class="gif-grid-empty">
      <i class="fas fa-search mb-2 d-block" style="font-size:1.2rem;"></i>
      Search GIFs
    </div>`;

  // Reset Quill
  if (quillEditor) {
    quillEditor.setContents([]);
  }

  // Reset poll
  pollActive = false;
  const pollPanel = document.getElementById('pollBuilderPanel');
  const pollQ = document.getElementById('pollQuestion');
  const pollOpts = document.getElementById('pollOptionsContainer');
  const pollBtn = document.getElementById('pollToggleBtn');
  if (pollPanel) pollPanel.style.display = 'none';
  if (pollQ) pollQ.value = '';
  if (pollBtn) pollBtn.classList.remove('active');
  if (pollOpts) {
    pollOpts.innerHTML = `
      <input type="text" class="form-control mb-2 poll-option-input" placeholder="Option 1">
      <input type="text" class="form-control mb-2 poll-option-input" placeholder="Option 2">
    `;
  }

  // Reset tags
  selectedTags = [];
  const tagWrapper = document.getElementById('tagInputWrapper');
  if (tagWrapper) tagWrapper.querySelectorAll('.tag-chip').forEach((el) => el.remove());
  const tagInput = document.getElementById('tagTextInput');
  if (tagInput) tagInput.value = '';
  const tagHint = document.getElementById('tagCountHint');
  if (tagHint) tagHint.textContent = '0 / 10 tags';
  const tagAuto = document.getElementById('tagAutocomplete');
  if (tagAuto) tagAuto.style.display = 'none';
}

// search bar
function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = input.value.trim();
      if (!query) return;

      // query with # > tag search
      const isTagSearch = query.startsWith('#');
      const params = new URLSearchParams({ q: query });
      if (isTagSearch) params.set('type', 'tag');

      window.location.href = `search.html?${params.toString()}`;
    }
  });
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
      if (!isLoggedIn()) {
        showAuthPopup();
        return;
      }
      clearCreatePostForm();
      new bootstrap.Modal(document.getElementById('createPostModal')).show();
    });
  }

  document.querySelectorAll('.create-post-option[data-action]').forEach((btn) => {
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
        document.getElementById('postCategory').value = 'confession';
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
// right sidebar
// =========================
function renderTop3(posts) {
  const container = document.getElementById('top5Container');
  if (!container) return;

  container.innerHTML = '';

  const list = Array.isArray(posts) ? posts : [];

  if (!list.length) {
    container.innerHTML = `<div class="list-group-item text-muted small text-center py-3">No trending posts right now.</div>`;
    return;
  }

  list.slice(0, 3).forEach((post, index) => {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'list-group-item list-group-item-action py-2';

    item.innerHTML = `
      <div class="d-flex align-items-center gap-1 mb-1">
        <span class="text-muted" style="font-size:0.72rem;">Trending #${index + 1}</span>
      </div>
      <div class="fw-bold" style="font-size:0.88rem; line-height:1.3;">${escapeHtml(post.title)}</div>
      <div class="text-muted mt-1" style="font-size:0.75rem;">
        <span><i class="far fa-thumbs-up me-1"></i>${post.like_count ?? 0}</span>
        <span class="ms-2"><i class="far fa-comment me-1"></i>${post.comment_count ?? 0}</span>
      </div>`;

    item.addEventListener('click', (e) => {
      e.preventDefault();
      recordRecentlyViewed(post);
      window.location.href = `posts.html?id=${post.id}`;
    });
    container.appendChild(item);
  });
}

function loadRecentlyViewedWidget() {
  const card = document.getElementById('recentlyViewedCard');
  const container = document.getElementById('recentlyViewedContainer');
  if (!card || !container) return;

  const recent = getRecentlyViewed(3);

  if (!recent.length) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  container.innerHTML = '';

  recent.forEach((post) => {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'list-group-item list-group-item-action py-2';
    item.innerHTML = `
      <div class="text-muted mb-1" style="font-size:0.75rem;">${getCategoryLabel ? getCategoryLabel(post.category) : post.category || ''}</div>
      <div class="fw-bold" style="font-size:0.9rem;">${escapeHtml(post.title)}</div>`;
    item.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `posts.html?id=${post.id}`;
    });
    container.appendChild(item);
  });
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

function setupQuillEditor() {
  if (quillEditor) return;
  quillEditor = new Quill('#quillEditor', {
    theme: 'snow',
    placeholder: "What's on your mind?",
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
      ],
    },
  });

  quillEditor.on('text-change', () => {
    const html = quillEditor.root.innerHTML;
    document.getElementById('postContent').value = quillEditor.getText().trim() === '' ? '' : html;
    validatePostForm();
  });
}

function setupPollBuilder() {
  const toggleBtn = document.getElementById('pollToggleBtn');
  const panel = document.getElementById('pollBuilderPanel');
  const addOptionBtn = document.getElementById('addPollOptionBtn');

  if (!toggleBtn || !panel) return;

  toggleBtn.addEventListener('click', () => {
    pollActive = !pollActive;
    panel.style.display = pollActive ? 'block' : 'none';
    toggleBtn.classList.toggle('active', pollActive);
    if (pollActive) {
      document.getElementById('pollQuestion').focus();
    }
    // Revalidate
    document.getElementById('pollQuestion')?.addEventListener('input', () => {
      if (typeof validatePostForm === 'function') validatePostForm();
    });
    document.getElementById('pollOptionsContainer')?.addEventListener('input', () => {
      if (typeof validatePostForm === 'function') validatePostForm();
    });

    if (typeof validatePostForm === 'function') validatePostForm();
  });

  addOptionBtn.addEventListener('click', () => {
    const container = document.getElementById('pollOptionsContainer');
    const count = container.querySelectorAll('.poll-option-input').length + 1;
    if (count > 6) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control mb-2 poll-option-input';
    input.placeholder = `Option ${count}`;
    container.appendChild(input);
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
      const previewUrl =
        gif?.images?.fixed_height_small?.url ||
        gif?.images?.downsized_medium?.url ||
        gif?.images?.original?.url ||
        gif?.url;
      const originalUrl =
        gif?.images?.original?.url || gif?.images?.downsized_large?.url || gif?.url || previewUrl;

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

// Tag input
function setupTagInput() {
  const wrapper = document.getElementById('tagInputWrapper');
  const input = document.getElementById('tagTextInput');
  const autocomplete = document.getElementById('tagAutocomplete');
  const hint = document.getElementById('tagCountHint');

  if (!wrapper || !input) return;

  let debounce;

  wrapper.addEventListener('click', () => input.focus());

  input.addEventListener('input', () => {
    const query = input.value.replace(/^#/, '').trim();
    updateTagHint();
    if (!query) {
      autocomplete.style.display = 'none';
      return;
    }

    clearTimeout(debounce);
    debounce = setTimeout(() => {
      fetchMethod(
        `${feedApiBase()}/posts/tags/search?q=${encodeURIComponent(query)}`,
        (status, data) => {
          if (status !== 200 || !data.length) {
            autocomplete.style.display = 'none';
            return;
          }
          renderAutocomplete(data, query);
        },
      );
    }, 250);
  });

  input.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      addTag(input.value.replace(/^#/, '').trim());
    }
    if (e.key === 'Backspace' && !input.value && selectedTags.length) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target) && e.target !== input) {
      autocomplete.style.display = 'none';
    }
  });

  function renderAutocomplete(tags, query) {
    autocomplete.innerHTML = '';
    const exactMatch = tags.some((t) => t.name === query.toLowerCase());

    if (!exactMatch) {
      const createItem = document.createElement('div');
      createItem.className = 'tag-autocomplete-item';
      createItem.innerHTML = `<span>Create <strong>#${escapeHtml(query)}</strong></span>`;
      createItem.addEventListener('click', () => {
        addTag(query);
        autocomplete.style.display = 'none';
      });
      autocomplete.appendChild(createItem);
    }

    tags.forEach((tag) => {
      const item = document.createElement('div');
      item.className = 'tag-autocomplete-item';
      item.innerHTML = `
        <span>#${escapeHtml(tag.name)}</span>
        <span class="tag-usage">${tag.usage_count} post${tag.usage_count !== 1 ? 's' : ''}</span>
      `;
      item.addEventListener('click', () => {
        addTag(tag.name);
        autocomplete.style.display = 'none';
      });
      autocomplete.appendChild(item);
    });

    autocomplete.style.display = 'block';
  }

  function addTag(name) {
    const clean = name.toLowerCase().trim().replace(/\s+/g, '');
    if (!clean || selectedTags.includes(clean) || selectedTags.length >= 10) return;
    selectedTags.push(clean);
    renderChips();
    input.value = '';
    autocomplete.style.display = 'none';
    updateTagHint();
  }

  function removeTag(name) {
    selectedTags = selectedTags.filter((t) => t !== name);
    renderChips();
    updateTagHint();
  }

  function renderChips() {
    wrapper.querySelectorAll('.tag-chip').forEach((el) => el.remove());
    selectedTags.forEach((name) => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        #${escapeHtml(name)}
        <button type="button" class="tag-chip-remove" title="Remove">
          <i class="fas fa-times"></i>
        </button>
      `;
      chip.querySelector('.tag-chip-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeTag(name);
      });
      wrapper.insertBefore(chip, input);
    });
  }

  function updateTagHint() {
    if (hint) hint.textContent = `${selectedTags.length} / 10 tags`;
  }
}

// Share dropdown
let activeShareDropdown = null;
document.addEventListener('show.bs.dropdown', (e) => closeAllDropdowns(e.target));

function openShareDropdown(btn, postId) {
  // Close any already open dropdown
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

function closeAllDropdowns(exceptToggle) {
  const sortDropdown = document.getElementById('sortDropdown');
  if (sortDropdown) sortDropdown.style.display = 'none';
  const moreDropdown = document.getElementById('moreDropdown');
  if (moreDropdown) moreDropdown.style.display = 'none';

  document.querySelectorAll('.dropdown-menu.show').forEach((menu) => {
    const toggle = menu.previousElementSibling;
    if (toggle && toggle !== exceptToggle) {
      bootstrap.Dropdown.getInstance(toggle)?.hide();
    }
  });
}
