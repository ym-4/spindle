//  individual posts view
//  fetches GET /posts/:id, renders post
//  Comments: GET /comments/:post_id, POST /comments/:post_id, PUT /comments/:id, DELETE /comments/:id
//  creator: PUT /posts/:id, DELETE /posts/:id

const COMMENTS_BASE = `${currentUrl}/comments`;

document.addEventListener('DOMContentLoaded', () => {
  const params  = new URLSearchParams(window.location.search);
  const postId  = params.get('id');
  const editMode = params.get('edit') === 'true';

  if (!postId) { showError('No post ID found in URL.'); return; }

  loadPost(postId, editMode);

  const commentInput = document.getElementById('commentInput');
  if (commentInput) {
    commentInput.addEventListener('focus', () => {
      if (!localStorage.getItem('token')) {
        commentInput.blur();
        showLoginRequiredModal();
      }
    });
  }
});

// Confirm modal
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

  // clone to remove previous listeners
  const newOk     = okBtn.cloneNode(true);
  const newCancel = cancelBtn.cloneNode(true);
  okBtn.replaceWith(newOk);
  cancelBtn.replaceWith(newCancel);

  function close() {
    overlay.classList.add('d-none');
    document.body.style.overflow = '';
  }

  newOk.addEventListener('click', () => { close(); onConfirm(); });
  newCancel.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); }, { once: true });
}

function showLoginRequiredModal() {
  document.getElementById('authOverlay').classList.remove('d-none');
}

//Load post 
function loadPost(postId, editMode = false) {
  fetchMethod(`${currentUrl}/posts/${postId}`, (status, data) => {
    if (status === 200 && data) {
      if (editMode) renderPostEditMode(data);
      else renderPost(data);
      document.getElementById('commentsSection').style.display = 'block';
      loadComments(postId);
      setupCommentSubmit(postId);
    } else {
      showError('Post not found.');
    }
  });
}

// Render post 
function renderPost(post) {
  document.title = `${escapeHtml(post.title || 'Post')} - Spindle`;

  const { timeStr, wasEdited } = formatTimestamp(post.created_at, post.updated_at);
  const categoryLabel = getCategoryLabel(post.category);
  const categoryClass = getCategoryClass(post.category);
  const initial    = getAvatarInitial(post);
  const authorName = getAuthorName(post);

  const loggedInUserId = parseInt(localStorage.getItem('loggedInUserId'));
  const isOwner = loggedInUserId && parseInt(post.user_id) === loggedInUserId;

  const ownerOptions = isOwner ? `
    <li><hr class="dropdown-divider"></li>
    <li><button class="dropdown-item edit-post-btn">
      <i class="fas fa-pen me-2"></i>Edit post
    </button></li>
    <li><button class="dropdown-item text-danger delete-post-btn">
      <i class="fas fa-trash-alt me-2"></i>Delete post
    </button></li>` : '';

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
            ${wasEdited ? `<span class="post-edited-tag text-muted">·&nbsp;&nbsp;edited</span>` : ''}
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
            ${ownerOptions}
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

  if (isOwner) {
    document.querySelector('.edit-post-btn').addEventListener('click', () => {
      renderPostEditMode(post);
    });

    document.querySelector('.delete-post-btn').addEventListener('click', () => {
      showConfirm(
        'Delete post?',
        'This will permanently remove the post and all its comments.',
        () => {
          const token = localStorage.getItem('token');
          fetchMethod(`${currentUrl}/posts/${post.id}`, (status, data) => {
            if (status === 200) window.location.href = 'index.html';
            else alert(data.message || 'Failed to delete post.');
          }, 'DELETE', null, token);
        }
      );
    });
  }
}

