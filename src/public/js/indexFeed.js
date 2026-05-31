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

let currentCategory = 'all';
let savedPostIds = new Set();

function initFeedPage() {
  loadPosts();

  try {
    populateFeedUser();
    setupCategoryTabs();
    setupCreatePost();
    setupSearch();
    setupAuthPopup();
    protectCreatePostUI();
    loadSavedIds();
    loadUserReactions();
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

// Load saved post IDs 
function loadSavedIds() {
  const userId = feedUserId();
  const token = feedToken();

  if (!userId || !token) return Promise.resolve();

  return new Promise((resolve) => {
    fetchMethod(`${feedApiBase()}/posts/saved/${userId}`, (status, data) => {
      if (status === 200 && Array.isArray(data)) {
        savedPostIds = new Set(data.map(row => parseInt(row.post_id)));
      }
      resolve();
    }, 'GET', null, token);
  });
}

//  Save / Unsave a post
function savePost(postId, onSuccess) {
  const token = feedToken();
  const userId = feedUserId();
  if (!token) { showAuthPopup(); return; }

  fetchMethod(`${feedApiBase()}/posts/saved`, (status, data) => {
    if (status === 201) {
      savedPostIds.add(parseInt(postId));
      if (onSuccess) onSuccess(true);
    } else {
      alert(data.message || 'Failed to save post.');
    }
  }, 'POST', { user_id: userId, post_id: postId }, token);
}

function unsavePost(postId, onSuccess) {
  const token = feedToken();
  const userId = feedUserId();
  if (!token) { showAuthPopup(); return; }

  fetchMethod(`${feedApiBase()}/posts/saved/${userId}`, (status, data) => {
    if (status !== 200) return;
    const row = data.find(r => parseInt(r.post_id) === parseInt(postId));
    if (!row) return;

    fetchMethod(`${feedApiBase()}/posts/saved/${row.id}`, (delStatus) => {
      if (delStatus === 200) {
        savedPostIds.delete(parseInt(postId));
        if (onSuccess) onSuccess(false);
      } else {
        alert('Failed to unsave post.');
      }
    }, 'DELETE', null, token);
  }, 'GET', null, token);
}

//  Confirmation modal 
function showConfirm(title, message, onConfirm) {
  const overlay   = document.getElementById('confirmOverlay');
  const titleEl   = document.getElementById('confirmTitle');
  const msgEl     = document.getElementById('confirmMessage');
  const okBtn     = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');

  titleEl.textContent = title;
  msgEl.textContent   = message;
  overlay.classList.remove('d-none');
  document.body.style.overflow = 'hidden';

  const newOk     = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  okBtn.replaceWith(newOk);
  cancelBtn.replaceWith(newCancel);

  function close() { overlay.classList.add('d-none'); document.body.style.overflow = ''; }

  newOk.addEventListener('click', () => { close(); onConfirm(); });
  newCancel.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); }, { once: true });
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
  else if (diffDays === 1) timeStr = `Yesterday at ${created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  else if (diffDays < 7) timeStr = `${diffDays} days ago`;
  else timeStr = created.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  let editedStr = null;
  if (wasEdited) {
    editedStr = updated.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
      + ', ' + updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return { timeStr, wasEdited, editedStr };
}

function getCategoryLabel(category) {
  return { confession: 'Confession', qna: 'Q&A', general: 'General Talk' }[category] || category;
}
function getCategoryClass(category) {
  return { confession: 'category-confession', qna: 'category-qna', general: 'category-general' }[category] || '';
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

// post card
function buildPostCard(post) {
  const { timeStr, wasEdited } = formatTimestamp(post.created_at, post.updated_at);

  const loggedInUserId = parseInt(feedUserId(), 10);
  const isOwner  = loggedInUserId && parseInt(post.user_id, 10) === loggedInUserId;
  const isSaved  = savedPostIds.has(parseInt(post.id, 10));
  const isLoggedIn = feedIsLoggedIn();

  // save/unsave option 
  const saveOption = isLoggedIn ? `
    <li><button class="dropdown-item save-post-btn" data-post-id="${post.id}" data-saved="${isSaved}">
      <i class="fa${isSaved ? 's' : 'r'} fa-bookmark me-2"></i>${isSaved ? 'Unsave post' : 'Save post'}
    </button></li>` : '';

  const ownerOptions = isOwner ? `
    <li><hr class="dropdown-divider"></li>
    <li><a class="dropdown-item edit-post-btn" href="#" data-post-id="${post.id}">
      <i class="fas fa-pen me-2"></i>Edit post
    </a></li>
    <li><button class="dropdown-item text-danger delete-post-btn" data-post-id="${post.id}">
      <i class="fas fa-trash-alt me-2"></i>Delete post
    </button></li>` : '';

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
          <li><a class="dropdown-item" href="#">Report</a></li>
          ${ownerOptions}
        </ul>
      </div>
    </div>

    <span class="post-category ${getCategoryClass(post.category)}">${getCategoryLabel(post.category)}</span>
    ${post.title ? `<h3 class="post-title h6 fw-bold mb-2">${escapeHtml(post.title)}</h3>` : ''}
    <div class="post-content">${escapeHtml(post.content)}</div>

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
  const likeBtn = card.querySelector('.like-btn');
  const dislikeBtn = card.querySelector('.dislike-btn');

  if (typeof initReactionButtons === 'function' && typeof setupReactionEvents === 'function') {
    initReactionButtons(post.id, likeBtn, dislikeBtn);
    setupReactionEvents(post.id, likeBtn, dislikeBtn);
  }

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
        () => deletePost(post.id, card)
      );
    });
  }

  return card;
}

// delete posts 
function deletePost(postId, cardEl) {
  const token = localStorage.getItem('token');
  fetchMethod(`${feedApiBase()}/posts/${postId}`, (status, data) => {
    if (status === 200) {
      cardEl.style.transition = 'opacity 0.2s';
      cardEl.style.opacity = '0';
      setTimeout(() => cardEl.remove(), 200);
    } else {
      alert(data.message || 'Failed to delete post.');
    }
  }, 'DELETE', null, token);
}

// render posts
function renderPosts(posts) {
  const container = document.getElementById('postsContainer');
  if (!container) return;
  container.innerHTML = '';

  if (!posts || posts.length === 0) {
    container.innerHTML = `
      <div class="post-card text-center py-4 text-muted">
        <i class="fas fa-comment-slash fa-2x mb-2 d-block"></i>
        No posts yet. Be the first to share!
      </div>`;
    return;
  }

  posts.forEach((post) => {
    try {
      container.appendChild(buildPostCard(post));
    } catch (err) {
      console.error('Failed to render post', post?.id, err);
    }
  });
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

function setupCategoryTabs() {
  const tabLinks = document.querySelectorAll('.filter-tabs .nav-link');
  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      tabLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const category = link.dataset.category;
      currentCategory = category;
      if (category === 'all') loadPosts();
      else loadPostsByCategory(category);
    });
  });
}

function renderTop3(posts) {
  const container = document.getElementById('top5Container');
  if (!container) return;

  const list = Array.isArray(posts) ? posts : [];
  const top3 = list
    .slice()
    .sort((a, b) => ((b.like_count || 0) - (a.like_count || 0)) || ((b.comment_count || 0) - (a.comment_count || 0)))
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
  const submitBtn    = document.getElementById('submitPostBtn');
  if (!submitBtn) return;

  const titleInput   = document.getElementById('postTitle');
  const categoryInput = document.getElementById('postCategory');
  const contentInput = document.getElementById('postContent');

  function validateForm() {
    submitBtn.disabled = !(titleInput.value.trim() && categoryInput.value && contentInput.value.trim());
  }

  validateForm();
  [titleInput, categoryInput, contentInput].forEach(i => {
    i.addEventListener('input', validateForm);
    i.addEventListener('change', validateForm);
  });

  submitBtn.addEventListener('click', () => {
    const title    = titleInput.value.trim();
    const category = categoryInput.value;
    const content  = contentInput.value.trim();
    const user_id  = feedUserId();
    const token    = feedToken();

    if (!token) { window.location.href = 'home.html?login=1&return=index.html'; return; }
    if (!user_id) {
      showModalError('Session expired. Please log in again.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    fetchMethod(`${feedApiBase()}/posts`, (status, data) => {
      submitBtn.textContent = 'Post';
      if (status === 201) {
        const modalEl = document.getElementById('createPostModal');
        const modal = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.hide();
        clearCreatePostForm();
        validateForm();
        if (currentCategory === 'all') loadPosts();
        else loadPostsByCategory(currentCategory);
      } else {
        submitBtn.disabled = false;
        showModalError(data.message || data.error || 'Failed to create post. Please try again.');
      }
    }, 'POST', { user_id: parseInt(user_id, 10), title, category, content }, token);
  });
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (!query) { loadPosts(); return; }
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
    if (status !== 200) { showPostsError(); return; }
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

  results.forEach(result => {
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
  el.addEventListener('click', () => { window.location.href = `study-groups.html?id=${group.id}`; });
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
  el.addEventListener('click', () => { window.location.href = `profile.html?id=${user.id}`; });
  return el;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
  populateFeedUser();
  document.getElementById('submitPostBtn').disabled = true;
}

function feedIsLoggedIn() { return !!feedToken(); }

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
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) hideAuthPopup(); });
}

function protectCreatePostUI() {
  const openModal = (category) => {
    if (!feedIsLoggedIn()) {
      showAuthPopup();
      return;
    }
    const modalEl = document.getElementById('createPostModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    clearCreatePostForm();
    populateFeedUser();
    if (category) {
      document.getElementById('postCategory').value = category;
    }
    modal.show();
  };

  document.querySelector('.create-post-input')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal(null);
  });

  document.querySelectorAll('.create-post-option').forEach((trigger) => {
    trigger.removeAttribute('data-bs-toggle');
    trigger.removeAttribute('data-bs-target');
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModal(trigger.dataset.categoryShortcut || null);
    });
  });
}