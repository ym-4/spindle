//  individual posts view
//  fetches GET /posts/:id, renders post
//  Comments: GET /comments/:post_id, POST /comments/:post_id, DELETE /comments/:id

const COMMENTS_BASE = `${currentUrl}/comments`;

document.addEventListener('DOMContentLoaded', () => {
  const postId = new URLSearchParams(window.location.search).get('id');
  if (!postId) {
    showError('No post ID found in URL.');
    return;
  }
  loadPost(postId);
});

// load the post
function loadPost(postId) {
  fetchMethod(`${currentUrl}/posts/${postId}`, (status, data) => {
    if (status === 200 && data) {
      renderPost(data);
      document.getElementById('commentsSection').style.display = 'block';
      loadComments(postId);
      setupCommentSubmit(postId);
    } else {
      showError('Post not found.');
    }
  });
}

// post card
function renderPost(post) {
  document.title = `${escapeHtml(post.title || 'Post')} - Spindle`;

  const { timeStr, wasEdited, editedStr } = formatTimestamp(post.created_at, post.updated_at);
  const categoryLabel = getCategoryLabel(post.category);
  const categoryClass = getCategoryClass(post.category);
  const initial = getAvatarInitial(post);
  const authorName = getAuthorName(post);
  const hideOption = post.category !== 'confession'
    ? `<li><a class="dropdown-item" href="#">Hide post</a></li>` : '';

  document.getElementById('postDetailContainer').innerHTML = `
    <div class="post-card" data-post-id="${post.id}" style="cursor: default;">
      <div class="post-header">
        <div class="post-avatar">${initial}</div>
        <div class="post-author">
          <div class="post-author-name">${authorName}</div>
          <div class="post-timestamp">
            ${timeStr}
            ${wasEdited ? `<span class="post-edited-tag text-muted">&nbsp;·&nbsp;edited on ${editedStr}</span>` : ''}
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

      <span class="post-category ${categoryClass}">${categoryLabel}</span>

      ${post.title ? `<div class="fw-bold mt-2 mb-1" style="font-size:1.05rem;">${escapeHtml(post.title)}</div>` : ''}

      <div class="post-content">${escapeHtml(post.content)}</div>

      <div class="post-actions">
        <button class="post-action-btn like-btn" id="likeBtn" data-liked="false">
          <i class="far fa-thumbs-up"></i> <span id="likeCount">0</span>
        </button>
        <button class="post-action-btn" style="cursor: default;">
          <i class="far fa-comment"></i> <span id="commentCountBtn">0</span>
        </button>
        <button class="post-action-btn share-btn">
          <i class="far fa-share-square"></i> Share
        </button>
      </div>
    </div>`;

  document.getElementById('likeBtn').addEventListener('click', () => {
    const btn = document.getElementById('likeBtn');
    const liked = btn.dataset.liked === 'true';
    btn.dataset.liked = liked ? 'false' : 'true';
    btn.style.color = liked ? '' : 'var(--primary-color)';
  });
}

// fetch comments
function loadComments(postId) {
  const container = document.getElementById('commentsContainer');
  container.innerHTML = `
    <div class="text-muted text-center py-3">
      <div class="spinner-border spinner-border-sm me-1" role="status"></div>
      Loading comments...
    </div>`;

  fetchMethod(`${COMMENTS_BASE}/${postId}`, (status, data) => {
    container.innerHTML = '';

    if (status === 200 && data && data.length > 0) {
      // Update comment count on the post card
      const countEl = document.getElementById('commentCountBtn');
      if (countEl) countEl.textContent = data.length;
      document.getElementById('totalCommentsLabel').textContent = `(${data.length})`;

      data.forEach(comment => appendCommentToDOM(comment));
    } else if (status === 200 && (!data || data.length === 0)) {
      showNoComments();
    } else {
      container.innerHTML = `<div class="text-muted text-center py-3">Could not load comments.</div>`;
    }
  });
}

