//  individual posts view
//  fetches GET /posts/:id, renders post
//  Comments section TBC
// 

document.addEventListener('DOMContentLoaded', () => {
  const postId = new URLSearchParams(window.location.search).get('id');
  if (!postId) {
    showError('No post ID found in URL.');
    return;
  }
  loadPost(postId);
});

function loadPost(postId) {
  fetchMethod(`${currentUrl}/posts/${postId}`, (status, data) => {
    if (status === 200 && data) {
      renderPost(data);
      document.getElementById('commentsSection').style.display = 'block';
      setupCommentSubmit(postId);
    } else {
      showError('Post not found.');
    }
  });
}

// build box
function renderPost(post) {
  document.title = `${escapeHtml(post.title || 'Post')} - Spindle`;

  const { timeStr, wasEdited } = formatTimestamp(post.created_at, post.updated_at);
  const categoryLabel = getCategoryLabel(post.category);
  const categoryClass = getCategoryClass(post.category);
  const initial = getAvatarInitial(post);
  const authorName = getAuthorName(post);
  const hideOption = post.category !== 'confession'
    ? `<li><a class="dropdown-item" href="#">Hide post</a></li>` : '';

  document.getElementById('postDetailContainer').innerHTML = `
    <div class="post-card" data-post-id="${post.id}" style="cursor: default;">
      <div class="post-header">
        <div class="post-avatar" data-user-initial>${initial}</div>
        <div class="post-author">
          <div class="post-author-name" data-author-name>${authorName}</div>
          <div class="post-timestamp" data-post-time>
            ${timeStr}
            ${wasEdited ? '<small class="text-muted ms-1">(edited)</small>' : ''}
          </div>
        </div>
        <div class="dropdown">
          <button class="btn btn-sm" data-bs-toggle="dropdown">
            <i class="fas fa-ellipsis-h"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><a class="dropdown-item" href="#">Save post</a></li>
            ${hideOption}
            <li><a class="dropdown-item" href="#">Report</a></li>
          </ul>
        </div>
      </div>

      <span class="post-category ${categoryClass}" data-category>${categoryLabel}</span>

      ${post.title ? `<div class="fw-bold mt-2 mb-1" style="font-size:1.05rem;">${escapeHtml(post.title)}</div>` : ''}

      <div class="post-content" data-post-content>${escapeHtml(post.content)}</div>

      <div class="post-actions">
        <button class="post-action-btn like-btn" id="likeBtn" data-liked="false">
          <i class="far fa-thumbs-up"></i> <span id="likeCount">–</span>
        </button>
        <button class="post-action-btn" style="cursor: default;">
          <i class="far fa-comment"></i> <span id="commentCountBtn">–</span>
        </button>
        <button class="post-action-btn share-btn">
          <i class="far fa-share-square"></i> Share
        </button>
      </div>
    </div>`;

  // Like toggle — placeholder until reactions endpoint is ready
  document.getElementById('likeBtn').addEventListener('click', () => {
    const btn = document.getElementById('likeBtn');
    const liked = btn.dataset.liked === 'true';
    btn.dataset.liked = liked ? 'false' : 'true';
    btn.style.color = liked ? '' : 'var(--primary-color)';
  });
}

// commenter TBC
function setupCommentSubmit(postId) {
  document.getElementById('submitCommentBtn').addEventListener('click', () => {
    const content = document.getElementById('commentInput').value.trim();
    if (!content) return;

    // TODO: POST /posts/:id/comments
    appendCommentToDOM({ author_name: 'You', content, created_at: new Date().toISOString() });
    document.getElementById('commentInput').value = '';

    // Hide the placeholder text once a user leaves a comment 
    const placeholder = document.getElementById('commentsPlaceholder');
    if (placeholder) placeholder.style.display = 'none';
  });
}

// add a comment to list below post
function appendCommentToDOM(comment) {
  const container = document.getElementById('commentsContainer');
  const placeholder = document.getElementById('commentsPlaceholder');
  if (placeholder) placeholder.style.display = 'none';

  const { timeStr } = formatTimestamp(comment.created_at, null);
  const initial = comment.author_name ? comment.author_name.charAt(0).toUpperCase() : 'U';

  const el = document.createElement('div');
  el.className = 'comment-item';
  el.innerHTML = `
    <div class="d-flex">
      <div class="comment-avatar">${initial}</div>
      <div class="flex-grow-1">
        <div class="comment-content">
          <div class="comment-author">${escapeHtml(comment.author_name || 'User')}</div>
          <div class="comment-text">${escapeHtml(comment.content)}</div>
          <div class="comment-actions">
            <button class="comment-action-link">Like</button>
            <button class="comment-action-link">Reply</button>
            <span class="comment-timestamp">${timeStr}</span>
          </div>
        </div>
      </div>
    </div>`;
  container.appendChild(el);
}

// format upload time
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

function getCategoryLabel(c) {
  return { confession: 'Confession', qna: 'Q&A', general: 'General Talk' }[c] || c;
}

function getCategoryClass(c) {
  return { confession: 'category-confession', qna: 'category-qna', general: 'category-general' }[c] || '';
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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showError(message) {
  document.getElementById('postDetailContainer').innerHTML = `
    <div class="post-card text-center py-4 text-danger">
      <i class="fas fa-exclamation-circle fa-2x mb-2 d-block"></i>
      ${message}
      <div class="mt-3">
        <a href="index.html" class="btn btn-outline-secondary btn-sm">Back to Feed</a>
      </div>
    </div>`;
}