/* global fetchMethod, currentUrl, API_BASE, getApiBase */

//  Spindle — Saved Posts Page
//  GET /posts/saved/:user_id  → display saved posts
//  DELETE /posts/saved/:id    → unsave

function savedApiBase() {
  if (typeof currentUrl !== 'undefined' && currentUrl) return currentUrl;
  if (typeof getApiBase === 'function') {
    const base = getApiBase();
    if (base) return base;
  }
  return window.location.origin || '';
}
let savedRows = [];

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  loadYourGroups();
  loadHotPosts();
  setupSavedTabs();
  if (typeof setupSearchDropdown === 'function') setupSearchDropdown();

  if (!token || !userId) {
    showLoginPrompt();
    return;
  }

  loadSavedPosts(userId, token);
});

// Confirmation modal
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

//  Load saved posts
function loadSavedPosts(userId, token) {
  const container = document.getElementById('savedContainer');
  container.innerHTML = `
    <div class="post-card text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      Loading saved posts...
    </div>`;

  fetchMethod(`${savedApiBase()}/posts/saved/${userId}`, (status, data) => {
    if (status !== 200 || !Array.isArray(data) || data.length === 0) {
      showEmpty();
      return;
    }

    savedRows = data;

    fetchMethod(
      `${savedApiBase()}/posts`,
      (pStatus, posts) => {
        if (pStatus !== 200) {
          showError();
          return;
        }

        const savedPostIdSet = new Set(data.map((r) => parseInt(r.post_id)));
        const savedPosts = posts.filter((p) => savedPostIdSet.has(parseInt(p.id)));

        if (savedPosts.length === 0) {
          showEmpty();
          return;
        }

        container.innerHTML = '';
        savedPosts.forEach((post) => {
          const saveRow = savedRows.find((r) => parseInt(r.post_id) === parseInt(post.id));
          container.appendChild(buildSavedPostCard(post, saveRow));
        });
      },
      'GET',
      null,
      token,
    );
  });
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
            <button class="dropdown-item unsave-btn">
              <i class="fas fa-bookmark me-2"></i>Unsave post
            </button>
          </li>
          <li>
            <button class="dropdown-item report-post-btn">
              <i class="fas fa-flag me-2"></i>Report
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="d-flex gap-1 align-items-center flex-wrap">
      <span class="post-category ${getCategoryClass(post.category)}">${getCategoryLabel(post.category)}</span>
      ${post.visibility === 'friends_only' ? '<span class="badge bg-warning text-dark" style="font-size:0.65rem;"><i class="fas fa-user-friends me-1"></i>Friends</span>' : ''}
      ${post.pinned ? '<span class="badge bg-info text-dark" style="font-size:0.65rem;"><i class="fas fa-thumbtack me-1"></i>Pinned</span>' : ''}
    </div>
    <div class="post-content">${DOMPurify.sanitize(post.content)}</div>

    ${
      post.gif_url || post.giphy_url || post.attachment_url
        ? (() => {
            const mediaUrl = post.gif_url || post.giphy_url || post.attachment_url;
            const isRelative = mediaUrl.startsWith('/');
            const src = isRelative ? `${currentUrl}${mediaUrl}` : mediaUrl;
            const isVideo = /\.(mp4|webm|mov)$/i.test(mediaUrl);
            return `
              <div class="post-attachment mt-2">
                ${
                  isVideo
                    ? `<video controls class="img-fluid rounded post-video"><source src="${src}"></video>`
                    : `<img src="${src}" alt="Post attachment" class="img-fluid rounded post-image">`
                }
              </div>`;
          })()
        : ''
    }

    ${post.poll_id ? renderPollCard(post, post.id) : ''}
    <div class="post-tags" id="postTags-${post.id}"></div>

    <div class="post-actions">
        <button class="post-action-btn like-btn" data-post-id="${post.id}">
          <i class="far fa-thumbs-up"></i> <span class="like-count">${post.like_count ?? '0'}</span>
        </button>
        <button class="post-action-btn dislike-btn" data-post-id="${post.id}">
          <i class="far fa-thumbs-down"></i> <span class="dislike-count">${post.dislike_count ?? '0'}</span>
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

  const likeBtn = card.querySelector('.like-btn');
  const dislikeBtn = card.querySelector('.dislike-btn');

  initReactionButtons(post.id, likeBtn, dislikeBtn);
  setupReactionEvents(post.id, likeBtn, dislikeBtn);

  card.querySelector('.post-menu-btn').addEventListener('click', (e) => e.stopPropagation());

  // Report
  card.querySelector('.report-post-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) {
      showLoginPrompt();
      return;
    }
    openReportModal(post.id);
  });

  // Share
  card.querySelector('.share-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openShareDropdown(e.currentTarget, post.id);
  });

  // unsave
  card.querySelector('.unsave-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showConfirm('Unsave post?', 'This post will be removed from your saved posts.', () =>
      unsavePost(saveRow.id, card),
    );
  });

  // Load poll
  if (post.poll_id) {
    loadAndRenderPoll(post.id, card);
  }
  // Load tags
  loadPostTags(post.id, card);

  return card;
}

