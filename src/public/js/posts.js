/* global fetchMethod, currentUrl*/

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
  setupSearch();
  if (typeof setupSearchDropdown === 'function') setupSearchDropdown();

  const params = new URLSearchParams(window.location.search);
  const postId = params.get('id');
  const editMode = params.get('edit') === 'true';

  if (!postId) {
    showError('No post ID found in URL.');
    return;
  }

  loadSavedIds().then(() => {
    loadPost(postId, editMode);
  });

  // If URL has #comment, scroll to that comment after load
  const hashMatch = window.location.hash.match(/^#comment-(\d+)$/);
  if (hashMatch) {
    const targetCommentId = hashMatch[1];

    let attempts = 0;
    const scrollInterval = setInterval(() => {
      const commentEl = document.querySelector(`[data-comment-id="${targetCommentId}"]`);

      if (commentEl) {
        clearInterval(scrollInterval);

        // open comment reply
        const repliesWrapper = commentEl.closest('.replies-wrapper');
        if (repliesWrapper && repliesWrapper.style.display === 'none') {
          const group = repliesWrapper.parentElement;
          const toggleBtn = group?.querySelector('.show-replies-btn');
          if (toggleBtn) toggleBtn.click();
        }

        setTimeout(() => {
          commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          commentEl.style.transition = 'background-color 0.4s ease';
          commentEl.style.backgroundColor = '#fffbcc';
          setTimeout(() => {
            commentEl.style.backgroundColor = '';
          }, 2000);
        }, 150);
      }

      if (++attempts > 200) clearInterval(scrollInterval);
    }, 50);
  }

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
let commentReactions = new Map();
let openReplyThreads = new Set();
let savedPostIds = new Set();
let savedCommentMap = new Map();
let currentCommentSort = 'newest';
let activeCommentPostId = null;
let activeCommentsData = [];
let pendingEditGifUrl = null;
let removeCurrentAttachment = false;
let commentAttachmentFile = null;
let commentGifUrl = null;

// Load saved IDs
function loadSavedIds() {
  const userId = localStorage.getItem('loggedInUserId');
  const token = localStorage.getItem('token');

  if (!userId || !token) return Promise.resolve();

  return new Promise((resolve) => {
    fetchMethod(
      `${currentUrl}/posts/saved/${userId}`,
      (status, data) => {
        if (status === 200 && Array.isArray(data)) {
          savedPostIds = new Set(data.map((row) => parseInt(row.post_id)));
        }
        // load saved comments
        fetchMethod(
          `${currentUrl}/comments/saved/${userId}`,
          (cStatus, cData) => {
            if (cStatus === 200 && Array.isArray(cData)) {
              cData.forEach((row) => {
                const saveId = row.save_id || row.id;
                savedCommentMap.set(parseInt(row.comment_id), saveId);
              });
            }
            resolve();
          },
          'GET',
          null,
          token,
        );
      },
      'GET',
      null,
      token,
    );
  });
}

// Save post
function savePost(postId, onSuccess) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  if (!token) {
    showLoginRequiredModal();
    return;
  }

  fetchMethod(
    `${currentUrl}/posts/saved`,
    (status, data) => {
      if (status === 201) {
        savedPostIds.add(parseInt(postId));
        if (onSuccess) onSuccess(true);
      } else {
        alert(data.message || 'Failed to save post.');
      }
    },
    'POST',
    {
      user_id: userId,
      post_id: postId,
    },
    token,
  );
}

// Unsave post
function unsavePost(postId, onSuccess) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  if (!token) {
    showLoginRequiredModal();
    return;
  }

  fetchMethod(
    `${currentUrl}/posts/saved/${userId}`,
    (status, data) => {
      if (status !== 200) return;

      const row = data.find((r) => parseInt(r.post_id) === parseInt(postId));

      if (!row) return;

      fetchMethod(
        `${currentUrl}/posts/saved/${row.id}`,
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

// Confirm modal
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

  // clone to remove previous listeners
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

function showLoginRequiredModal() {
  document.getElementById('authOverlay').classList.remove('d-none');
}

// gifs
function clearEditGifPreview() {
  pendingEditGifUrl = null;
  const preview = document.getElementById('editGifPreview');
  if (preview) preview.innerHTML = '';
  const attachmentInput = document.getElementById('editAttachment');
  if (attachmentInput) attachmentInput.value = '';
}

function clearCurrentAttachmentPreviewUI() {
  const preview = document.getElementById('currentAttachmentPreview');
  if (preview) {
    preview.innerHTML = `<div class="text-muted small">Current attachment will be replaced on save</div>`;
  }
}

function renderEditGifPreview() {
  const preview = document.getElementById('editGifPreview');
  if (!preview) return;

  if (!pendingEditGifUrl) {
    preview.innerHTML = '';
    return;
  }

  preview.innerHTML = `
    <div class="mt-2 position-relative d-inline-block">
      <button
        type="button"
        class="btn btn-sm btn-dark rounded-circle position-absolute top-0 end-0 p-1"
        style="width:24px; height:24px; line-height:1; z-index:2;"
        data-action="remove-edit-gif"
        aria-label="Remove GIF"
      >
        <i class="fas fa-times" style="font-size:0.7rem;"></i>
      </button>
      <div class="small text-muted mb-1">GIF selected</div>
      <img
        src="${pendingEditGifUrl}"
        alt="Selected GIF"
        style="max-width:120px; max-height:120px; border-radius:12px; object-fit:cover;"
      >
    </div>
  `;

  const removeBtn = preview.querySelector('[data-action="remove-edit-gif"]');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearEditGifPreview();
    });
  }
}

function setupEditGifPicker(post) {
  const modalEl = document.getElementById('gifPickerModal');
  const openBtn = document.getElementById('openEditGifPicker');

  if (!modalEl || !openBtn) return;

  const gifModal = bootstrap.Modal.getOrCreateInstance(modalEl);
  openBtn.addEventListener('click', () => {
    gifModal.show();
  });

  const attachmentInput = document.getElementById('editAttachment');
  if (attachmentInput) {
    attachmentInput.addEventListener('change', () => {
      if (attachmentInput.files.length > 0) {
        pendingEditGifUrl = null;
        removeCurrentAttachment = false;
        renderEditGifPreview();
        clearCurrentAttachmentPreviewUI();
        autoSaveAttachmentChange(post);
      }
    });
  }

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
      searchEditGifs(query, post, gifModal);
    }, 300);
  });
}

async function searchEditGifs(query, post, gifModal) {
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
        pendingEditGifUrl = originalUrl;
        removeCurrentAttachment = false;
        renderEditGifPreview();
        clearCurrentAttachmentPreviewUI();
        resultsContainer
          .querySelectorAll('.selected')
          .forEach((x) => x.classList.remove('selected'));
        img.classList.add('selected');
        if (gifModal) gifModal.hide();
        autoSaveAttachmentChange(post);
      };
      resultsContainer.appendChild(img);
    });
  } catch (err) {
    console.error(err);
    resultsContainer.innerHTML = 'Failed to load GIFs';
  }
}

