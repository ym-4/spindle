//  Spindle — Home Page TBC

const API_BASE = currentUrl; 

let currentCategory = 'all';

// page loaded
document.addEventListener('DOMContentLoaded', () => {
  loadPosts();
  setupCategoryTabs();
  setupCreatePost();
  setupSearch();
});

//format the time of post
function formatTimestamp(createdAt, updatedAt) {
  const created = new Date(createdAt);
  const updated = updatedAt ? new Date(updatedAt) : null;
  const wasEdited = updated && Math.abs(updated - created) > 5000;
  const displayDate = wasEdited ? updated : created;

  const now = new Date();
  const diffMs = now - displayDate;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeStr;
  if (diffMins < 1) timeStr = 'Just now';
  else if (diffMins < 60) timeStr = `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  else if (diffHours < 24) timeStr = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  else if (diffDays === 1) timeStr = `Yesterday at ${displayDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  else if (diffDays < 7) timeStr = `${diffDays} days ago`;
  else timeStr = displayDate.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  return { timeStr, wasEdited };
}

// cats
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

// post box
function buildPostCard(post) {
  const { timeStr, wasEdited } = formatTimestamp(post.created_at, post.updated_at);
  const editedTag = wasEdited ? `<span class="post-edited-tag text-muted" style="font-size:0.75rem;">(edited)</span>` : '';
  const hideOption = post.category !== 'confession' ? `<li><a class="dropdown-item" href="#">Hide post</a></li>` : '';

  const card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.postId = post.id;
  card.dataset.postType = post.category;

  card.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">${getAvatarInitial(post)}</div>
      <div class="post-author">
        <div class="post-author-name">${getAuthorName(post)}</div>
        <div class="post-timestamp">${timeStr} ${editedTag}</div>
      </div>
      <div class="dropdown">
        <button class="btn btn-sm post-menu-btn" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="fas fa-ellipsis-h"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><a class="dropdown-item" href="#">Save post</a></li>
          ${hideOption}
          <li><a class="dropdown-item" href="#">Report</a></li>
        </ul>
      </div>
    </div>

    <span class="post-category ${getCategoryClass(post.category)}">${getCategoryLabel(post.category)}</span>

    <div class="post-content">${escapeHtml(post.content)}</div>

    <div class="post-actions">
      <button class="post-action-btn like-btn" data-liked="false" data-post-id="${post.id}">
        <i class="far fa-thumbs-up"></i> <span class="like-count">–</span>
      </button>
      <button class="post-action-btn comment-btn" data-post-id="${post.id}">
        <i class="far fa-comment"></i> <span class="comment-count">–</span>
      </button>
      <button class="post-action-btn share-btn">
        <i class="far fa-share-square"></i> Share
      </button>
    </div>
  `;

  // navigate to post page
  card.addEventListener('click', (e) => {
    if (e.target.closest('.post-actions') || e.target.closest('.dropdown')) return;
    window.location.href = `posts.html?id=${post.id}`;
  });

  card.querySelector('.comment-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = `posts.html?id=${post.id}`;
  });

  // Like button 
  card.querySelector('.like-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const liked = btn.dataset.liked === 'true';
    btn.dataset.liked = liked ? 'false' : 'true';
    btn.style.color = liked ? '' : 'var(--primary-color)';
  });

 
  card.querySelector('.post-menu-btn').addEventListener('click', (e) => e.stopPropagation());

  return card;
}

// render post box
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

  posts.forEach(post => container.appendChild(buildPostCard(post)));
}

// sort by upload date
function sortNewestFirst(posts) {
  return posts.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// display all posts api
function loadPosts() {
  showPostsLoading();
  fetchMethod(`${API_BASE}/posts`, (status, data) => {
    if (status === 200) {
      renderPosts(sortNewestFirst(data));
    } else {
      showPostsError();
    }
  });
}

// display post by cat
function loadPostsByCategory(category) {
  showPostsLoading();
  fetchMethod(`${API_BASE}/posts/tag/${category}`, (status, data) => {
    if (status === 200) {
      renderPosts(sortNewestFirst(data));
    } else {
      showPostsError();
    }
  });
}

// cat tabs
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

// creating post (Form)
function setupCreatePost() {
  const submitBtn = document.getElementById('submitPostBtn');
  if (!submitBtn) return;

  // category dropdown
  document.querySelectorAll('.create-post-option[data-category-shortcut]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('postCategory').value = btn.dataset.categoryShortcut;
    });
  });

  submitBtn.addEventListener('click', () => {
    const title = document.getElementById('postTitle').value.trim();
    const category = document.getElementById('postCategory').value;
    const content = document.getElementById('postContent').value.trim();

    if (!title) { showModalError('Please enter a title.'); return; }
    if (!content) { showModalError('Post content cannot be empty.'); return; }

    // TODO: replace with real user ID from session once auth is implemented WIP
    const user_id = 1;

    const payload = { user_id, title, category, content };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    fetchMethod(`${API_BASE}/posts`, (status, data) => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post';

      if (status === 201) {
        bootstrap.Modal.getInstance(document.getElementById('createPostModal')).hide();
        clearCreatePostForm();
        if (currentCategory === 'all') loadPosts();
        else loadPostsByCategory(currentCategory);
      } else {
        showModalError(data.message || 'Failed to create post. Please try again.');
      }
    }, 'POST', payload);
  });
}

// SEARCH BAR
function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;

  let debounceTimer;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();

    if (!query) {
      // restore normal feed (no searches)
      loadPosts();
      return;
    }

    // wait 400ms after user stops typing 
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
  fetchMethod(`${API_BASE}/search?q=${encodeURIComponent(query)}`, (status, data) => {
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

  // Header for search cat
  const header = document.createElement('div');
  header.className = 'text-muted mb-2 px-1';
  header.style.fontSize = '0.9rem';
  header.innerHTML = `<i class="fas fa-search me-1"></i> ${results.length} result${results.length !== 1 ? 's' : ''} for "<strong>${escapeHtml(query)}</strong>"`;
  container.appendChild(header);

  results.forEach(result => {
    if (result.result_type === 'post') {
      container.appendChild(buildPostCard(result));
    } else if (result.result_type === 'group') {
      container.appendChild(buildGroupResult(result));
    } else if (result.result_type === 'user') {
      container.appendChild(buildUserResult(result));
    }
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

// error n validation indicators
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showPostsLoading() {
  document.getElementById('postsContainer').innerHTML = `
    <div class="post-card text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      Loading posts...
    </div>`;
}

function showPostsError() {
  document.getElementById('postsContainer').innerHTML = `
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
  document.getElementById('postAs').value = 'Your Name';
}