//Render post (edit mode)
function renderPostEditMode(post) {
  document.title = `Editing: ${escapeHtml(post.title || 'Post')} - Spindle`;

  document.getElementById('postDetailContainer').innerHTML = `
    <div class="post-card" style="cursor: default;">
      <div class="post-header">
        <div class="post-avatar">${getAvatarInitial(post)}</div>
        <div class="post-author">
          <div class="post-author-name">${getAuthorName(post)}</div>
          <div class="post-timestamp text-muted" style="font-size:0.8rem;">Editing post</div>
        </div>
      </div>

      <div class="mb-2">
        <select class="form-select form-select-sm" id="editCategory" style="width:auto;">
          <option value="confession" ${post.category === 'confession' ? 'selected' : ''}>Confession</option>
          <option value="qna"        ${post.category === 'qna'        ? 'selected' : ''}>Q&A</option>
          <option value="general"    ${post.category === 'general'    ? 'selected' : ''}>General Talk</option>
        </select>
      </div>

      <div class="mb-2">
        <input type="text" class="form-control" id="editTitle"
          placeholder="Post title" value="${escapeHtml(post.title || '')}">
      </div>

      <div class="mb-3">
        <textarea class="form-control" id="editContent" rows="5"
          placeholder="Post content">${escapeHtml(post.content || '')}</textarea>
      </div>

      <div id="editError" class="alert alert-danger py-2 d-none"></div>

      <div class="d-flex gap-2 justify-content-end">
        <button class="btn btn-outline-secondary btn-sm" id="cancelEditBtn">Cancel</button>
        <button class="btn btn-primary btn-sm" id="saveEditBtn">Save changes</button>
      </div>
    </div>`;

  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.history.replaceState({}, '', url);
    renderPost(post);
  });

  document.getElementById('saveEditBtn').addEventListener('click', () => {
    const title    = document.getElementById('editTitle').value.trim();
    const content  = document.getElementById('editContent').value.trim();
    const category = document.getElementById('editCategory').value;
    const errEl    = document.getElementById('editError');

    if (!title)   { errEl.textContent = 'Title cannot be empty.';   errEl.classList.remove('d-none'); return; }
    if (!content) { errEl.textContent = 'Content cannot be empty.'; errEl.classList.remove('d-none'); return; }
    errEl.classList.add('d-none');

    const token   = localStorage.getItem('token');
    const user_id = localStorage.getItem('loggedInUserId');
    const saveBtn = document.getElementById('saveEditBtn');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    fetchMethod(`${currentUrl}/posts/${post.id}`, (status, data) => {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save changes';

      if (status === 200) {
        const url = new URL(window.location.href);
        url.searchParams.delete('edit');
        window.history.replaceState({}, '', url);
        renderPost({ ...post, title, content, category, updated_at: new Date().toISOString() });
      } else {
        errEl.textContent = data.message || 'Failed to save changes.';
        errEl.classList.remove('d-none');
      }
    }, 'PUT', { user_id, title, category, content }, token);
  });
}

// Load comments
function loadComments(postId) {
  const container = document.getElementById('commentsContainer');
  container.innerHTML = `
    <div class="text-muted text-center py-3">
      <div class="spinner-border spinner-border-sm me-1" role="status"></div>
      Loading comments...
    </div>`;

  const token = localStorage.getItem('token');

  fetchMethod(`${COMMENTS_BASE}/${postId}`, (status, data) => {
    container.innerHTML = '';
    const comments = Array.isArray(data) ? data : data.rows || [];

    if (status === 200 && comments.length > 0) {
      const countEl = document.getElementById('commentCountBtn');
      if (countEl) countEl.textContent = comments.length;
      document.getElementById('totalCommentsLabel').textContent = `(${comments.length})`;
      comments.forEach(comment => appendCommentToDOM(comment, postId));
    } else if (status === 200 && comments.length === 0) {
      showNoComments();
    } else {
      container.innerHTML = `<div class="text-muted text-center py-3">Could not load comments.</div>`;
    }
  }, 'GET', null, token);
}

// Submit comment 
function setupCommentSubmit(postId) {
  const commentInput   = document.getElementById('commentInput');
  const submitBtn      = document.getElementById('submitCommentBtn');
  const authOverlay    = document.getElementById('authOverlay');
  const closeAuthPopup = document.getElementById('closeAuthPopup');

  function openAuthPopup()    { authOverlay.classList.remove('d-none'); }
  function closeAuthPopupFn() { authOverlay.classList.add('d-none'); }

  if (closeAuthPopup) closeAuthPopup.addEventListener('click', closeAuthPopupFn);
  if (authOverlay)    authOverlay.addEventListener('click', (e) => { if (e.target === authOverlay) closeAuthPopupFn(); });

  commentInput.addEventListener('focus', () => {
    if (!localStorage.getItem('token')) { commentInput.blur(); openAuthPopup(); }
  });

  submitBtn.addEventListener('click', () => {
    const token = localStorage.getItem('token');
    if (!token) { openAuthPopup(); return; }

    const content = commentInput.value.trim();
    if (!content) return;

    const user_id = localStorage.getItem('loggedInUserId');
    submitBtn.disabled = true;

    fetchMethod(`${COMMENTS_BASE}/${postId}`, (status, data) => {
      submitBtn.disabled = false;
      if (status === 200 || status === 201) {
        commentInput.value = '';
        loadComments(postId);
      } else {
        alert(data.error || data.message || 'Failed to post comment.');
      }
    }, 'POST', { user_id, content }, token);
  });
}

