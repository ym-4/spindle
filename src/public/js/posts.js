//  individual posts view
//  fetches GET /posts/:id, renders post
//  Comments: GET /comments/:post_id, POST /comments/:post_id, PUT /comments/:id, DELETE /comments/:id
//  creator: PUT /posts/:id, DELETE /posts/:id

function feedApiBase() {
  if (typeof currentUrl !== 'undefined' && currentUrl) return currentUrl;
  if (typeof getApiBase === 'function') {
    const base = getApiBase();
    if (base) return base;
  }
  return window.location.origin || '';
}

const COMMENTS_BASE = `${currentUrl}/comments`;

document.addEventListener('DOMContentLoaded', () => {
  loadYourGroups();
  setupCommentSortUI();

  const params  = new URLSearchParams(window.location.search);
  const postId  = params.get('id');
  const editMode = params.get('edit') === 'true';

  if (!postId) { showError('No post ID found in URL.'); return; }

    loadSavedIds().then(() => {
    loadPost(postId, editMode);
  });

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

const REACTIONS_BASE = `${currentUrl}/posts`;
let currentReaction = null;
let openReplyThreads = new Set(); 
let savedPostIds = new Set();
let currentCommentSort = 'newest';
let activeCommentPostId = null;
let activeCommentsData = [];

// Load saved IDs
function loadSavedIds() {
  const userId = localStorage.getItem('loggedInUserId');
  const token  = localStorage.getItem('token');

  if (!userId || !token) return Promise.resolve();

  return new Promise((resolve) => {
    fetchMethod(`${currentUrl}/posts/saved/${userId}`, (status, data) => {
      if (status === 200 && Array.isArray(data)) {
        savedPostIds = new Set(data.map(row => parseInt(row.post_id)));
      }
      resolve();
    }, 'GET', null, token);
  });
}

// Save post
function savePost(postId, onSuccess) {
  const token  = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  if (!token) {
    showLoginRequiredModal();
    return;
  }

  fetchMethod(`${currentUrl}/posts/saved`, (status, data) => {
    if (status === 201) {
      savedPostIds.add(parseInt(postId));
      if (onSuccess) onSuccess(true);
    } else {
      alert(data.message || 'Failed to save post.');
    }
  }, 'POST', {
    user_id: userId,
    post_id: postId
  }, token);
}

// Unsave post
function unsavePost(postId, onSuccess) {
  const token  = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  if (!token) {
    showLoginRequiredModal();
    return;
  }

  fetchMethod(`${currentUrl}/posts/saved/${userId}`, (status, data) => {
    if (status !== 200) return;

    const row = data.find(
      r => parseInt(r.post_id) === parseInt(postId)
    );

    if (!row) return;

    fetchMethod(`${currentUrl}/posts/saved/${row.id}`, (delStatus) => {
      if (delStatus === 200) {
        savedPostIds.delete(parseInt(postId));
        if (onSuccess) onSuccess(false);
      } else {
        alert('Failed to unsave post.');
      }
    }, 'DELETE', null, token);

  }, 'GET', null, token);
}

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

  const isLoggedIn = !!localStorage.getItem('token');
  const loggedInUserId = parseInt(localStorage.getItem('loggedInUserId'));
  const isOwner = loggedInUserId && parseInt(post.user_id) === loggedInUserId;
  const isSaved = savedPostIds.has(parseInt(post.id));

  const ownerOptions = isOwner ? `
    <li><hr class="dropdown-divider"></li>
    <li><button class="dropdown-item pin-post-btn">
      <i class="fas fa-thumbtack me-2"></i>${post.pinned ? 'Unpin post' : 'Pin post'}
    </button></li>
    <li><button class="dropdown-item edit-post-btn">
      <i class="fas fa-pen me-2"></i>Edit post
    </button></li>
    <li><button class="dropdown-item text-danger delete-post-btn">
      <i class="fas fa-trash-alt me-2"></i>Delete post
    </button></li>` : '';

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
            ${isLoggedIn ? `
              <li>
                <button 
                  class="dropdown-item save-post-btn"
                  data-post-id="${post.id}"
                  data-saved="${isSaved}">
                  <i class="fa${isSaved ? 's' : 'r'} fa-bookmark me-2"></i>
                  ${isSaved ? 'Unsave post' : 'Save post'}
                </button>
              </li>` : ''}
            <li>
              <button class="dropdown-item report-post-btn">
                Report
              </button>
            </li>
            ${ownerOptions}
          </ul>
        </div>
      </div>

      <div class="d-flex gap-1 align-items-center flex-wrap mb-1">
        <span class="post-category ${categoryClass}">${categoryLabel}</span>
        ${post.visibility === 'friends_only' ? '<span class="badge bg-warning text-dark" style="font-size:0.65rem;"><i class="fas fa-user-friends me-1"></i>Friends</span>' : ''}
        ${post.pinned ? '<span class="badge bg-info text-dark" style="font-size:0.65rem;"><i class="fas fa-thumbtack me-1"></i>Pinned</span>' : ''}
      </div>

      ${post.title ? `<div class="fw-bold mt-2 mb-1" style="font-size:1.05rem;">${escapeHtml(post.title)}</div>` : ''}
      <div class="post-content">${escapeHtml(post.content)}</div>
      ${renderPostAttachment(post)}

      <div class="post-actions">
        <button 
          class="post-action-btn like-btn" 
          id="likeBtn"
          data-post-id="${post.id}">
          <i class="far fa-thumbs-up"></i>
          <span id="likeCount">${post.like_count || 0}</span>
        </button>
        <button 
          class="post-action-btn dislike-btn" 
          id="dislikeBtn"
          data-post-id="${post.id}">
          <i class="far fa-thumbs-down"></i>
          <span id="dislikeCount">${post.dislike_count || 0}</span>
        </button>
        <button class="post-action-btn" style="cursor: default;">
          <i class="far fa-comment"></i>
          <span id="commentCountBtn">0</span>
        </button>
        <button class="post-action-btn share-btn">
          <i class="far fa-share-square"></i> Share
        </button>
      </div>
    </div>`;

    setupReactionButtons(post.id);
    loadRelatedPosts(post.id, post.category);

    // Share button
    document.querySelector('.share-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openShareDropdown(e.currentTarget, post.id);
    });

    // save / unsave
    const saveBtn = document.querySelector('.save-post-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        const currentlySaved = saveBtn.dataset.saved === 'true';

        if (currentlySaved) {
          unsavePost(post.id, () => {
            saveBtn.dataset.saved = 'false';
            saveBtn.innerHTML = `
              <i class="far fa-bookmark me-2"></i>
              Save post
            `;
          });
        } else {
          savePost(post.id, () => {
            saveBtn.dataset.saved = 'true';
            saveBtn.innerHTML = `
              <i class="fas fa-bookmark me-2"></i>
              Unsave post
            `;
          });
        }
      });
    }

  if (isOwner) {
    document.querySelector('.pin-post-btn').addEventListener('click', async () => {
      try {
        const data = await authFetch(`/posts/${post.id}/pin`, { method: 'POST' });
        loadPost(post.id);
      } catch (err) {
        alert(err.message || 'Failed to toggle pin.');
      }
    });

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

      <div class="mb-2 d-flex gap-2">
        <select class="form-select form-select-sm" id="editCategory" style="width:auto;">
          <option value="confession" ${post.category === 'confession' ? 'selected' : ''}>Confession</option>
          <option value="qna"        ${post.category === 'qna'        ? 'selected' : ''}>Q&A</option>
          <option value="general"    ${post.category === 'general'    ? 'selected' : ''}>General Talk</option>
        </select>
        <select class="form-select form-select-sm" id="editVisibility" style="width:auto;">
          <option value="everyone" ${post.visibility !== 'friends_only' ? 'selected' : ''}>Everyone</option>
          <option value="friends_only" ${post.visibility === 'friends_only' ? 'selected' : ''}>Friends only</option>
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

      <div class="mb-3">
        <label class="form-label fw-semibold">
          Attachment
        </label>
        <!-- current attachment preview -->
        <div id="currentAttachmentPreview" class="mb-2">
          ${renderEditAttachmentPreview(post)}
        </div>
        <!-- upload new file -->
        <input
          type="file"
          class="form-control"
          id="editAttachment"
          accept="image/*,video/*">
        <!-- remove checkbox -->
        ${
          post.attachment_url
            ? `
              <div class="form-check mt-2">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="removeAttachment"
                >
                <label class="form-check-label" for="removeAttachment">
                  Remove current attachment
                </label>
              </div>
            `
            : ''
        }
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
    const visibility = document.getElementById('editVisibility').value;

    const attachmentInput = document.getElementById('editAttachment');

    const removeAttachmentCheckbox =
      document.getElementById('removeAttachment');

    const errEl = document.getElementById('editError');

    if (!title) {
      errEl.textContent = 'Title cannot be empty.';
      errEl.classList.remove('d-none');
      return;
    }

    if (!content) {
      errEl.textContent = 'Content cannot be empty.';
      errEl.classList.remove('d-none');
      return;
    }

    errEl.classList.add('d-none');

    const token   = localStorage.getItem('token');
    const user_id = localStorage.getItem('loggedInUserId');

    const saveBtn = document.getElementById('saveEditBtn');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const formData = new FormData();
    formData.append('user_id', user_id);
    formData.append('title', title);
    formData.append('content', content);
    formData.append('category', category);
    formData.append('visibility', visibility);

    // new uploaded file
    if (attachmentInput.files.length > 0) {
      formData.append('attachment', attachmentInput.files[0]);
    }
    // remove current attachment
    if (removeAttachmentCheckbox && removeAttachmentCheckbox.checked) {
      formData.append('remove_attachment', 'true');
    }

    fetch(`${currentUrl}/posts/${post.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    })
    .then(async (res) => {
      const data = await res.json();

      saveBtn.disabled = false;
      saveBtn.textContent = 'Save changes';

      if (res.ok) {
        const url = new URL(window.location.href);
        url.searchParams.delete('edit');

        window.history.replaceState({}, '', url);
        loadPost(post.id);

      } else {
        errEl.textContent =
          data.message || 'Failed to save changes.';

        errEl.classList.remove('d-none');
      }
    })
    .catch((err) => {
      console.error(err);

      saveBtn.disabled = false;
      saveBtn.textContent = 'Save changes';

      errEl.textContent = 'Something went wrong.';
      errEl.classList.remove('d-none');
    });
  });
}
// COMMENTS
function setupCommentSortUI() {
  document.querySelectorAll('.comment-sort-option').forEach((option) => {
    option.addEventListener('click', () => {
      currentCommentSort = option.dataset.sort || 'newest';

      document.querySelectorAll('.comment-sort-option').forEach((item) => {
        item.classList.toggle('active', item === option);
      });

      if (activeCommentPostId) {
        renderCommentsForPost(activeCommentPostId, activeCommentsData);
      }
    });
  });
}