// commenting under a post
function setupCommentSubmit(postId) {
  document.getElementById('submitCommentBtn').addEventListener('click', () => {
    const content = document.getElementById('commentInput').value.trim();
    if (!content) return;

    // TODO: swap 1 for real session user_id once auth is implemented
    const user_id = localStorage.getItem('loggedInUserId') || 1;
    const payload = { user_id, content };

    const submitBtn = document.getElementById('submitCommentBtn');
    submitBtn.disabled = true;

    fetchMethod(`${COMMENTS_BASE}/${postId}`, (status, data) => {
      submitBtn.disabled = false;

      if (status === 201) {
        document.getElementById('commentInput').value = '';
        // Reload comments so the new one appears with correct ID (needed for delete)
        loadComments(postId);
      } else {
        alert('Failed to post comment. Please try again.');
      }
    }, 'POST', payload);
  });
}

// listing comments
function appendCommentToDOM(comment) {
  const container = document.getElementById('commentsContainer');

  const { timeStr } = formatTimestamp(comment.created_at, null);
  const initial = comment.author_name
    ? comment.author_name.charAt(0).toUpperCase()
    : (comment.user_id ? String(comment.user_id).charAt(0) : 'U');
  const authorDisplay = comment.author_name || `User ${comment.user_id}`;

  // comment creators can delete their posts
  const loggedInUserId = parseInt(localStorage.getItem('loggedInUserId'));
  const isOwner = loggedInUserId && comment.user_id === loggedInUserId;

  const el = document.createElement('div');
  el.className = 'comment-item';
  el.dataset.commentId = comment.id;

  el.innerHTML = `
    <div class="d-flex">
      <div class="comment-avatar">${initial}</div>
      <div class="flex-grow-1">
        <div class="comment-content">
          <div class="d-flex align-items-start justify-content-between">
            <div class="comment-author">${escapeHtml(authorDisplay)}</div>
            ${isOwner ? `
            <div class="dropdown ms-2">
              <button class="btn btn-sm p-0 px-1 comment-menu-btn" data-bs-toggle="dropdown" style="line-height:1;">
                <i class="fas fa-ellipsis-h" style="font-size:0.8rem; color:var(--text-secondary);"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <button class="dropdown-item text-danger delete-comment-btn" data-comment-id="${comment.id}">
                    <i class="fas fa-trash-alt me-2"></i>Delete
                  </button>
                </li>
              </ul>
            </div>` : ''}
          </div>
          <div class="comment-text">${escapeHtml(comment.content)}</div>
          <div class="comment-actions">
            <button class="comment-action-link">Like</button>
            <button class="comment-action-link">Reply</button>
            <span class="comment-timestamp">${timeStr}</span>
          </div>
        </div>
      </div>
    </div>`;

  // delete button
  if (isOwner) {
    el.querySelector('.delete-comment-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteComment(comment.id, el);
    });
    // Stop dropdown toggling from bubbling
    el.querySelector('.comment-menu-btn').addEventListener('click', (e) => e.stopPropagation());
  }

  container.appendChild(el);
}

// deleting a comment (creator only)
function deleteComment(commentId, commentEl) {
  if (!confirm('Delete this comment?')) return;

  fetchMethod(`${currentUrl}/comments/${commentId}`, (status, data) => {
    if (status === 200) {
      // Fade out and remove from DOM
      commentEl.style.transition = 'opacity 0.2s';
      commentEl.style.opacity = '0';
      setTimeout(() => {
        commentEl.remove();
        // Update count
        const remaining = document.querySelectorAll('.comment-item').length;
        const countEl = document.getElementById('commentCountBtn');
        if (countEl) countEl.textContent = remaining;
        document.getElementById('totalCommentsLabel').textContent = `(${remaining})`;
        if (remaining === 0) showNoComments();
      }, 200);
    } else {
      alert('Failed to delete comment. Please try again.');
    }
  }, 'DELETE');
}

// post with no comments display
function showNoComments() {
  document.getElementById('commentsContainer').innerHTML = `
    <div class="text-muted text-center py-3" id="commentsPlaceholder">
      <i class="fas fa-comments fa-2x mb-2 d-block"></i>
      No comments yet. Be the first!
    </div>`;
}

// post date formatting
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
      + ', '
      + updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return { timeStr, wasEdited, editedStr };
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