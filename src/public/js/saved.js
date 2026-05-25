//  Spindle — Saved Posts Page
//  GET /posts/saved/:user_id  → display saved posts
//  DELETE /posts/saved/:id    → unsave

const API_BASE = currentUrl;
let savedRows = []; 

document.addEventListener('DOMContentLoaded', () => {
  const token  = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  if (!token || !userId) {
    showLoginPrompt();
    return;
  }

  loadSavedPosts(userId, token);
});

// Confirmation modal 
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

//  Load saved posts 
function loadSavedPosts(userId, token) {
  const container = document.getElementById('savedContainer');
  container.innerHTML = `
    <div class="post-card text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      Loading saved posts...
    </div>`;

  fetchMethod(`${API_BASE}/posts/saved/${userId}`, (status, data) => {
    if (status !== 200 || !Array.isArray(data) || data.length === 0) {
      showEmpty();
      return;
    }

    savedRows = data;

    fetchMethod(`${API_BASE}/posts`, (pStatus, posts) => {
      if (pStatus !== 200) { showError(); return; }

      const savedPostIdSet = new Set(data.map(r => parseInt(r.post_id)));
      const savedPosts = posts.filter(p => savedPostIdSet.has(parseInt(p.id)));

      if (savedPosts.length === 0) { showEmpty(); return; }

      container.innerHTML = '';
      savedPosts.forEach(post => {
        const saveRow = savedRows.find(r => parseInt(r.post_id) === parseInt(post.id));
        container.appendChild(buildSavedPostCard(post, saveRow));
      });
    });
  }, 'GET', null, token);
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
            <button class="dropdown-item text-danger unsave-btn">
              <i class="fas fa-bookmark me-2"></i>Unsave post
            </button>
          </li>
        </ul>
      </div>
    </div>

    <span class="post-category ${getCategoryClass(post.category)}">${getCategoryLabel(post.category)}</span>

    <div class="post-content">${escapeHtml(post.content)}</div>

    <div class="post-actions">
      <button class="post-action-btn like-btn" data-liked="false">
        <i class="far fa-thumbs-up"></i> <span class="like-count">${post.like_count ?? '0'}</span>
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

  card.querySelector('.like-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const liked = btn.dataset.liked === 'true';
    btn.dataset.liked = liked ? 'false' : 'true';
    btn.style.color = liked ? '' : 'var(--primary-color)';
  });

  card.querySelector('.post-menu-btn').addEventListener('click', (e) => e.stopPropagation());

  // unsave
  card.querySelector('.unsave-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm(
      'Unsave post?',
      'This post will be removed from your saved posts.',
      () => unsavePost(saveRow.id, card)
    );
  });

  return card;
}

//  DELETE /posts/saved/:id 
function unsavePost(saveRowId, cardEl) {
  const token = localStorage.getItem('token');

  fetchMethod(`${API_BASE}/posts/saved/${saveRowId}`, (status) => {
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
  }, 'DELETE', null, token);
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
  else if (diffDays === 1) timeStr = `Yesterday at ${created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  else if (diffDays < 7) timeStr = `${diffDays} days ago`;
  else timeStr = created.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  const wasEditedResult = wasEdited;
  return { timeStr, wasEdited: wasEditedResult };
}

function getCategoryLabel(c) { return { confession: 'Confession', qna: 'Q&A', general: 'General Talk' }[c] || c; }
function getCategoryClass(c)  { return { confession: 'category-confession', qna: 'category-qna', general: 'category-general' }[c] || ''; }

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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}