function renderPollCard(post, postId) {
  return `<div class="poll-container" id="pollContainer-${postId}">
    <div class="text-muted small text-center py-2">
      <div class="spinner-border spinner-border-sm" role="status"></div>
    </div>
  </div>`;
}

function loadAndRenderPoll(postId, cardEl) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  fetchMethod(`${savedApiBase()}/posts/${postId}/poll`, (status, poll) => {
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
              `${savedApiBase()}/posts/${postId}/poll/vote/${userId}`,
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
              `${savedApiBase()}/posts/${postId}/poll/vote`,
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
              `${savedApiBase()}/posts/${postId}/poll/vote`,
              (ds) => {
                if (ds === 200) {
                  fetchMethod(
                    `${savedApiBase()}/posts/${postId}/poll/vote`,
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
            `${savedApiBase()}/posts/${postId}/poll/vote`,
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
  fetchMethod(`${savedApiBase()}/posts/${postId}/tags`, (status, tags) => {
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

//  DELETE /posts/saved/:id
function unsavePost(saveRowId, cardEl) {
  const token = localStorage.getItem('token');

  fetchMethod(
    `${savedApiBase()}/posts/saved/${saveRowId}`,
    (status) => {
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
    },
    'DELETE',
    null,
    token,
  );
}

function setupSavedTabs() {
  const postsTab = document.getElementById('savedPostsTab');
  const commentsTab = document.getElementById('savedCommentsTab');
  const postsPanel = document.getElementById('savedPostsPanel');
  const commentsPanel = document.getElementById('savedCommentsPanel');

  postsTab.addEventListener('click', (e) => {
    e.preventDefault();
    postsTab.classList.add('active');
    commentsTab.classList.remove('active');
    postsPanel.style.display = 'block';
    commentsPanel.style.display = 'none';
  });

  commentsTab.addEventListener('click', (e) => {
    e.preventDefault();
    commentsTab.classList.add('active');
    postsTab.classList.remove('active');
    commentsPanel.style.display = 'block';
    postsPanel.style.display = 'none';

    if (!commentsPanel.dataset.loaded) {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('loggedInUserId');
      loadSavedComments(userId, token);
      commentsPanel.dataset.loaded = 'true';
    }
  });
}

function loadSavedComments(userId, token) {
  const container = document.getElementById('savedCommentsContainer');
  container.innerHTML = `
    <div class="post-card text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      Loading saved comments...
    </div>`;

  fetchMethod(
    `${savedApiBase()}/comments/saved/${userId}`,
    (status, data) => {
      container.innerHTML = '';

      if (status !== 200 || !Array.isArray(data) || data.length === 0) {
        container.innerHTML = `
        <div class="post-card text-center py-4 text-muted">
          <i class="fas fa-comment-slash fa-2x mb-2 d-block"></i>
          No saved comments yet.
        </div>`;
        return;
      }

      data.forEach((item) => container.appendChild(buildSavedCommentCard(item, token)));
    },
    'GET',
    null,
    token,
  );
}

function buildSavedCommentCard(item, token) {
  const el = document.createElement('div');
  el.className = 'post-card';

  const { timeStr } = formatTimestamp(item.created_at, null);
  const initial = item.author_name ? item.author_name.charAt(0).toUpperCase() : 'U';

  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">${initial}</div>
      <div class="post-author">
        <div class="post-author-name">${escapeHtml(item.author_name || 'User')}</div>
        <div class="post-timestamp">${timeStr}</div>
      </div>
      <div class="dropdown">
        <button class="btn btn-sm post-menu-btn" data-bs-toggle="dropdown">
          <i class="fas fa-ellipsis-h"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li>
            <button class="dropdown-item text-danger unsave-comment-btn"
              data-save-id="${item.save_id}">
              <i class="fas fa-bookmark me-2"></i>Unsave
            </button>
          </li>
           <li>
            <button class="dropdown-item report-comment-btn">
              <i class="fas fa-flag me-2"></i>Report
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="text-muted small mb-2">
      Commented on post: <strong>${escapeHtml(item.post_title)}</strong>
    </div>

    <div class="post-content"
      style="background:var(--hover-bg); border-radius:8px; padding:0.75rem; font-size:0.95rem;">
      ${escapeHtml(item.content)}
    </div>
  `;

  el.addEventListener('click', (e) => {
    if (e.target.closest('.dropdown')) return;
    window.location.href = `posts.html?id=${item.post_id}`;
  });

  el.querySelector('.post-menu-btn').addEventListener('click', (e) => e.stopPropagation());

  // Unsave
  el.querySelector('.unsave-comment-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const saveId = e.currentTarget.dataset.saveId;

    fetchMethod(
      `${savedApiBase()}/comments/saved/${saveId}`,
      (status) => {
        if (status === 200) {
          el.style.transition = 'opacity 0.2s';
          el.style.opacity = '0';
          setTimeout(() => {
            el.remove();
            const remaining = document.querySelectorAll(
              '#savedCommentsContainer .post-card',
            ).length;
            if (remaining === 0) {
              document.getElementById('savedCommentsContainer').innerHTML = `
              <div class="post-card text-center py-4 text-muted">
                <i class="fas fa-comment-slash fa-2x mb-2 d-block"></i>
                No saved comments yet.
              </div>`;
            }
          }, 200);
        } else {
          alert('Failed to unsave comment.');
        }
      },
      'DELETE',
      null,
      token,
    );
  });

  // Report
  el.querySelector('.report-comment-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) {
      showLoginPrompt();
      return;
    }
    openReportModal(item.comment_id, 'comment');
  });

  return el;
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
  else if (diffDays === 1)
    timeStr = `Yesterday at ${created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  else if (diffDays < 7) timeStr = `${diffDays} days ago`;
  else
    timeStr = created.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

  const wasEditedResult = wasEdited;
  return { timeStr, wasEdited: wasEditedResult };
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Your Groups
function loadYourGroups() {
  const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('token');
  const section = document.getElementById('yourGroupsSection');
  const divider = document.getElementById('yourGroupsDivider');

  if (!token) {
    if (section) section.style.display = 'none';
    if (divider) divider.style.display = 'none';
    return;
  }

  if (section) section.style.setProperty('display', 'block', 'important');
  if (divider) divider.style.setProperty('display', 'block', 'important');

  fetchMethod(
    `${savedApiBase()}/groups/joined_groups`,
    (status, data) => {
      if (status === 401) {
        console.warn('Unauthorized access to joined groups from saved page.');
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
  seeAll.innerHTML = `<i class="fas fa-plus-circle"></i><span>See all groups</span>`;
  container.appendChild(seeAll);
}

// Hot Posts
function loadHotPosts() {
  fetchMethod(`${savedApiBase()}/posts`, (status, data) => {
    const container = document.getElementById('top5Container');
    if (!container) return;

    if (status !== 200 || !data.length) {
      container.innerHTML = `
        <div class="list-group-item text-muted small text-center py-3">
          No posts yet.
        </div>`;
      return;
    }

    const top3 = data
      .slice()
      .sort((a, b) => b.like_count - a.like_count || b.comment_count - a.comment_count)
      .slice(0, 3);

    container.innerHTML = '';

    top3.forEach((post, index) => {
      const item = document.createElement('a');
      item.href = `posts.html?id=${post.id}`;
      item.className = 'list-group-item list-group-item-action py-2';
      item.innerHTML = `
        <div class="text-muted mb-1" style="font-size:0.75rem;">Trending #${index + 1}</div>
        <div class="fw-bold" style="font-size:0.9rem;">${escapeHtml(post.title)}</div>
      `;
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
function openReportModal(id, type = 'post') {
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

  const label = type === 'comment' ? 'comment' : 'post';
  const endpoint =
    type === 'comment'
      ? `${savedApiBase()}/comments/${id}/report`
      : `${savedApiBase()}/posts/${id}/report`;

  const overlay = document.createElement('div');
  overlay.className = 'report-modal-overlay';
  overlay.id = 'reportModalOverlay';

  overlay.innerHTML = `
    <div class="report-modal-card">
      <h5>Report ${label}</h5>
      <p class="report-modal-sub">Why are you reporting this ${label}?</p>

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

      <div id="reportDescriptionStep" style="display:none;">
        <textarea id="reportDescriptionInput" class="form-control form-control-sm" rows="3" placeholder="Tell us more..."></textarea>
        <div class="report-modal-actions mt-2">
          <button class="btn btn-outline-secondary btn-sm" id="reportBackBtn">Back</button>
          <button class="btn btn-primary btn-sm" id="reportSubmitDescBtn">Submit</button>
        </div>
      </div>

      <div id="reportThanks" style="display:none; text-align:center; padding:1rem 0;"></div>

      <div class="report-modal-actions" id="reportMainActions">
        <button class="btn btn-outline-secondary btn-sm" id="reportCancelBtn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const reasonsContainer = overlay.querySelector('#reportReasonsContainer');
  const descStep = overlay.querySelector('#reportDescriptionStep');
  const thanksEl = overlay.querySelector('#reportThanks');
  const cancelBtn = overlay.querySelector('#reportCancelBtn');

  function submitReport(reason, description) {
    const token = localStorage.getItem('token');
    const user_id = localStorage.getItem('loggedInUserId');

    fetchMethod(
      endpoint,
      (status) => {
        reasonsContainer.style.display = 'none';
        descStep.style.display = 'none';
        cancelBtn.textContent = 'Close';

        if (status === 409) {
          thanksEl.innerHTML = `
            <i class="fas fa-info-circle fa-2x mb-2 d-block" style="color:var(--primary-color);"></i>
            <div class="fw-bold">Already reported</div>
            <div class="text-muted small mt-1">You've already submitted a report for this ${label}.</div>
          `;
        } else {
          thanksEl.innerHTML = `
            <i class="fas fa-check-circle fa-2x mb-2 d-block" style="color:var(--secondary-color);"></i>
            <div class="fw-bold">Thanks for your report</div>
            <div class="text-muted small mt-1">We'll review this ${label} and take action if needed.</div>
          `;
        }

        thanksEl.style.display = 'block';
        setTimeout(() => closeReportModal(), 2500);
      },
      'POST',
      { user_id, reason, description },
      token,
    );
  }

  overlay.querySelectorAll('.report-reason-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.reason === 'Other') {
        reasonsContainer.style.display = 'none';
        descStep.style.display = 'block';
        overlay.querySelector('#reportDescriptionInput').value = '';
      } else {
        submitReport(btn.dataset.reason, '');
      }
    });
  });

  overlay.querySelector('#reportSubmitDescBtn').addEventListener('click', () => {
    const description = overlay.querySelector('#reportDescriptionInput').value.trim();
    submitReport('Other', description);
  });

  overlay.querySelector('#reportBackBtn').addEventListener('click', () => {
    descStep.style.display = 'none';
    reasonsContainer.style.display = '';
  });

  cancelBtn.addEventListener('click', closeReportModal);
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