//  Build comment 
function appendCommentToDOM(comment, postId) {
  const container = document.getElementById('commentsContainer');
  const { timeStr } = formatTimestamp(comment.created_at, null);

  const initial = comment.author_name
    ? comment.author_name.charAt(0).toUpperCase()
    : (comment.user_id ? String(comment.user_id).charAt(0) : 'U');
  const authorDisplay = comment.author_name || `User ${comment.user_id}`;

  const loggedInUserId = parseInt(localStorage.getItem('loggedInUserId'));
  const isOwner = loggedInUserId && parseInt(comment.user_id) === loggedInUserId;

  // Conditional menu options based on ownership
  const menuOptions = isOwner ? `
    <li>
      <button class="dropdown-item edit-comment-btn" data-comment-id="${comment.id}">
        <i class="fas fa-pen me-2"></i>Edit
      </button>
    </li>
    <li>
      <button class="dropdown-item text-danger delete-comment-btn" data-comment-id="${comment.id}">
        <i class="fas fa-trash-alt me-2"></i>Delete
      </button>
    </li>` : `
    <li>
      <button class="dropdown-item report-comment-btn" data-comment-id="${comment.id}">
        <i class="fas fa-flag me-2"></i>Report
      </button>
    </li>`;

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
            <div class="dropdown ms-2">
              <button class="btn btn-sm p-0 px-1 comment-menu-btn" data-bs-toggle="dropdown" style="line-height:1;">
                <i class="fas fa-ellipsis-h" style="font-size:0.8rem; color:var(--text-secondary);"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                ${menuOptions}
              </ul>
            </div>
          </div>
          <div class="comment-text-display">${escapeHtml(comment.content)}</div>
          <div class="comment-edit-form" style="display: none;">
            <textarea class="form-control form-control-sm comment-edit-input" rows="2">${escapeHtml(comment.content)}</textarea>
            <div class="mt-2 d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary cancel-edit-comment-btn">Cancel</button>
              <button class="btn btn-sm btn-primary save-edit-comment-btn" data-comment-id="${comment.id}">Save</button>
            </div>
          </div>
          <div class="comment-actions">
            <button class="comment-action-link">Like</button>
            <button class="comment-action-link">Reply</button>
            <span class="comment-timestamp">${timeStr}</span>
          </div>
        </div>
      </div>
    </div>`;

  // Event listeners
  el.querySelector('.comment-menu-btn').addEventListener('click', (e) => e.stopPropagation());

  // Edit button (owner only)
  const editBtn = el.querySelector('.edit-comment-btn');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      enterEditMode(el);
    });
  }

  // Delete button (owner only)
  const deleteBtn = el.querySelector('.delete-comment-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showConfirm(
        'Delete comment?',
        'This will permanently remove your comment.',
        () => deleteComment(comment.id, el, postId)
      );
    });
  }

  // Report button (non-owner only)
  const reportBtn = el.querySelector('.report-comment-btn');
  if (reportBtn) {
    reportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      alert('Report functionality will be implemented soon.');
      // TODO: Implement report functionality
    });
  }

  // Cancel edit button
  el.querySelector('.cancel-edit-comment-btn').addEventListener('click', () => {
    exitEditMode(el);
  });

  // Save edit button
  el.querySelector('.save-edit-comment-btn').addEventListener('click', () => {
    saveCommentEdit(comment.id, el);
  });

  container.appendChild(el);
}

// Enter edit mode for comment
function enterEditMode(commentEl) {
  commentEl.querySelector('.comment-text-display').style.display = 'none';
  commentEl.querySelector('.comment-edit-form').style.display = 'block';
  commentEl.querySelector('.comment-actions').style.display = 'none';
  commentEl.querySelector('.comment-edit-input').focus();
}

// Exit edit mode for comment
function exitEditMode(commentEl) {
  commentEl.querySelector('.comment-text-display').style.display = 'block';
  commentEl.querySelector('.comment-edit-form').style.display = 'none';
  commentEl.querySelector('.comment-actions').style.display = 'flex';
}

// Save edited comment - PUT /comments/:id
function saveCommentEdit(commentId, commentEl) {
  const input = commentEl.querySelector('.comment-edit-input');
  const newContent = input.value.trim();
  
  if (!newContent) {
    alert('Comment cannot be empty.');
    return;
  }

  const token = localStorage.getItem('token');
  const saveBtn = commentEl.querySelector('.save-edit-comment-btn');
  
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  fetchMethod(`${currentUrl}/comments/${commentId}`, (status, data) => {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';

    if (status === 200) {
      // Update the displayed text
      commentEl.querySelector('.comment-text-display').textContent = newContent;
      exitEditMode(commentEl);
    } else {
      alert(data.message || 'Failed to update comment.');
    }
  }, 'PUT', { content: newContent }, token);
}

//  Delete comment 
function deleteComment(commentId, commentEl, postId) {
  const token = localStorage.getItem('token');

  fetchMethod(`${currentUrl}/comments/${commentId}`, (status, data) => {
    if (status === 200) {
      commentEl.style.transition = 'opacity 0.2s';
      commentEl.style.opacity = '0';
      setTimeout(() => {
        commentEl.remove();
        const remaining = document.querySelectorAll('.comment-item').length;
        const countEl = document.getElementById('commentCountBtn');
        if (countEl) countEl.textContent = remaining;
        document.getElementById('totalCommentsLabel').textContent = `(${remaining})`;
        if (remaining === 0) showNoComments();
      }, 200);
    } else {
      alert('Failed to delete comment. Please try again.');
    }
  }, 'DELETE', null, token);
}

function showNoComments() {
  document.getElementById('commentsContainer').innerHTML = `
    <div class="text-muted text-center py-3" id="commentsPlaceholder">
      <i class="fas fa-comments fa-2x mb-2 d-block"></i>
      No comments yet. Be the first!
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

  let editedStr = null;
  if (wasEdited) {
    editedStr = updated.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
      + ', ' + updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return { timeStr, wasEdited, editedStr };
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