// TAGS
function loadPostTagsOnPostPage(postId) {
  fetchMethod(`${currentUrl}/posts/${postId}/tags`, (status, tags) => {
    const container = document.getElementById(`postTags-${postId}`);
    if (!container || status !== 200 || !Array.isArray(tags) || !tags.length) return;

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

function setupEditTagSection(post) {
  const section = document.getElementById('editTagSection');
  if (!section) return;

  const token = localStorage.getItem('token');
  let editTags = [];

  // Load existing tags for this post
  fetchMethod(`${currentUrl}/posts/${post.id}/tags`, (status, tags) => {
    editTags = status === 200 && Array.isArray(tags) ? tags.map((t) => t.name) : [];
    renderEditTagSection();
  });

  function renderEditTagSection() {
    section.innerHTML = `
      <div class="p-3 border rounded" style="border-radius:10px; background:var(--background-color);">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="subtle-label mb-0">TAGS</span>
          <span class="tag-count-hint" id="editTagCountHint">${editTags.length} / 10</span>
        </div>

        <div class="position-relative">
          <div class="tag-input-wrapper" id="editTagInputWrapper">
            <input
              type="text"
              class="tag-text-input"
              id="editTagTextInput"
              placeholder="#addtag"
              autocomplete="off"
              maxlength="50"
            >
          </div>
          <div class="tag-autocomplete" id="editTagAutocomplete" style="display:none;"></div>
        </div>

        <div class="mt-2">
          <button type="button" class="btn btn-sm btn-outline-primary" id="saveTagsBtn">
            <i class="fas fa-tags me-1"></i>Save tags
          </button>
        </div>
        <div id="tagEditMsg" class="mt-2" style="font-size:0.85rem;"></div>
      </div>
    `;

    // Render tags
    renderEditTagChips();
    setupEditTagInput();

    // Save tags button
    document.getElementById('saveTagsBtn').addEventListener('click', () => {
      const msgEl = document.getElementById('tagEditMsg');
      msgEl.innerHTML = '';

      fetchMethod(
        `${currentUrl}/posts/${post.id}/tags`,
        (s, data) => {
          if (s === 200) {
            msgEl.innerHTML = `<span class="text-success"><i class="fas fa-check me-1"></i>Tags saved.</span>`;
            setTimeout(() => {
              msgEl.innerHTML = '';
            }, 2000);
          } else {
            msgEl.innerHTML = `<span class="text-danger">${data?.message || 'Failed to save tags.'}</span>`;
          }
        },
        'PUT',
        { tag_names: editTags },
        token,
      );
    });
  }

  function renderEditTagChips() {
    const wrapper = document.getElementById('editTagInputWrapper');
    const input = document.getElementById('editTagTextInput');
    if (!wrapper || !input) return;

    wrapper.querySelectorAll('.tag-chip').forEach((el) => el.remove());

    editTags.forEach((name) => {
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
        editTags = editTags.filter((t) => t !== name);
        renderEditTagChips();
        updateEditTagHint();
      });
      wrapper.insertBefore(chip, input);
    });
  }

  function setupEditTagInput() {
    const wrapper = document.getElementById('editTagInputWrapper');
    const input = document.getElementById('editTagTextInput');
    const autocomplete = document.getElementById('editTagAutocomplete');
    if (!wrapper || !input || !autocomplete) return;

    let debounce;

    wrapper.addEventListener('click', () => input.focus());

    input.addEventListener('input', () => {
      const query = input.value.replace(/^#/, '').trim();
      if (!query) {
        autocomplete.style.display = 'none';
        return;
      }

      clearTimeout(debounce);
      debounce = setTimeout(() => {
        fetchMethod(
          `${currentUrl}/posts/tags/search?q=${encodeURIComponent(query)}`,
          (status, data) => {
            if (status !== 200 || !data.length) {
              autocomplete.style.display = 'none';
              return;
            }
            renderEditAutocomplete(data, query);
          },
        );
      }, 250);
    });

    input.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        addEditTag(input.value.replace(/^#/, '').trim());
      }
      if (e.key === 'Backspace' && !input.value && editTags.length) {
        editTags.pop();
        renderEditTagChips();
        updateEditTagHint();
      }
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) autocomplete.style.display = 'none';
    });

    function renderEditAutocomplete(tags, query) {
      autocomplete.innerHTML = '';
      const exactMatch = tags.some((t) => t.name === query.toLowerCase());

      if (!exactMatch) {
        const createItem = document.createElement('div');
        createItem.className = 'tag-autocomplete-item';
        createItem.innerHTML = `<span>Create <strong>#${escapeHtml(query)}</strong></span>`;
        createItem.addEventListener('click', () => {
          addEditTag(query);
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
          addEditTag(tag.name);
          autocomplete.style.display = 'none';
        });
        autocomplete.appendChild(item);
      });

      autocomplete.style.display = 'block';
    }

    function addEditTag(name) {
      const clean = name.toLowerCase().trim().replace(/\s+/g, '');
      if (!clean || editTags.includes(clean) || editTags.length >= 10) return;
      editTags.push(clean);
      renderEditTagChips();
      input.value = '';
      autocomplete.style.display = 'none';
      updateEditTagHint();
    }
  }

  function updateEditTagHint() {
    const hint = document.getElementById('editTagCountHint');
    if (hint) hint.textContent = `${editTags.length} / 10`;
  }
}

//Load post
function loadPost(postId, editMode = false) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  // Load comment reactions
  const reactionsPromise =
    token && userId
      ? new Promise((resolve) => {
          fetchMethod(
            `${currentUrl}/comments/reaction/${userId}`,
            (status, data) => {
              if (status === 200 && Array.isArray(data)) {
                commentReactions = new Map(
                  data.map((r) => [
                    parseInt(r.comment_id),
                    { id: r.id, reaction_type: r.reaction_type },
                  ]),
                );
              }
              resolve();
            },
            'GET',
            null,
            token,
          );
        })
      : Promise.resolve();

  reactionsPromise.then(() => {
    fetchMethod(`${currentUrl}/posts/${postId}`, (status, data) => {
      if (status === 200 && data) {
        if (editMode) renderPostEditMode(data);
        else {
          renderPost(data);
          fetchMethod(`${feedApiBase()}/posts/${postId}/view`, () => {}, 'POST', null, null);
        }
        document.getElementById('commentsSection').style.display = 'block';
        loadComments(postId);
        setupCommentSubmit(postId);
      } else {
        showError('Post not found.');
      }
    });
  });
}

// Render post
function renderPost(post) {
  document.title = `${escapeHtml(post.title || 'Post')} - Spindle`;

  const { timeStr, wasEdited } = formatTimestamp(post.created_at, post.updated_at);
  const categoryLabel = getCategoryLabel(post.category);
  const categoryClass = getCategoryClass(post.category);
  const initial = getAvatarInitial(post);
  const authorName = getAuthorName(post);

  const isLoggedIn = !!localStorage.getItem('token');
  const loggedInUserId = parseInt(localStorage.getItem('loggedInUserId'));
  const isOwner = loggedInUserId && parseInt(post.user_id) === loggedInUserId;
  const isSaved = savedPostIds.has(parseInt(post.id));

  const ownerOptions = isOwner
    ? `
    <li><hr class="dropdown-divider"></li>
    <li><button class="dropdown-item pin-post-btn">
      <i class="fas fa-thumbtack me-2"></i>${post.pinned ? 'Unpin post' : 'Pin post'}
    </button></li>
    <li><button class="dropdown-item edit-post-btn">
      <i class="fas fa-pen me-2"></i>Edit post
    </button></li>
    <li><button class="dropdown-item insights-post-btn">
      <i class="fas fa-chart-bar me-2"></i>View Insights
    </button></li>
    <li><button class="dropdown-item text-danger delete-post-btn">
      <i class="fas fa-trash-alt me-2"></i>Delete post
    </button></li>`
    : '';

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
            ${
              isLoggedIn
                ? `
              <li>
                <button 
                  class="dropdown-item save-post-btn"
                  data-post-id="${post.id}"
                  data-saved="${isSaved}">
                  <i class="fa${isSaved ? 's' : 'r'} fa-bookmark me-2"></i>
                  ${isSaved ? 'Unsave post' : 'Save post'}
                </button>
              </li>`
                : ''
            }
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
      <div class="post-content ql-editor" style="padding:0; font-size:inherit; line-height:1.5;">${post.content || ''}</div>
      ${renderPostAttachment(post)}

      ${post.poll_id ? `<div id="pollContainer-${post.id}"></div>` : ''}
      <div class="post-tags" id="postTags-${post.id}"></div>

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

  if (post.poll_id) {
    loadAndRenderPollOnPostPage(post.id);
  }
  loadPostTagsOnPostPage(post.id);

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

    document.querySelector('.insights-post-btn').addEventListener('click', () => {
      window.location.href = `postAnalytics.html?id=${post.id}`;
    });

    document.querySelector('.delete-post-btn').addEventListener('click', () => {
      showConfirm(
        'Delete post?',
        'This will permanently remove the post and all its comments.',
        () => {
          const token = localStorage.getItem('token');
          fetchMethod(
            `${currentUrl}/posts/${post.id}`,
            (status, data) => {
              if (status === 200) window.location.href = 'index.html';
              else alert(data.message || 'Failed to delete post.');
            },
            'DELETE',
            null,
            token,
          );
        },
      );
    });
  }
}