function getCommentSortLabel(sortType) {
  return { newest: 'Newest', oldest: 'Oldest', top: 'Top' }[sortType] || 'Newest';
}

function sortCommentsForDisplay(comments, sortType, allComments = comments) {
  const list = [...comments];
  const loggedInUserId = parseInt(localStorage.getItem('loggedInUserId'));
  const getCreatedAt = (comment) => new Date(comment.created_at || 0).getTime();
  const getReplyCount = (comment) => allComments.filter(
    (entry) => parseInt(entry.parent_comment_id) === parseInt(comment.id)
  ).length;
  const isOwnComment = (comment) => loggedInUserId && parseInt(comment.user_id) === loggedInUserId;

  return list.sort((a, b) => {
    const aOwn = isOwnComment(a);
    const bOwn = isOwnComment(b);

    if (aOwn !== bOwn) return aOwn ? -1 : 1;

    if (sortType === 'oldest') return getCreatedAt(a) - getCreatedAt(b);

    //WIP: to change to like count
    if (sortType === 'top') {
      const replyDiff = getReplyCount(b) - getReplyCount(a);
      if (replyDiff !== 0) return replyDiff;
    }
    return getCreatedAt(b) - getCreatedAt(a);
  });
}

function renderCommentsForPost(postId, comments) {
  const container = document.getElementById('commentsContainer');
  if (!container) return;

  activeCommentPostId = postId;
  activeCommentsData = Array.isArray(comments) ? comments : [];

  container.innerHTML = '';

  const totalComments = activeCommentsData.length;
  const countEl = document.getElementById('commentCountBtn');
  if (countEl) countEl.textContent = totalComments;
  const totalLabel = document.getElementById('totalCommentsLabel');
  if (totalLabel) totalLabel.textContent = `(${totalComments})`;

  if (totalComments === 0) {
    showNoComments();
    return;
  }

  const sortedComments = sortCommentsForDisplay(activeCommentsData, currentCommentSort, activeCommentsData);
  sortedComments
    .filter((comment) => !comment.parent_comment_id)
    .forEach((comment) => appendCommentToDOM(comment, postId, sortedComments));
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
    if (status === 200) {
      const comments = Array.isArray(data) ? data : data.rows || [];
      renderCommentsForPost(postId, comments);
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
function appendCommentToDOM(comment, postId, allComments) {
  if (comment.parent_comment_id) return;

  const container = document.getElementById('commentsContainer');

  const group = document.createElement('div');
  group.className = 'comment-group';
  container.appendChild(group);

  const el = buildCommentEl(comment, postId, false);
  group.appendChild(el);

  const replies = sortCommentsForDisplay(
    allComments.filter(
      r => parseInt(r.parent_comment_id) === parseInt(comment.id)
    ),
    currentCommentSort,
    allComments
  );

  if (replies.length === 0) return;

  // replies wrapper 
  const repliesWrapper = document.createElement('div');
  repliesWrapper.className = 'replies-wrapper';
  const wasOpen = openReplyThreads.has(parseInt(comment.id));
  repliesWrapper.style.display = wasOpen ? 'block' : 'none';

  replies.forEach(reply => {
    repliesWrapper.appendChild(buildCommentEl(reply, postId, true, comment.id));
  });

  // toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'show-replies-btn';
  toggleBtn.dataset.commentId = comment.id;

  function updateToggleLabel(open) {
    toggleBtn.innerHTML = open
      ? `<i class="fas fa-chevron-up" style="font-size:0.7rem;"></i> Hide replies`
      : `<i class="fas fa-chevron-down" style="font-size:0.7rem;"></i> Show ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`;
  }

  updateToggleLabel(wasOpen);

  toggleBtn.addEventListener('click', () => {
    const isHidden = repliesWrapper.style.display === 'none';
    repliesWrapper.style.display = isHidden ? 'block' : 'none';
    updateToggleLabel(isHidden);
    if (isHidden) {
      openReplyThreads.add(parseInt(comment.id));
    } else {
      openReplyThreads.delete(parseInt(comment.id));
    }
  });

  group.appendChild(toggleBtn);
  group.appendChild(repliesWrapper);
}

// comment box
function buildCommentEl(comment, postId, isReply, rootParentId = null) {
  const { timeStr } = formatTimestamp(comment.created_at, null);

  const initial = comment.author_name
    ? comment.author_name.charAt(0).toUpperCase()
    : (comment.user_id ? String(comment.user_id).charAt(0) : 'U');
  const authorDisplay = comment.author_name || `User ${comment.user_id}`;

  const loggedInUserId = parseInt(localStorage.getItem('loggedInUserId'));
  const isOwner = loggedInUserId && parseInt(comment.user_id) === loggedInUserId;

  const menuOptions = `
    <li>
      <button class="dropdown-item report-comment-btn">
        <i class="fas fa-flag me-2"></i>Report
      </button>
    </li>
    ${isOwner ? `
      <li>
        <button class="dropdown-item edit-comment-btn">
          <i class="fas fa-pen me-2"></i>Edit
        </button>
      </li>
      <li>
        <button class="dropdown-item text-danger delete-comment-btn">
          <i class="fas fa-trash-alt me-2"></i>Delete
        </button>
      </li>` : ''}`;

  const el = document.createElement('div');
  el.className = isReply ? 'comment-item comment-reply' : 'comment-item';
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
              <ul class="dropdown-menu dropdown-menu-end">${menuOptions}</ul>
            </div>
          </div>
          <div class="comment-text-display">${escapeHtml(comment.content)}</div>
          <div class="comment-edit-form" style="display:none;">
            <textarea class="form-control form-control-sm comment-edit-input" rows="2">${escapeHtml(comment.content)}</textarea>
            <div class="mt-2 d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary cancel-edit-comment-btn">Cancel</button>
              <button class="btn btn-sm btn-primary save-edit-comment-btn">Save</button>
            </div>
          </div>
          <div class="comment-actions">
            <button class="comment-action-link">Like</button>
            <button class="comment-action-link reply-btn">Reply</button>
            <span class="comment-timestamp">${timeStr}</span>
          </div>
        </div>
      </div>
    </div>`;

  el.querySelector('.comment-menu-btn').addEventListener('click', (e) => e.stopPropagation());

  if (isOwner) {
    el.querySelector('.edit-comment-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      enterEditMode(el);
    });
    el.querySelector('.delete-comment-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showConfirm('Delete comment?', 'This will permanently remove your comment.',
        () => deleteComment(comment.id, el, postId));
    });
  }

  el.querySelector('.report-comment-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) { showLoginRequiredModal(); return; }
    alert('Report functionality WIP.');
  });

  el.querySelector('.cancel-edit-comment-btn').addEventListener('click', () => exitEditMode(el));
  el.querySelector('.save-edit-comment-btn').addEventListener('click', () => saveCommentEdit(comment.id, el));

  // Reply button 
  const replyBtn = el.querySelector('.reply-btn');
  if (replyBtn) {
    replyBtn.addEventListener('click', () => toggleReplyBox(el, comment, postId, rootParentId));
  }

  return el;
}

// comment replies
function toggleReplyBox(commentEl, comment, postId, rootParentId) {
  const existing = commentEl.querySelector('.reply-input-box');
  if (existing) { existing.remove(); return; }

  const token = localStorage.getItem('token');
  if (!token) { showLoginRequiredModal(); return; }

  const parentCommentId = rootParentId || comment.id;
  const replyingToName  = comment.author_name || 'User';

  const replyBox = document.createElement('div');
  replyBox.className = 'reply-input-box mt-2';
  replyBox.innerHTML = `
    <div class="d-flex gap-2 align-items-start">
      <textarea class="form-control form-control-sm" rows="2"
        placeholder="Write a reply..."></textarea>
      <div class="d-flex flex-column gap-1">
        <button class="btn btn-primary btn-sm submit-reply-btn">Reply</button>
        <button class="btn btn-outline-secondary btn-sm cancel-reply-btn">Cancel</button>
      </div>
    </div>`;

  const actionsEl = commentEl.querySelector('.comment-actions');
  actionsEl.after(replyBox);

  const textarea = replyBox.querySelector('textarea');
  textarea.value = `@${replyingToName} `;
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  replyBox.querySelector('.cancel-reply-btn').addEventListener('click', () => replyBox.remove());

  replyBox.querySelector('.submit-reply-btn').addEventListener('click', () => {
    const rawContent = textarea.value.trim();
    if (!rawContent) return;

    const mention = `@${replyingToName} `;
    const content = rawContent.startsWith('@') ? rawContent : mention + rawContent;

    const submitBtn = replyBox.querySelector('.submit-reply-btn');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Posting...';

    openReplyThreads.add(parseInt(parentCommentId));

    fetchMethod(`${COMMENTS_BASE}/${postId}`, (status, data) => {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Reply';

      if (status === 201 || status === 200) {
        replyBox.remove();
        loadComments(postId);
      } else {
        alert(data.message || 'Failed to post reply.');
      }
    }, 'POST', { content, parent_comment_id: parentCommentId }, token);
  });
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
      loadComments(postId);
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderPostAttachment(post) {
  if (!post.attachment_url) return '';

  const fileUrl = post.attachment_url.toLowerCase();

  // image extensions
  const isImage =
    fileUrl.endsWith('.png') ||
    fileUrl.endsWith('.jpg') ||
    fileUrl.endsWith('.jpeg') ||
    fileUrl.endsWith('.gif') ||
    fileUrl.endsWith('.webp');

  // video extensions
  const isVideo =
    fileUrl.endsWith('.mp4') ||
    fileUrl.endsWith('.webm') ||
    fileUrl.endsWith('.mov');

  if (isImage) {
    return `
      <div class="post-attachment mt-3">
        <img
          src="${post.attachment_url}"
          alt="Post attachment"
          class="img-fluid rounded"
          style="width:100%; max-height:500px; object-fit:cover;"
        >
      </div>
    `;
  }

  if (isVideo) {
    return `
      <div class="post-attachment mt-3">
        <video
          controls
          class="w-100 rounded"
          style="max-height:500px;"
        >
          <source src="${post.attachment_url}">
        </video>
      </div>
    `;
  }

  return `
    <div class="post-attachment mt-3">
      <a
        href="${post.attachment_url}"
        target="_blank"
        class="btn btn-outline-secondary btn-sm"
      >
        <i class="fas fa-paperclip me-2"></i>
        Open attachment
      </a>
    </div>
  `;
}

function renderEditAttachmentPreview(post) {
  if (!post.attachment_url) {
    return `
      <div class="text-muted small">
        No attachment uploaded
      </div>
    `;
  }

  const fileUrl = post.attachment_url.toLowerCase();

  const isImage =
    fileUrl.endsWith('.png') ||
    fileUrl.endsWith('.jpg') ||
    fileUrl.endsWith('.jpeg') ||
    fileUrl.endsWith('.gif') ||
    fileUrl.endsWith('.webp');

  const isVideo =
    fileUrl.endsWith('.mp4') ||
    fileUrl.endsWith('.webm') ||
    fileUrl.endsWith('.mov');

  if (isImage) {
    return `
      <img
        src="${post.attachment_url}"
        class="img-fluid rounded"
        style="max-height:220px;"
      >
    `;
  }

  if (isVideo) {
    return `
      <video
        controls
        class="rounded"
        style="max-height:220px; width:100%;"
      >
        <source src="${post.attachment_url}">
      </video>
    `;
  }

  return `
    <a
      href="${post.attachment_url}"
      target="_blank"
      class="btn btn-outline-secondary btn-sm"
    >
      Open current attachment
    </a>
  `;
}

//reactions
// load user's reaction for this post
function setupReactionButtons(postId) {
  const reportBtn = document.querySelector('.report-post-btn');

  if (reportBtn) {
    reportBtn.addEventListener('click', (e) => {
      e.preventDefault();

      const token = localStorage.getItem('token');
      if (!token) {
        showLoginRequiredModal();
        return;
      }
      openReportModal(postId);
    });
  }
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  const likeBtn = document.getElementById('likeBtn');
  const dislikeBtn = document.getElementById('dislikeBtn');

  likeBtn.addEventListener('click', () => {
    handleReaction(postId, 'like');
  });

  dislikeBtn.addEventListener('click', () => {
    handleReaction(postId, 'dislike');
  });

  // not logged in
  if (!token || !userId) return;

  // get existing user reaction
  fetchMethod(`${REACTIONS_BASE}/reaction/${userId}`, (status, data) => {
    if (status !== 200 || !Array.isArray(data)) return;

    const existingReaction = data.find(
      r => parseInt(r.post_id) === parseInt(postId)
    );

    if (existingReaction) {
      currentReaction = {
        id: existingReaction.id,
        reaction_type: existingReaction.reaction_type
      };

      updateReactionUI(existingReaction.reaction_type);
    }
  }, 'GET', null, token);
}

function handleReaction(postId, newReactionType) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  if (!token) {
    showLoginRequiredModal();
    return;
  }

  if (!currentReaction) {
    fetchMethod(`${REACTIONS_BASE}/like`, (status, data) => {
      if (status === 201) {
        currentReaction = {
          id: data.id,
          reaction_type: newReactionType
        };
        updateReactionUI(newReactionType);
        updateReactionCounts(null, newReactionType);
      }
    }, 'POST', {
      post_id: postId,
      user_id: userId,
      reaction_type: newReactionType
    }, token);
    return;
  }

  //remove reaction
  if (currentReaction.reaction_type === newReactionType) {
    fetchMethod(`${REACTIONS_BASE}/reaction/${currentReaction.id}`, (status) => {
      if (status === 200) {
        updateReactionCounts(currentReaction.reaction_type, null);
        currentReaction = null;
        updateReactionUI(null);
      }
    }, 'DELETE', {
      user_id: userId
    }, token);
    return;
  }

  // change reaction
  fetchMethod(`${REACTIONS_BASE}/reaction/${currentReaction.id}`, (status, data) => {
    if (status === 200) {
      updateReactionCounts(
        currentReaction.reaction_type,
        newReactionType
      );
      currentReaction.reaction_type = newReactionType;
      updateReactionUI(newReactionType);
    }
  }, 'PUT', {
    user_id: userId,
    reaction_type: newReactionType
  }, token);

}

// updates solid icons
function updateReactionUI(reactionType) {
  const likeBtn = document.getElementById('likeBtn');
  const dislikeBtn = document.getElementById('dislikeBtn');

  const likeIcon = likeBtn.querySelector('i');
  const dislikeIcon = dislikeBtn.querySelector('i');
  // reset
  likeIcon.className = 'far fa-thumbs-up';
  dislikeIcon.className = 'far fa-thumbs-down';

  likeBtn.style.color = '';
  dislikeBtn.style.color = '';

  // liked
  if (reactionType === 'like') {
    likeIcon.className = 'fas fa-thumbs-up';
    likeBtn.style.color = 'var(--primary-color)';
  }

  // disliked
  if (reactionType === 'dislike') {
    dislikeIcon.className = 'fas fa-thumbs-down';
    dislikeBtn.style.color = '#dc3545';
  }
}

// update count
function updateReactionCounts(oldReaction, newReaction) {
  const likeCountEl = document.getElementById('likeCount');
  const dislikeCountEl = document.getElementById('dislikeCount');

  let likes = parseInt(likeCountEl.textContent);
  let dislikes = parseInt(dislikeCountEl.textContent);

  // remove old
  if (oldReaction === 'like') likes--;
  if (oldReaction === 'dislike') dislikes--;

  // add new
  if (newReaction === 'like') likes++;
  if (newReaction === 'dislike') dislikes++;

  likeCountEl.textContent = likes;
  dislikeCountEl.textContent = dislikes;
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

function loadYourGroups() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  if (!token || !userId) {
    document.getElementById('yourGroupsDivider').style.display = 'none';
    document.getElementById('yourGroupsSection').style.display = 'none';
    return;
  }

  fetchMethod(`${currentUrl}/groups/joined_groups`, (status, data) => {
    if (status === 200 && Array.isArray(data) && data.length > 0) {
      // Reveal the container sections setup in posts.html
      document.getElementById('yourGroupsDivider').style.display = 'block';
      document.getElementById('yourGroupsSection').style.display = 'block';

      const container = document.getElementById('yourGroupsContainer');
      container.innerHTML = ''; 

      data.forEach(group => {
        const groupEl = document.createElement('a');
        groupEl.href = `group-details.html?id=${group.id}`;
        groupEl.className = 'sidebar-item px-3 py-2 d-flex align-items-center text-decoration-none';
        groupEl.style.fontSize = '0.9rem';
        
        groupEl.innerHTML = `
          <i class="fas fa-gradient fa-folder me-2 text-primary" style="font-size: 0.85rem;"></i>
          <span class="text-truncate">${escapeHtml(group.name)}</span>
        `;
        container.appendChild(groupEl);
      });
    } else {
      document.getElementById('yourGroupsDivider').style.display = 'none';
      document.getElementById('yourGroupsSection').style.display = 'none';
    }
  }, 'GET', null, token);
}


function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}

function renderYourGroups(groups) {
  const container = document.getElementById('yourGroupsContainer');
  if (!container) return;

  container.innerHTML = '';

  if (!groups.length) {
    // no study groups yet
    const emptyState = document.createElement('a');
    emptyState.href      = 'groups.html';
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
      emptyState.style.color       = 'var(--primary-color)';
    });
    emptyState.addEventListener('mouseleave', () => {
      emptyState.style.borderColor = 'var(--border-color)';
      emptyState.style.color       = 'var(--text-secondary)';
    });
    container.appendChild(emptyState);
    return;
  }

  groups.forEach(group => {
    const item = document.createElement('a');
    item.href      = `groups.html?id=${group.id}`;
    item.className = 'sidebar-item';
    item.innerHTML = `
      <i class="fas fa-circle" style="font-size:0.5rem; color:#1877f2;"></i>
      <span>${escapeHtml(group.name)}</span>
    `;
    container.appendChild(item);
  });

  const seeAll = document.createElement('a');
  seeAll.href      = 'groups.html';
  seeAll.className = 'sidebar-item';
  seeAll.innerHTML = `
    <i class="fas fa-plus-circle"></i>
    <span>See all groups</span>
  `;
  container.appendChild(seeAll);
}

function loadRelatedPosts(postId, category) {
  const container = document.getElementById('relatedPostsContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="list-group-item text-muted small text-center py-3">
      <div class="spinner-border spinner-border-sm" role="status"></div>
    </div>`;

  fetchMethod(`${feedApiBase()}/posts/related/${category}/${postId}`, (status, data) => {
    container.innerHTML = '';

    if (status !== 200 || !data.length) {
      container.innerHTML = `
        <div class="list-group-item text-muted small text-center py-2">
          No related posts found.
        </div>`;
      return;
    }

    const categoryBadgeClass = {
      confession: 'bg-danger',
      qna:        'bg-primary',
      general:    'bg-secondary'
    };

    data.forEach(related => {
      const item = document.createElement('a');
      item.href      = `posts.html?id=${related.id}`;
      item.className = 'list-group-item list-group-item-action';

      const badgeClass = categoryBadgeClass[related.category] || 'bg-secondary';
      const label      = getCategoryLabel(related.category);
      const authorText = related.is_anonymous ? 'Anonymous' : (related.author_name || 'User');
      const commentCount = related.comment_count ?? 0;

      item.innerHTML = `
        <div class="small">
          <span class="badge ${badgeClass} me-2">${label}</span>
          <div class="mt-1"><strong>${escapeHtml(related.title)}</strong></div>
          <div class="text-muted" style="font-size:0.75rem;">
            ${escapeHtml(authorText)} · ${commentCount} comment${commentCount !== 1 ? 's' : ''}
          </div>
        </div>`;

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
    { icon: 'fas fa-ban',                  label: 'Spam or misleading' },
    { icon: 'fas fa-exclamation-triangle', label: 'Harassment or bullying' },
    { icon: 'fas fa-heart-broken',         label: 'Harmful or dangerous content' },
    { icon: 'fas fa-user-slash',           label: 'Hate speech or discrimination' },
    { icon: 'fas fa-copyright',            label: 'Intellectual property violation' },
    { icon: 'fas fa-flag',                 label: 'Other' },
  ];

  const overlay = document.createElement('div');
  overlay.className = 'report-modal-overlay';
  overlay.id = 'reportModalOverlay';

  overlay.innerHTML = `
    <div class="report-modal-card">
      <h5>Report post</h5>
      <p class="report-modal-sub">Why are you reporting this post?</p>
      <div id="reportReasonsContainer">
        ${reasons.map(r => `
          <button class="report-reason-btn" data-reason="${r.label}">
            <i class="${r.icon}"></i> ${r.label}
          </button>
        `).join('')}
      </div>
      <div id="reportThanks" style="display:none; text-align:center; padding:1rem 0;"></div>
      <div class="report-modal-actions">
        <button class="btn btn-outline-secondary btn-sm" id="reportCancelBtn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  overlay.querySelectorAll('.report-reason-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const token   = localStorage.getItem('token');
      const user_id = localStorage.getItem('loggedInUserId');

      fetchMethod(`${feedApiBase()}/posts/${postId}/report`, (status, data) => {
        const reasonsContainer = overlay.querySelector('#reportReasonsContainer');
        const thanksEl         = overlay.querySelector('#reportThanks');
        const cancelBtn        = overlay.querySelector('#reportCancelBtn');

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

      }, 'POST', { user_id, reason: btn.dataset.reason }, token);
    });
  });

  overlay.querySelector('#reportCancelBtn').addEventListener('click', closeReportModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeReportModal(); });
}

function closeReportModal() {
  const overlay = document.getElementById('reportModalOverlay');
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  }
}