function submitPostEdit(post) {
  const title = document.getElementById('editTitle').value.trim();
  const content = document.getElementById('editContent').value.trim();
  const category = document.getElementById('editCategory').value;

  const attachmentInput = document.getElementById('editAttachment');
  const errEl = document.getElementById('editError');

  if (!title) {
    errEl.textContent = 'Title cannot be empty.';
    errEl.classList.remove('d-none');
    return Promise.reject(new Error('Title cannot be empty.'));
  }

  const hasPollInEdit = !!document.getElementById('editPollSection')?.dataset.hasPoll;
  if (!content && !hasPollInEdit) {
    errEl.textContent = 'Content cannot be empty when there is no poll.';
    errEl.classList.remove('d-none');
    return Promise.reject(new Error('Content cannot be empty.'));
  }

  errEl.classList.add('d-none');

  const token = localStorage.getItem('token');
  const user_id = localStorage.getItem('loggedInUserId');

  const formData = new FormData();
  formData.append('user_id', user_id);
  formData.append('title', title);
  formData.append('content', content);
  formData.append('category', category);

  if (attachmentInput.files.length > 0) {
    formData.append('attachment', attachmentInput.files[0]);
  } else if (pendingEditGifUrl) {
    formData.append('gif_url', pendingEditGifUrl);
  } else if (removeCurrentAttachment) {
    formData.append('remove_attachment', 'true');
  }

  return fetch(`${currentUrl}/posts/${post.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save changes.');
      return data;
    })
    .catch((err) => {
      errEl.textContent = err.message || 'Something went wrong.';
      errEl.classList.remove('d-none');
      throw err;
    });
}

function autoSaveAttachmentChange(post) {
  const saveBtn = document.getElementById('saveEditBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  submitPostEdit(post)
    .then(() => {
      loadPost(post.id, true);
    })
    .catch((err) => {
      console.error(err);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save changes';
      }
    });
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
          <option value="qna" ${post.category === 'qna' ? 'selected' : ''}>Q&A</option>
          <option value="general" ${post.category === 'general' ? 'selected' : ''}>General Talk</option>
          <option value="events" ${post.category === 'events' ? 'selected' : ''}>Events</option>
          <option value="news" ${post.category === 'news' ? 'selected' : ''}>News</option>
          <option value="cca" ${post.category === 'cca' ? 'selected' : ''}>CCA</option>
          <option value="internship" ${post.category === 'internship' ? 'selected' : ''}>Internship</option>
          <option value="SOC" ${post.category === 'SOC' ? 'selected' : ''}>SOC</option>
          <option value="ABE" ${post.category === 'ABE' ? 'selected' : ''}>ABE</option>
          <option value="SB" ${post.category === 'SB' ? 'selected' : ''}>SB</option>
          <option value="CLS" ${post.category === 'CLS' ? 'selected' : ''}>CLS</option>
          <option value="EEE" ${post.category === 'EEE' ? 'selected' : ''}>EEE</option>
          <option value="MAD" ${post.category === 'MAD' ? 'selected' : ''}>MAD</option>
          <option value="MAE" ${post.category === 'MAE' ? 'selected' : ''}>MAE</option>
          <option value="SMA" ${post.category === 'SMA' ? 'selected' : ''}>SMA</option>
        </select>
      </div>

      <div class="mb-2">
        <input type="text" class="form-control" id="editTitle"
          placeholder="Post title" value="${escapeHtml(post.title || '')}">
      </div>

      <div class="mb-3">
        <div id="editQuillEditor" style="height:180px; border-radius:0 0 8px 8px;"></div>
        <input type="hidden" id="editContent">
      </div>

      <div id="editPollSection" class="mb-3"></div>
      <div id="editTagSection" class="mb-3"></div>

      <div class="mb-3">
        <label class="form-label fw-semibold">
          Attachment / GIF
        </label>
        <!-- current attachment preview -->
        <div id="currentAttachmentPreview" class="mb-2">
          ${renderCurrentAttachmentBlock(post)}
        </div>
        <div class="d-flex align-items-center gap-2 mt-2">
          <input
            type="file"
            class="form-control"
            id="editAttachment"
            accept="image/*,video/*">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            id="openEditGifPicker"
          >
            GIF
          </button>
        </div>
        <div id="editGifPreview" class="mt-2"></div>
      </div>

      <div id="editError" class="alert alert-danger py-2 d-none"></div>

      <div class="d-flex gap-2 justify-content-end">
        <button class="btn btn-outline-secondary btn-sm" id="cancelEditBtn">Cancel</button>
        <button class="btn btn-primary btn-sm" id="saveEditBtn">Save changes</button>
      </div>
    </div>`;

  pendingEditGifUrl = null;
  removeCurrentAttachment = false;

  // Quill edit mode
  const editQuill = new Quill('#editQuillEditor', {
    theme: 'snow',
    placeholder: 'Post content (optional if poll exists)',
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

  if (post.content) {
    editQuill.root.innerHTML = post.content;
  }

  editQuill.on('text-change', () => {
    document.getElementById('editContent').value =
      editQuill.getText().trim() === '' ? '' : editQuill.root.innerHTML;
  });
  document.getElementById('editContent').value = post.content || '';

  renderEditGifPreview();
  setupEditGifPicker(post);
  setupRemoveAttachmentButton(post);
  setupEditPollSection(post);
  setupEditTagSection(post);

  document.getElementById('cancelEditBtn').addEventListener('click', () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.history.replaceState({}, '', url);
    renderPost(post);
  });

  document.getElementById('saveEditBtn').addEventListener('click', () => {
    const title = document.getElementById('editTitle').value.trim();
    const content = document.getElementById('editContent').value.trim();
    const category = document.getElementById('editCategory').value;

    const errEl = document.getElementById('editError');

    if (!title) {
      errEl.textContent = 'Title cannot be empty.';
      errEl.classList.remove('d-none');
      return;
    }
    // Content is only required if no poll
    const hasPollInEdit = !!document.getElementById('editPollSection')?.dataset.hasPoll;
    if (!content && !hasPollInEdit) {
      errEl.textContent = 'Content cannot be empty when there is no poll.';
      errEl.classList.remove('d-none');
      return;
    }

    errEl.classList.add('d-none');

    const saveBtn = document.getElementById('saveEditBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    submitPostEdit(post)
      .then(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('edit');
        window.history.replaceState({}, '', url);
        loadPost(post.id);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save changes';
      });
  });
}

function setupEditPollSection(post) {
  const section = document.getElementById('editPollSection');
  if (!section) return;

  const token = localStorage.getItem('token');

  // Fetch existing poll for this post
  fetchMethod(`${currentUrl}/posts/${post.id}/poll`, (status, poll) => {
    if (status !== 200 || !poll) {
      // No poll
      section.innerHTML = '';
      return;
    }

    section.dataset.hasPoll = 'true';

    section.innerHTML = `
      <div class="poll-edit-block p-3 border rounded" style="border-radius:10px; background:var(--background-color);">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="subtle-label mb-0">POLL</span>
          <button type="button" class="btn btn-sm btn-outline-danger" id="deletePollEditBtn">
            <i class="fas fa-trash-alt me-1"></i>Remove poll
          </button>
        </div>

        <div class="mb-2">
          <label class="form-label small text-muted">Poll question</label>
          <input type="text" class="form-control form-control-sm" id="editPollQuestion"
            value="${escapeHtml(typeof poll.question === 'object' ? poll.question?.question || '' : poll.question || '')}">
        </div>

        <div class="text-muted small mb-1">
          <i class="fas fa-info-circle me-1"></i>
          Options cannot be edited — only the question can be changed.
        </div>

        <div class="mt-2">
          ${poll.options
            .map(
              (opt) => `
            <div class="poll-option voted mb-1" style="cursor:default; pointer-events:none;">
              <div class="poll-option-bar" style="width:0%"></div>
              <span class="poll-option-label">${escapeHtml(opt.option_text)}</span>
            </div>
          `,
            )
            .join('')}
        </div>

        <div class="mt-2 d-flex gap-2">
          <button type="button" class="btn btn-sm btn-outline-primary" id="savePollQuestionBtn">
            Save question
          </button>
        </div>

        <div id="pollEditMsg" class="mt-2" style="font-size:0.85rem;"></div>
      </div>
    `;

    // Save poll question
    document.getElementById('savePollQuestionBtn').addEventListener('click', () => {
      const newQuestion = document.getElementById('editPollQuestion').value.trim();
      const msgEl = document.getElementById('pollEditMsg');

      if (!newQuestion) {
        msgEl.innerHTML = `<span class="text-danger">Question cannot be empty.</span>`;
        return;
      }

      fetchMethod(
        `${currentUrl}/posts/${post.id}/poll`,
        (s) => {
          if (s === 200) {
            msgEl.innerHTML = `<span class="text-success"><i class="fas fa-check me-1"></i>Question saved.</span>`;
            setTimeout(() => {
              msgEl.innerHTML = '';
            }, 2000);
          } else {
            msgEl.innerHTML = `<span class="text-danger">Failed to update question.</span>`;
          }
        },
        'PUT',
        { question: newQuestion },
        token,
      );
    });

    // Delete poll
    document.getElementById('deletePollEditBtn').addEventListener('click', () => {
      showConfirm(
        'Remove poll?',
        'This will permanently delete the poll and all its votes.',
        () => {
          fetchMethod(
            `${currentUrl}/posts/${post.id}/poll`,
            (s) => {
              if (s === 200) {
                section.dataset.hasPoll = '';
                section.innerHTML = '';
              } else {
                alert('Failed to remove poll.');
              }
            },
            'DELETE',
            null,
            token,
          );
        },
      );
    });
  });
}

// ==========================
// POLL
// ==========================
function loadAndRenderPollOnPostPage(postId) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  fetchMethod(`${currentUrl}/posts/${postId}/poll`, (status, poll) => {
    const container = document.getElementById(`pollContainer-${postId}`);
    if (!container || status !== 200) return;

    const totalVotes = poll.options.reduce((sum, o) => sum + (o.vote_count || 0), 0);

    const userVoteCheck =
      token && userId
        ? new Promise((resolve) => {
            fetchMethod(
              `${currentUrl}/posts/${postId}/poll/vote/${userId}`,
              (vs, vd) => resolve(vs === 200 ? vd.vote : null),
              'GET',
              null,
              token,
            );
          })
        : Promise.resolve(null);

    userVoteCheck.then((userVote) => {
      renderPollInContainer(container, poll, postId, totalVotes, userVote, token);
    });
  });
}

function renderPollInContainer(container, poll, postId, totalVotes, userVote, token) {
  const hasVoted = !!userVote;
  const pollQuestion =
    typeof poll.question === 'object'
      ? poll.question?.question || JSON.stringify(poll.question)
      : poll.question || '';

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
    ? `<button class="btn btn-link btn-sm p-0 mt-1 undo-vote-btn"
         style="font-size:0.8rem; color:var(--text-secondary);">
         <i class="fas fa-times-circle me-1"></i>Remove vote
       </button>`
    : '';

  container.innerHTML = [
    `<div class="poll-container">`,
    `<div class="poll-question">${escapeHtml(pollQuestion)}</div>`,
    optionsHtml,
    `<div class="poll-meta d-flex align-items-center gap-2">`,
    `  <span>${totalVotes} vote${totalVotes !== 1 ? 's' : ''}</span>`,
    undoHtml,
    `</div>`,
    `</div>`,
  ].join('');

  // Vote
  if (!hasVoted && token) {
    container.querySelectorAll('.poll-option').forEach((optEl) => {
      optEl.addEventListener('click', (e) => {
        e.stopPropagation();
        fetchMethod(
          `${currentUrl}/posts/${postId}/poll/vote`,
          (vs) => {
            if (vs === 201 || vs === 409) loadAndRenderPollOnPostPage(postId);
          },
          'POST',
          { poll_id: poll.id, option_id: optEl.dataset.optionId },
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
        fetchMethod(
          `${currentUrl}/posts/${postId}/poll/vote`,
          (ds) => {
            if (ds === 200) {
              fetchMethod(
                `${currentUrl}/posts/${postId}/poll/vote`,
                (vs) => {
                  if (vs === 201 || vs === 409) loadAndRenderPollOnPostPage(postId);
                },
                'POST',
                { poll_id: poll.id, option_id: optEl.dataset.optionId },
                token,
              );
            }
          },
          'DELETE',
          { poll_id: poll.id },
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
        `${currentUrl}/posts/${postId}/poll/vote`,
        (ds) => {
          if (ds === 200) loadAndRenderPollOnPostPage(postId);
        },
        'DELETE',
        { poll_id: poll.id },
        token,
      );
    });
  }
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
  const getReplyCount = (comment) =>
    allComments.filter((entry) => parseInt(entry.parent_comment_id) === parseInt(comment.id))
      .length;
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

  const sortedComments = sortCommentsForDisplay(
    activeCommentsData,
    currentCommentSort,
    activeCommentsData,
  );
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

  fetchMethod(
    `${COMMENTS_BASE}/${postId}`,
    (status, data) => {
      if (status === 200) {
        const comments = Array.isArray(data) ? data : data.rows || [];
        renderCommentsForPost(postId, comments);
      } else {
        container.innerHTML = `<div class="text-muted text-center py-3">Could not load comments.</div>`;
      }
    },
    'GET',
    null,
    token,
  );
}

// Submit comment
function setupCommentSubmit(postId) {
  const commentInput = document.getElementById('commentInput');
  const submitBtn = document.getElementById('submitCommentBtn');
  submitBtn.disabled = true;
  commentInput.addEventListener('input', updateCommentSubmitState);

  const authOverlay = document.getElementById('authOverlay');
  const closeAuthPopup = document.getElementById('closeAuthPopup');

  function openAuthPopup() {
    authOverlay.classList.remove('d-none');
  }
  function closeAuthPopupFn() {
    authOverlay.classList.add('d-none');
  }

  if (closeAuthPopup) closeAuthPopup.addEventListener('click', closeAuthPopupFn);
  if (authOverlay)
    authOverlay.addEventListener('click', (e) => {
      if (e.target === authOverlay) closeAuthPopupFn();
    });

  commentInput.addEventListener('focus', () => {
    if (!localStorage.getItem('token')) {
      commentInput.blur();
      openAuthPopup();
    }
  });

  // Attachment file input
  const attachmentInput = document.getElementById('commentAttachmentInput');
  if (attachmentInput) {
    attachmentInput.addEventListener('change', () => {
      const file = attachmentInput.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        alert('File too large. Max 8MB.');
        attachmentInput.value = '';
        return;
      }
      commentAttachmentFile = file;
      commentGifUrl = null;
      renderCommentMediaPreview();
      updateCommentSubmitState();
    });
  }

  // GIF toggle button
  const gifToggleBtn = document.getElementById('commentGifToggleBtn');
  const gifPanel = document.getElementById('commentGifPanel');
  if (gifToggleBtn && gifPanel) {
    gifToggleBtn.addEventListener('click', () => {
      const isOpen = gifPanel.classList.contains('open');
      gifPanel.classList.toggle('open', !isOpen);
      if (!isOpen) {
        document.getElementById('commentGifSearchInput')?.focus();
        const resultsEl = document.getElementById('commentGifResults');
        if (resultsEl && !resultsEl.innerHTML.trim()) {
          resultsEl.innerHTML =
            '<div class="gif-grid-empty"><i class="fas fa-search mb-2 d-block" style="font-size:1.2rem;"></i>Search GIFs</div>';
        }
      }
    });
  }

  // GIF search
  const gifSearchInput = document.getElementById('commentGifSearchInput');
  if (gifSearchInput) {
    let debounce;
    gifSearchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      const query = gifSearchInput.value.trim();
      if (!query) {
        document.getElementById('commentGifResults').innerHTML =
          '<div class="gif-grid-empty"><i class="fas fa-search mb-2 d-block" style="font-size:1.2rem;"></i>Search GIFs</div>';
        return;
      }
      debounce = setTimeout(() => searchCommentGifs(query), 300);
    });
  }

  // Submit
  submitBtn.addEventListener('click', () => {
    const token = localStorage.getItem('token');
    if (!token) {
      openAuthPopup();
      return;
    }

    const content = commentInput.value.trim();
    if (!content && !commentAttachmentFile && !commentGifUrl) return;

    const user_id = localStorage.getItem('loggedInUserId');
    submitBtn.disabled = true;

    const formData = new FormData();
    formData.append('user_id', user_id);
    formData.append('content', content || ' ');

    if (commentAttachmentFile) {
      formData.append('attachment', commentAttachmentFile);
    } else if (commentGifUrl) {
      formData.append('attachment_url', commentGifUrl);
    }

    fetch(`${COMMENTS_BASE}/${postId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
      .then(async (res) => {
        const data = await res.json();
        submitBtn.disabled = false;
        if (res.status === 200 || res.status === 201) {
          commentInput.value = '';
          commentAttachmentFile = null;
          commentGifUrl = null;
          clearCommentMediaPreview();
          if (gifPanel) gifPanel.classList.remove('open');
          if (gifSearchInput) gifSearchInput.value = '';
          document.getElementById('commentGifResults').innerHTML =
            '<div class="gif-grid-empty"><i class="fas fa-search mb-2 d-block" style="font-size:1.2rem;"></i>Search GIFs</div>';

          // @pandabot mentioned
          loadComments(postId);

          // refresh
          const mentionedBot = /\@pandabot/i.test(content || '');
          if (mentionedBot) {
            let attempts = 0;
            const poll = setInterval(() => {
              attempts++;
              fetchMethod(
                `${COMMENTS_BASE}/${postId}`,
                (s, d) => {
                  if (s !== 200) return;
                  const allComments = Array.isArray(d) ? d : d.rows || [];
                  const botReplied = allComments.some(
                    (c) => c.author_name?.toLowerCase() === 'pandabot',
                  );
                  if (botReplied || attempts >= 15) {
                    clearInterval(poll);
                    if (botReplied) loadComments(postId);
                  }
                },
                'GET',
                null,
                localStorage.getItem('token'),
              );
            }, 1000);
          }
        } else {
          alert(data.error || data.message || 'Failed to post comment.');
        }
      })
      .catch((err) => {
        submitBtn.disabled = false;
        console.error(err);
        alert('Failed to post comment.');
      });
  });
}

function updateCommentSubmitState() {
  const commentInput = document.getElementById('commentInput');
  const submitBtn = document.getElementById('submitCommentBtn');
  if (!commentInput || !submitBtn) return;

  const hasContent = commentInput.value.trim().length > 0;
  const hasMedia = !!commentAttachmentFile || !!commentGifUrl;
  submitBtn.disabled = !(hasContent || hasMedia);
}

function renderCommentMediaPreview() {
  const preview = document.getElementById('commentAttachmentPreview');
  if (!preview) return;

  const src = commentAttachmentFile ? URL.createObjectURL(commentAttachmentFile) : commentGifUrl;

  if (!src) {
    preview.innerHTML = '';
    return;
  }

  preview.innerHTML = `
    <div class="position-relative d-inline-block">
      <img src="${src}" alt="Comment attachment">
      <button type="button" class="remove-comment-media-btn" title="Remove">
        <i class="fas fa-times"></i>
      </button>
    </div>`;

  preview.querySelector('.remove-comment-media-btn').addEventListener('click', () => {
    clearCommentMediaPreview();
  });
}

function clearCommentMediaPreview() {
  commentAttachmentFile = null;
  commentGifUrl = null;
  const preview = document.getElementById('commentAttachmentPreview');
  if (preview) preview.innerHTML = '';
  const input = document.getElementById('commentAttachmentInput');
  if (input) input.value = '';
  updateCommentSubmitState();
}

async function searchCommentGifs(query) {
  const container = document.getElementById('commentGifResults');
  if (!container) return;
  container.innerHTML = '<div class="gif-grid-empty">Searching...</div>';

  try {
    const res = await fetch(`/giphy/search?q=${encodeURIComponent(query)}`);
    const gifs = await res.json();
    container.innerHTML = '';

    if (!Array.isArray(gifs) || !gifs.length) {
      container.innerHTML = '<div class="gif-grid-empty">No GIFs found.</div>';
      return;
    }

    gifs.forEach((gif) => {
      const previewUrl = gif?.images?.fixed_height_small?.url || gif?.images?.original?.url;
      const fullUrl = gif?.images?.original?.url || previewUrl;
      if (!previewUrl) return;

      const img = document.createElement('img');
      img.src = previewUrl;
      img.loading = 'lazy';
      img.alt = 'GIF';

      img.addEventListener('click', () => {
        commentGifUrl = fullUrl;
        commentAttachmentFile = null;
        renderCommentMediaPreview();
        updateCommentSubmitState();

        // Close panel
        document.getElementById('commentGifPanel')?.classList.remove('open');
        document.getElementById('commentGifSearchInput').value = '';
        container.innerHTML = '';

        // Clear file input
        const fileInput = document.getElementById('commentAttachmentInput');
        if (fileInput) fileInput.value = '';
      });

      container.appendChild(img);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="gif-grid-empty">Failed to load GIFs.</div>';
  }
}

//  Build comment thread
function appendCommentToDOM(comment, postId, allComments) {
  if (comment.parent_comment_id) return;

  const container = document.getElementById('commentsContainer');

  const group = document.createElement('div');
  group.className = 'comment-group';
  container.appendChild(group);

  const el = buildCommentEl(comment, postId, false);
  group.appendChild(el);

  const replies = sortCommentsForDisplay(
    allComments.filter((r) => parseInt(r.parent_comment_id) === parseInt(comment.id)),
    currentCommentSort,
    allComments,
  );

  if (replies.length === 0) return;

  // replies wrapper
  const repliesWrapper = document.createElement('div');
  repliesWrapper.className = 'replies-wrapper';

  // open for reply from PandaBot
  const hasBotReply = replies.some((r) => r.author_name?.toLowerCase() === 'pandabot');
  const wasOpen = openReplyThreads.has(parseInt(comment.id)) || hasBotReply;
  repliesWrapper.style.display = wasOpen ? 'block' : 'none';

  replies.forEach((reply) => {
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
function buildCommentEl(comment, postId, isReply = false, rootParentId = null) {
  const { timeStr } = formatTimestamp(comment.created_at, null);

  const initial = comment.author_name
    ? comment.author_name.charAt(0).toUpperCase()
    : comment.user_id
      ? String(comment.user_id).charAt(0)
      : 'U';
  const authorDisplay = comment.author_name || `User ${comment.user_id}`;
  const isPandabot = comment.author_name?.toLowerCase() === 'pandabot';

  const loggedInUserId = parseInt(localStorage.getItem('loggedInUserId'));
  const isLoggedIn = !!localStorage.getItem('token');
  const isOwner = isLoggedIn && parseInt(comment.user_id) === loggedInUserId;

  const menuOptions = `
    ${
      isLoggedIn
        ? `
    <li>
      <button class="dropdown-item save-comment-btn"
        data-comment-id="${comment.id}"
        data-saved="false"
        data-save-row-id="">
        <i class="far fa-bookmark me-2"></i>Save
      </button>
    </li>
    <li><hr class="dropdown-divider"></li>`
        : ''
    }
    <li>
      <button class="dropdown-item report-comment-btn">
        <i class="fas fa-flag me-2"></i>Report
      </button>
    </li>
    ${
      isOwner
        ? `
      <li>
        <button class="dropdown-item edit-comment-btn">
          <i class="fas fa-pen me-2"></i>Edit
        </button>
      </li>
      <li>
        <button class="dropdown-item text-danger delete-comment-btn">
          <i class="fas fa-trash-alt me-2"></i>Delete
        </button>
      </li>`
        : ''
    }`;

  const el = document.createElement('div');
  el.className =
    (isReply ? 'comment-item comment-reply' : 'comment-item') +
    (isPandabot ? ' pandabot-comment' : '');
  el.dataset.commentId = comment.id;

  el.innerHTML = `
    <div class="d-flex">
      <div class="comment-avatar${isPandabot ? ' pandabot-avatar' : ''}">
        ${isPandabot ? '🐼' : initial}
      </div>
      <div class="flex-grow-1">
        <div class="comment-content">
          <div class="d-flex align-items-start justify-content-between">
            <div class="comment-author${isPandabot ? ' pandabot-name' : ''}">
            ${escapeHtml(authorDisplay)}
            ${isPandabot ? `<span class="bot-badge ms-1">Generated by PandaBot</span>` : ''}
          </div>
            <div class="dropdown ms-2">
              <button class="btn btn-sm p-0 px-1 comment-menu-btn"
                data-bs-toggle="dropdown" style="line-height:1;">
                <i class="fas fa-ellipsis-h"
                  style="font-size:0.8rem;color:var(--text-secondary);"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">${menuOptions}</ul>
            </div>
          </div>
          <div class="comment-text-display">${linkifyPandaBotMentions(escapeHtml(comment.content))}</div>
          ${
            comment.attachment_url
              ? `
          <div class="comment-attachment mt-1">
            <img
              src="${comment.attachment_url}"
              alt="Comment attachment"
              class="img-fluid rounded"
              style="max-height:200px; max-width:100%; object-fit:cover; cursor:pointer;"
              onclick="window.open('${comment.attachment_url}', '_blank')"
            >
          </div>`
              : ''
          }
          <div class="comment-edit-form" style="display:none;">
            <textarea class="form-control form-control-sm comment-edit-input"
              rows="2">${escapeHtml(comment.content)}</textarea>

            <div class="comment-edit-attachment-preview"></div>

            <div class="d-flex align-items-center gap-2 mt-2">
              <label class="btn btn-outline-secondary btn-sm mb-0" title="Attach image">
                <i class="fas fa-paperclip"></i>
                <input type="file" class="comment-edit-attachment-input" accept="image/*,.gif" style="display:none;">
              </label>
              <button type="button" class="btn btn-outline-secondary btn-sm comment-edit-gif-btn">
                <i class="fas fa-images me-1"></i>GIF
              </button>
            </div>
            <div class="comment-edit-gif-panel" style="display:none;">
              <input type="text" class="form-control form-control-sm mt-2 comment-edit-gif-search" placeholder="Search GIFs...">
              <div class="gif-grid comment-edit-gif-results mt-2"></div>
            </div>

            <div class="mt-2 d-flex gap-2">
              <button class="btn btn-sm btn-outline-secondary cancel-edit-comment-btn">Cancel</button>
              <button class="btn btn-sm btn-primary save-edit-comment-btn">Save</button>
            </div>
          </div>
          <div class="comment-actions">
            <button class="comment-like-btn" data-comment-id="${comment.id}">
              <i class="far fa-thumbs-up"></i>
              <span class="comment-like-count">0</span>
            </button>
            <button class="comment-dislike-btn" data-comment-id="${comment.id}">
              <i class="far fa-thumbs-down"></i>
              <span class="comment-dislike-count">0</span>
            </button>
            <button class="comment-action-link reply-btn" data-comment-id="${comment.id}" data-author="${escapeHtml(authorDisplay)}">Reply</button>
            <span class="comment-timestamp">${timeStr}</span>
          </div>
        </div>
      </div>
    </div>`;

  el.querySelector('.comment-menu-btn').addEventListener('click', (e) => e.stopPropagation());

  el.querySelector('.report-comment-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!localStorage.getItem('token')) {
      showLoginRequiredModal();
      return;
    }
    openReportModal(comment.id, 'comment');
  });

  const replyBtn = el.querySelector('.reply-btn');
  if (replyBtn) {
    replyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleReplyBox(el, comment, postId, rootParentId);
    });
  }

  // Save comment
  const saveCommentBtn = el.querySelector('.save-comment-btn');
  if (saveCommentBtn) {
    const savedRowId = savedCommentMap.get(parseInt(comment.id));
    if (savedRowId) {
      saveCommentBtn.dataset.saved = 'true';
      saveCommentBtn.dataset.saveRowId = savedRowId;
      saveCommentBtn.innerHTML = `<i class="fas fa-bookmark me-2"></i>Unsave`;
    }
    saveCommentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const token = localStorage.getItem('token');
      const user_id = localStorage.getItem('loggedInUserId');
      const commentId = saveCommentBtn.dataset.commentId;
      const isSaved = saveCommentBtn.dataset.saved === 'true';
      const saveRowId = saveCommentBtn.dataset.saveRowId;

      if (isSaved) {
        fetchMethod(
          `${feedApiBase()}/comments/saved/${saveRowId}`,
          (status) => {
            if (status === 200) {
              saveCommentBtn.dataset.saved = 'false';
              saveCommentBtn.dataset.saveRowId = '';
              saveCommentBtn.innerHTML = `<i class="far fa-bookmark me-2"></i>Save`;
            } else {
              alert('Failed to unsave comment.');
            }
          },
          'DELETE',
          null,
          token,
        );
      } else {
        fetchMethod(
          `${feedApiBase()}/comments/saved`,
          (status, data) => {
            if (status === 201) {
              saveCommentBtn.dataset.saved = 'true';
              saveCommentBtn.dataset.saveRowId = data.id;
              saveCommentBtn.innerHTML = `<i class="fas fa-bookmark me-2"></i>Unsave`;
            } else if (status === 409) {
              saveCommentBtn.dataset.saved = 'true';
              saveCommentBtn.innerHTML = `<i class="fas fa-bookmark me-2"></i>Unsave`;
            } else {
              alert('Failed to save comment.');
            }
          },
          'POST',
          { user_id, comment_id: commentId },
          token,
        );
      }
    });
  }

  if (isOwner) {
    setupCommentEditAttachment(el, comment);

    el.querySelector('.edit-comment-btn').addEventListener('click', () =>
      enterEditMode(el, comment),
    );

    el.querySelector('.delete-comment-btn').addEventListener('click', () => {
      showConfirm('Delete comment?', 'This will permanently remove your comment.', () =>
        deleteComment(comment.id, el, postId),
      );
    });

    el.querySelector('.cancel-edit-comment-btn').addEventListener('click', () => exitEditMode(el));
    el.querySelector('.save-edit-comment-btn').addEventListener('click', () =>
      saveCommentEdit(comment.id, el, postId),
    );
  }

  // Comment reactions
  const likeBtn = el.querySelector('.comment-like-btn');
  const dislikeBtn = el.querySelector('.comment-dislike-btn');

  const existingReaction = commentReactions.get(parseInt(comment.id));
  if (existingReaction) {
    applyCommentReactionUI(likeBtn, dislikeBtn, existingReaction.reaction_type);
  }

  likeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleCommentReaction(comment.id, 'like', likeBtn, dislikeBtn);
  });

  dislikeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleCommentReaction(comment.id, 'dislike', likeBtn, dislikeBtn);
  });

  return el;
}

// comment replies
function toggleReplyBox(commentEl, comment, postId, rootParentId) {
  const existing = commentEl.querySelector('.reply-input-box');
  if (existing) {
    existing.remove();
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    showLoginRequiredModal();
    return;
  }

  const parentCommentId = rootParentId || comment.id;
  const replyingToName = comment.author_name || 'User';

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
    </div>
    <div class="reply-attachment-preview mt-2"></div>
    <div class="d-flex align-items-center gap-2 mt-2">
      <label class="btn btn-outline-secondary btn-sm mb-0" title="Attach image">
        <i class="fas fa-paperclip"></i>
        <input type="file" class="reply-attachment-input" accept="image/*,.gif" style="display:none;">
      </label>
      <button type="button" class="btn btn-outline-secondary btn-sm reply-gif-btn">
        <i class="fas fa-images me-1"></i>GIF
      </button>
    </div>
    <div class="reply-gif-panel" style="display:none;">
      <input type="text" class="form-control form-control-sm mt-2 reply-gif-search" placeholder="Search GIFs...">
      <div class="gif-grid reply-gif-results mt-2"></div>
    </div>`;

  const actionsEl = commentEl.querySelector('.comment-actions');
  actionsEl.after(replyBox);

  const textarea = replyBox.querySelector('textarea');
  textarea.value = `@${replyingToName} `;
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  replyBox.querySelector('.cancel-reply-btn').addEventListener('click', () => replyBox.remove());

  // Attachment/GIF picker
  const replyFileInput = replyBox.querySelector('.reply-attachment-input');
  const replyGifBtn = replyBox.querySelector('.reply-gif-btn');
  const replyGifPanel = replyBox.querySelector('.reply-gif-panel');
  const replyGifSearchInput = replyBox.querySelector('.reply-gif-search');
  const replyGifResults = replyBox.querySelector('.reply-gif-results');
  const replyAttachmentPreview = replyBox.querySelector('.reply-attachment-preview');

  function renderReplyAttachmentPreview() {
    const src = replyBox._attachmentFile
      ? URL.createObjectURL(replyBox._attachmentFile)
      : replyBox._gifUrl;
    if (!src) {
      replyAttachmentPreview.innerHTML = '';
      return;
    }
    replyAttachmentPreview.innerHTML = `
      <div class="position-relative d-inline-block">
        <img src="${src}" alt="Attachment" style="max-height:150px; max-width:100%; border-radius:8px;">
        <button type="button" class="remove-reply-attachment-btn" title="Remove"
          style="position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:50%; border:none; background:rgba(0,0,0,0.6); color:#fff; line-height:1;">
          <i class="fas fa-times" style="font-size:0.65rem;"></i>
        </button>
      </div>`;
    replyAttachmentPreview
      .querySelector('.remove-reply-attachment-btn')
      .addEventListener('click', () => {
        replyBox._attachmentFile = null;
        replyBox._gifUrl = null;
        if (replyFileInput) replyFileInput.value = '';
        renderReplyAttachmentPreview();
      });
  }

  if (replyFileInput) {
    replyFileInput.addEventListener('change', () => {
      const file = replyFileInput.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        alert('File too large. Max 8MB.');
        replyFileInput.value = '';
        return;
      }
      replyBox._attachmentFile = file;
      replyBox._gifUrl = null;
      renderReplyAttachmentPreview();
    });
  }

  if (replyGifBtn && replyGifPanel) {
    replyGifBtn.addEventListener('click', () => {
      replyGifPanel.style.display = replyGifPanel.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (replyGifSearchInput) {
    let debounce;
    replyGifSearchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      const query = replyGifSearchInput.value.trim();
      if (!query) {
        replyGifResults.innerHTML = '';
        return;
      }
      debounce = setTimeout(() => {
        replyGifResults.innerHTML = '<div class="gif-grid-empty">Searching...</div>';
        fetch(`/giphy/search?q=${encodeURIComponent(query)}`)
          .then((res) => res.json())
          .then((gifs) => {
            replyGifResults.innerHTML = '';
            if (!Array.isArray(gifs) || !gifs.length) {
              replyGifResults.innerHTML = '<div class="gif-grid-empty">No GIFs found.</div>';
              return;
            }
            gifs.forEach((gif) => {
              const previewUrl = gif?.images?.fixed_height_small?.url || gif?.images?.original?.url;
              const fullUrl = gif?.images?.original?.url || previewUrl;
              if (!previewUrl) return;

              const img = document.createElement('img');
              img.src = previewUrl;
              img.loading = 'lazy';
              img.alt = 'GIF';
              img.addEventListener('click', () => {
                replyBox._gifUrl = fullUrl;
                replyBox._attachmentFile = null;
                renderReplyAttachmentPreview();
                replyGifPanel.style.display = 'none';
                replyGifSearchInput.value = '';
                replyGifResults.innerHTML = '';
                if (replyFileInput) replyFileInput.value = '';
              });
              replyGifResults.appendChild(img);
            });
          })
          .catch((err) => {
            console.error(err);
            replyGifResults.innerHTML = '<div class="gif-grid-empty">Failed to load GIFs.</div>';
          });
      }, 300);
    });
  }

  replyBox.querySelector('.submit-reply-btn').addEventListener('click', () => {
    const rawContent = textarea.value.trim();
    if (!rawContent && !replyBox._attachmentFile && !replyBox._gifUrl) return;

    const mention = `@${replyingToName} `;
    const content = rawContent
      ? rawContent.startsWith('@')
        ? rawContent
        : mention + rawContent
      : mention.trim();

    const submitBtn = replyBox.querySelector('.submit-reply-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    openReplyThreads.add(parseInt(parentCommentId));

    const existingBotReplyIds = new Set(
      (activeCommentsData || [])
        .filter(
          (c) =>
            c.author_name?.toLowerCase() === 'pandabot' &&
            parseInt(c.parent_comment_id) === parseInt(parentCommentId),
        )
        .map((c) => parseInt(c.id)),
    );

    const formData = new FormData();
    formData.append('content', content);
    formData.append('parent_comment_id', parentCommentId);
    if (replyBox._attachmentFile) {
      formData.append('attachment', replyBox._attachmentFile);
    } else if (replyBox._gifUrl) {
      formData.append('attachment_url', replyBox._gifUrl);
    }

    fetch(`${COMMENTS_BASE}/${postId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
      .then(async (res) => {
        const data = await res.json();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reply';

        if (res.status === 201 || res.status === 200) {
          replyBox.remove();
          loadComments(postId);

          // PandaBot mentioned
          const mentionedBot =
            /\@pandabot/i.test(content || '') || comment.author_name?.toLowerCase() === 'pandabot';

          if (mentionedBot) {
            let attempts = 0;
            const poll = setInterval(() => {
              attempts++;
              fetchMethod(
                `${COMMENTS_BASE}/${postId}`,
                (s, d) => {
                  if (s !== 200) return;
                  const allComments = Array.isArray(d) ? d : d.rows || [];
                  const botReplied = allComments.some(
                    (c) =>
                      c.author_name?.toLowerCase() === 'pandabot' &&
                      parseInt(c.parent_comment_id) === parseInt(parentCommentId) &&
                      !existingBotReplyIds.has(parseInt(c.id)),
                  );
                  if (botReplied || attempts >= 15) {
                    clearInterval(poll);
                    if (botReplied) loadComments(postId);
                  }
                },
                'GET',
                null,
                token,
              );
            }, 1000);
          }
        } else {
          alert(data.message || 'Failed to post reply.');
        }
      })
      .catch((err) => {
        console.error(err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reply';
        alert('Failed to post reply.');
      });
  });
}

// Attach file/GIF picker
function setupCommentEditAttachment(el, comment) {
  const fileInput = el.querySelector('.comment-edit-attachment-input');
  const gifBtn = el.querySelector('.comment-edit-gif-btn');
  const gifPanel = el.querySelector('.comment-edit-gif-panel');
  const gifSearchInput = el.querySelector('.comment-edit-gif-search');
  const gifResults = el.querySelector('.comment-edit-gif-results');

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        alert('File too large. Max 8MB.');
        fileInput.value = '';
        return;
      }
      el._editAttachmentFile = file;
      el._editGifUrl = null;
      el._editRemoveAttachment = false;
      renderCommentEditAttachmentPreview(el);
    });
  }

  if (gifBtn && gifPanel) {
    gifBtn.addEventListener('click', () => {
      gifPanel.style.display = gifPanel.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (gifSearchInput) {
    let debounce;
    gifSearchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      const query = gifSearchInput.value.trim();
      if (!query) {
        gifResults.innerHTML = '';
        return;
      }
      debounce = setTimeout(
        () => searchCommentEditGifs(query, el, gifResults, gifPanel, gifSearchInput),
        300,
      );
    });
  }
}

function searchCommentEditGifs(query, el, container, gifPanel, gifSearchInput) {
  container.innerHTML = '<div class="gif-grid-empty">Searching...</div>';

  fetch(`/giphy/search?q=${encodeURIComponent(query)}`)
    .then((res) => res.json())
    .then((gifs) => {
      container.innerHTML = '';
      if (!Array.isArray(gifs) || !gifs.length) {
        container.innerHTML = '<div class="gif-grid-empty">No GIFs found.</div>';
        return;
      }
      gifs.forEach((gif) => {
        const previewUrl = gif?.images?.fixed_height_small?.url || gif?.images?.original?.url;
        const fullUrl = gif?.images?.original?.url || previewUrl;
        if (!previewUrl) return;

        const img = document.createElement('img');
        img.src = previewUrl;
        img.loading = 'lazy';
        img.alt = 'GIF';
        img.addEventListener('click', () => {
          el._editGifUrl = fullUrl;
          el._editAttachmentFile = null;
          el._editRemoveAttachment = false;
          renderCommentEditAttachmentPreview(el);
          gifPanel.style.display = 'none';
          gifSearchInput.value = '';
          container.innerHTML = '';
          const fileInput = el.querySelector('.comment-edit-attachment-input');
          if (fileInput) fileInput.value = '';
        });
        container.appendChild(img);
      });
    })
    .catch((err) => {
      console.error(err);
      container.innerHTML = '<div class="gif-grid-empty">Failed to load GIFs.</div>';
    });
}

function renderCommentEditAttachmentPreview(el) {
  const preview = el.querySelector('.comment-edit-attachment-preview');
  if (!preview) return;

  let src = null;
  if (el._editAttachmentFile) {
    src = URL.createObjectURL(el._editAttachmentFile);
  } else if (el._editGifUrl) {
    src = el._editGifUrl;
  } else if (!el._editRemoveAttachment && el._editOriginalAttachmentUrl) {
    src = el._editOriginalAttachmentUrl;
  }

  if (!src) {
    preview.innerHTML = '';
    return;
  }

  preview.innerHTML = `
    <div class="position-relative d-inline-block mt-2">
      <img src="${src}" alt="Attachment" style="max-height:150px; max-width:100%; border-radius:8px;">
      <button type="button" class="remove-comment-edit-attachment-btn" title="Remove"
        style="position:absolute; top:4px; right:4px; width:22px; height:22px; border-radius:50%; border:none; background:rgba(0,0,0,0.6); color:#fff; line-height:1;">
        <i class="fas fa-times" style="font-size:0.65rem;"></i>
      </button>
    </div>`;

  preview.querySelector('.remove-comment-edit-attachment-btn').addEventListener('click', () => {
    el._editAttachmentFile = null;
    el._editGifUrl = null;
    el._editRemoveAttachment = true;
    const fileInput = el.querySelector('.comment-edit-attachment-input');
    if (fileInput) fileInput.value = '';
    renderCommentEditAttachmentPreview(el);
  });
}

// Enter edit mode for comment
function enterEditMode(commentEl, comment) {
  commentEl._editOriginalAttachmentUrl = comment.attachment_url || null;
  commentEl._editAttachmentFile = null;
  commentEl._editGifUrl = null;
  commentEl._editRemoveAttachment = false;
  renderCommentEditAttachmentPreview(commentEl);

  commentEl.querySelector('.comment-text-display').style.display = 'none';
  commentEl.querySelector('.comment-edit-form').style.display = 'block';
  commentEl.querySelector('.comment-actions').style.display = 'none';

  const staticAttachment = commentEl.querySelector('.comment-attachment');
  if (staticAttachment) staticAttachment.style.display = 'none';

  commentEl.querySelector('.comment-edit-input').focus();
}

// Exit edit mode for comment
function exitEditMode(commentEl) {
  commentEl.querySelector('.comment-text-display').style.display = 'block';
  commentEl.querySelector('.comment-edit-form').style.display = 'none';
  commentEl.querySelector('.comment-actions').style.display = 'flex';

  const staticAttachment = commentEl.querySelector('.comment-attachment');
  if (staticAttachment) staticAttachment.style.display = 'block';
}

// Save edited comment - PUT /comments/:id
function saveCommentEdit(commentId, commentEl, postId) {
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

  const formData = new FormData();
  formData.append('content', newContent);

  if (commentEl._editAttachmentFile) {
    formData.append('attachment', commentEl._editAttachmentFile);
  } else if (commentEl._editGifUrl) {
    formData.append('attachment_url', commentEl._editGifUrl);
  } else if (commentEl._editRemoveAttachment) {
    formData.append('remove_attachment', 'true');
  } else if (commentEl._editOriginalAttachmentUrl) {
    formData.append('attachment_url', commentEl._editOriginalAttachmentUrl);
  }

  fetch(`${currentUrl}/comments/${commentId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
    .then(async (res) => {
      const data = await res.json();
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';

      if (res.ok) {
        loadComments(postId);
      } else {
        alert(data.message || 'Failed to update comment.');
      }
    })
    .catch((err) => {
      console.error(err);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      alert('Failed to update comment.');
    });
}

//  Delete comment
function deleteComment(commentId, commentEl, postId) {
  const token = localStorage.getItem('token');

  fetchMethod(
    `${currentUrl}/comments/${commentId}`,
    (status, data) => {
      if (status === 200) {
        loadComments(postId);
      } else {
        alert('Failed to delete comment. Please try again.');
      }
    },
    'DELETE',
    null,
    token,
  );
}

function showNoComments() {
  document.getElementById('commentsContainer').innerHTML = `
    <div class="text-muted text-center py-3" id="commentsPlaceholder">
      <i class="fas fa-comments fa-2x mb-2 d-block"></i>
      No comments yet. Be the first to comment!
    </div>`;
}

// ==========================
// COMMENT REACTIONS
// ==========================
function handleCommentReaction(commentId, newType, likeBtn, dislikeBtn) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  if (!token) {
    showLoginRequiredModal();
    return;
  }

  const existing = commentReactions.get(parseInt(commentId));

  if (!existing) {
    // post
    fetchMethod(
      `${feedApiBase()}/comments/like`,
      (status, data) => {
        if (status === 201) {
          commentReactions.set(parseInt(commentId), { id: data.id, reaction_type: newType });
          applyCommentReactionUI(likeBtn, dislikeBtn, newType);
          updateCommentReactionCount(likeBtn, dislikeBtn, null, newType);
        }
      },
      'POST',
      { comment_id: parseInt(commentId), user_id: userId, reaction_type: newType },
      token,
    );
  } else if (existing.reaction_type === newType) {
    // delete
    fetchMethod(
      `${feedApiBase()}/comments/reaction/${existing.id}`,
      (status) => {
        if (status === 200) {
          updateCommentReactionCount(likeBtn, dislikeBtn, existing.reaction_type, null);
          commentReactions.delete(parseInt(commentId));
          applyCommentReactionUI(likeBtn, dislikeBtn, null);
        }
      },
      'DELETE',
      { user_id: userId },
      token,
    );
  } else {
    // put
    fetchMethod(
      `${feedApiBase()}/comments/reaction/${existing.id}`,
      (status) => {
        if (status === 200) {
          updateCommentReactionCount(likeBtn, dislikeBtn, existing.reaction_type, newType);
          commentReactions.set(parseInt(commentId), { ...existing, reaction_type: newType });
          applyCommentReactionUI(likeBtn, dislikeBtn, newType);
        }
      },
      'PUT',
      { user_id: userId, reaction_type: newType },
      token,
    );
  }
}

function applyCommentReactionUI(likeBtn, dislikeBtn, reactionType) {
  // Reset both
  likeBtn.classList.remove('active');
  dislikeBtn.classList.remove('active');
  likeBtn.querySelector('i').className = 'far fa-thumbs-up';
  dislikeBtn.querySelector('i').className = 'far fa-thumbs-down';

  if (reactionType === 'like') {
    likeBtn.classList.add('active');
    likeBtn.querySelector('i').className = 'fas fa-thumbs-up';
  } else if (reactionType === 'dislike') {
    dislikeBtn.classList.add('active');
    dislikeBtn.querySelector('i').className = 'fas fa-thumbs-down';
  }
}

function updateCommentReactionCount(likeBtn, dislikeBtn, oldType, newType) {
  const likeCountEl = likeBtn.querySelector('.comment-like-count');
  const dislikeCountEl = dislikeBtn.querySelector('.comment-dislike-count');

  let likes = parseInt(likeCountEl.textContent) || 0;
  let dislikes = parseInt(dislikeCountEl.textContent) || 0;

  if (oldType === 'like') likes = Math.max(0, likes - 1);
  if (oldType === 'dislike') dislikes = Math.max(0, dislikes - 1);
  if (newType === 'like') likes++;
  if (newType === 'dislike') dislikes++;

  likeCountEl.textContent = likes;
  dislikeCountEl.textContent = dislikes;
}

// SEARCHBAR
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

function getCategoryLabel(c) {
  return (
    {
      confession: 'Confession',
      qna: 'Q&A',
      general: 'General Talk',
      events: 'Events',
      news: 'News',
      cca: 'CCA',
      internship: 'Internship',
      SOC: 'SOC',
      ABE: 'ABE',
      SB: 'SB',
      CLS: 'CLS',
      EEE: 'EEE',
      MAD: 'MAD',
      MAE: 'MAE',
      SMA: 'SMA',
    }[c] || c
  );
}

function getCategoryClass(c) {
  return (
    {
      confession: 'category-confession',
      qna: 'category-qna',
      general: 'category-general',
      events: 'category-events',
      news: 'category-news',
      cca: 'category-cca',
      internship: 'category-internship',
      SOC: 'category-SOC',
      ABE: 'category-ABE',
      SB: 'category-SB',
      CLS: 'category-CLS',
      EEE: 'category-EEE',
      MAD: 'category-MAD',
      MAE: 'category-MAE',
      SMA: 'category-SMA',
    }[c] || 'category-general'
  );
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

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function linkifyPandaBotMentions(escapedText) {
  return escapedText.replace(
    /@pandabot/gi,
    (match) =>
      `<span class="pandabot-mention" data-tooltip="Need help? Summon @pandabot ʕ•ﻌ•ʔ for help, ideas, explanations, and more!">${match}</span>`,
  );
}

function renderPostAttachment(post) {
  const mediaUrl = post.gif_url || post.giphy_url || post.attachment_url;
  if (!mediaUrl) return '';

  const fileUrl = mediaUrl.toLowerCase();

  // image extensions
  const isImage =
    fileUrl.endsWith('.png') ||
    fileUrl.endsWith('.jpg') ||
    fileUrl.endsWith('.jpeg') ||
    fileUrl.endsWith('.gif') ||
    fileUrl.endsWith('.webp');

  // video extensions
  const isVideo = fileUrl.endsWith('.mp4') || fileUrl.endsWith('.webm') || fileUrl.endsWith('.mov');

  if (isImage) {
    return `
      <div class="post-attachment mt-3">
        <img
          src="${mediaUrl}"
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
          <source src="${mediaUrl}">
        </video>
      </div>
    `;
  }

  return `
    <div class="post-attachment mt-3">
      <a
        href="${mediaUrl}"
        target="_blank"
        class="btn btn-outline-secondary btn-sm"
      >
        <i class="fas fa-paperclip me-2"></i>
        Open attachment
      </a>
    </div>
  `;
}

function renderCurrentAttachmentBlock(post) {
  const hasAttachment = !!(post.attachment_url || post.gif_url || post.giphy_url);
  if (!hasAttachment) return renderEditAttachmentPreview(post);

  return `
    <div class="position-relative d-inline-block">
      <button
        type="button"
        class="btn btn-sm btn-dark rounded-circle position-absolute top-0 end-0 p-1"
        style="width:24px; height:24px; line-height:1; z-index:2;"
        id="removeCurrentAttachmentBtn"
        aria-label="Remove attachment"
        title="Remove attachment"
      >
        <i class="fas fa-times" style="font-size:0.7rem;"></i>
      </button>
      ${renderEditAttachmentPreview(post)}
    </div>
  `;
}

function setupRemoveAttachmentButton(post) {
  const btn = document.getElementById('removeCurrentAttachmentBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    removeCurrentAttachment = true;
    pendingEditGifUrl = null;

    const attachmentInput = document.getElementById('editAttachment');
    if (attachmentInput) attachmentInput.value = '';
    renderEditGifPreview();

    const preview = document.getElementById('currentAttachmentPreview');
    if (preview) {
      preview.innerHTML = `<div class="text-muted small">No attachment uploaded</div>`;
    }

    autoSaveAttachmentChange(post);
  });
}

function renderEditAttachmentPreview(post) {
  const mediaUrl = post.gif_url || post.giphy_url || post.attachment_url;
  if (!mediaUrl) {
    return `
      <div class="text-muted small">
        No attachment uploaded
      </div>
    `;
  }

  const fileUrl = mediaUrl.toLowerCase();

  const isImage =
    fileUrl.endsWith('.png') ||
    fileUrl.endsWith('.jpg') ||
    fileUrl.endsWith('.jpeg') ||
    fileUrl.endsWith('.gif') ||
    fileUrl.endsWith('.webp');

  const isVideo = fileUrl.endsWith('.mp4') || fileUrl.endsWith('.webm') || fileUrl.endsWith('.mov');

  if (isImage) {
    return `
      <img
        src="${mediaUrl}"
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
        <source src="${mediaUrl}">
      </video>
    `;
  }

  return `
    <a
      href="${mediaUrl}"
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
  fetchMethod(
    `${REACTIONS_BASE}/reaction/${userId}`,
    (status, data) => {
      if (status !== 200 || !Array.isArray(data)) return;

      const existingReaction = data.find((r) => parseInt(r.post_id) === parseInt(postId));

      if (existingReaction) {
        currentReaction = {
          id: existingReaction.id,
          reaction_type: existingReaction.reaction_type,
        };

        updateReactionUI(existingReaction.reaction_type);
      }
    },
    'GET',
    null,
    token,
  );
}

function handleReaction(postId, newReactionType) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  if (!token) {
    showLoginRequiredModal();
    return;
  }

  if (!currentReaction) {
    fetchMethod(
      `${REACTIONS_BASE}/like`,
      (status, data) => {
        if (status === 201) {
          currentReaction = {
            id: data.id,
            reaction_type: newReactionType,
          };
          updateReactionUI(newReactionType);
          updateReactionCounts(null, newReactionType);
        }
      },
      'POST',
      {
        post_id: postId,
        user_id: userId,
        reaction_type: newReactionType,
      },
      token,
    );
    return;
  }

  //remove reaction
  if (currentReaction.reaction_type === newReactionType) {
    fetchMethod(
      `${REACTIONS_BASE}/reaction/${currentReaction.id}`,
      (status) => {
        if (status === 200) {
          updateReactionCounts(currentReaction.reaction_type, null);
          currentReaction = null;
          updateReactionUI(null);
        }
      },
      'DELETE',
      {
        user_id: userId,
      },
      token,
    );
    return;
  }

  // change reaction
  fetchMethod(
    `${REACTIONS_BASE}/reaction/${currentReaction.id}`,
    (status, data) => {
      if (status === 200) {
        updateReactionCounts(currentReaction.reaction_type, newReactionType);
        currentReaction.reaction_type = newReactionType;
        updateReactionUI(newReactionType);
      }
    },
    'PUT',
    {
      user_id: userId,
      reaction_type: newReactionType,
    },
    token,
  );
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

  fetchMethod(
    `${currentUrl}/groups/joined_groups`,
    (status, data) => {
      if (status === 200 && Array.isArray(data) && data.length > 0) {
        // Reveal the container sections setup in posts.html
        document.getElementById('yourGroupsDivider').style.display = 'block';
        document.getElementById('yourGroupsSection').style.display = 'block';

        const container = document.getElementById('yourGroupsContainer');
        container.innerHTML = '';

        data.forEach((group) => {
          const groupEl = document.createElement('a');
          groupEl.href = `group-details.html?id=${group.id}`;
          groupEl.className =
            'sidebar-item px-3 py-2 d-flex align-items-center text-decoration-none';
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
      qna: 'bg-primary',
      general: 'bg-secondary',
    };

    data.forEach((related) => {
      const item = document.createElement('a');
      item.href = `posts.html?id=${related.id}`;
      item.className = 'list-group-item list-group-item-action';

      const badgeClass = categoryBadgeClass[related.category] || 'bg-secondary';
      const label = getCategoryLabel(related.category);
      const authorText = related.is_anonymous ? 'Anonymous' : related.author_name || 'User';
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
        `${feedApiBase()}/posts/${postId}/report`,
        (status, data) => {
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
