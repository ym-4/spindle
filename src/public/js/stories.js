/* ============================= STORIES PAGE ============================= */

var loggedUserId = null;
var allStories = [];
var viewerQueue = [];
var currentViewerIndex = -1;
var viewTimer = null;
var viewProgress = 0;
var isPaused = false;
var VIEW_DURATION = 5000;

function esc(t) {
  var d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function getLoggedUserId() {
  if (loggedUserId) return loggedUserId;
  try {
    var u = getStoredUser();
    if (u && u.id) {
      loggedUserId = u.id;
      return u.id;
    }
  } catch {}
  var id = localStorage.getItem('loggedInUserId');
  if (id) {
    loggedUserId = parseInt(id);
    return loggedUserId;
  }
  return null;
}

function storyTimeAgo(created) {
  var diff = Date.now() - new Date(created).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  return days + 'd ago';
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map(function (p) {
      return p[0];
    })
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getUserData() {
  try {
    return getStoredUser();
  } catch {
    return null;
  }
}

function hasUnseenStories(stories) {
  return stories.some(function (s) {
    return !isSeen(s);
  });
}

/* ========================= LOAD & RENDER =============================== */

async function loadStories() {
  var loadingEl = document.getElementById('loadingState');
  var emptyEl = document.getElementById('emptyState');
  var listSection = document.getElementById('listSection');
  var ringsRow = document.getElementById('ringsRow');

  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  listSection.classList.add('hidden');

  try {
    var data = await authFetch('/stories');
    allStories = data.stories || [];
  } catch {
    allStories = [];
  }

  var uid = getLoggedUserId();
  var myStories = allStories.filter(function (s) {
    return parseInt(s.user_id) === uid;
  });
  var friendStories = allStories.filter(function (s) {
    return parseInt(s.user_id) !== uid;
  });

  renderRingsRow(myStories, friendStories, ringsRow);
  bindRingClicks();

  loadingEl.classList.add('hidden');

  if (allStories.length === 0) {
    emptyEl.classList.remove('hidden');
    listSection.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  listSection.classList.remove('hidden');
  renderList();
}

function renderRingsRow(myStories, friendStories, container) {
  var uid = getLoggedUserId();
  var u = getUserData();

  // Own avatar — prefer story data (fresh DB), fallback to cached user
  var ownAvatarUrl = null;
  var ownName = 'Me';
  if (myStories.length > 0) {
    ownAvatarUrl = myStories[0].profile_image || myStories[0].avatar;
    ownName = myStories[0].display_name || myStories[0].name;
  }
  if (!ownAvatarUrl) {
    ownAvatarUrl = u ? u.profile_image || u.avatar : null;
    ownName = u ? u.display_name || u.name : 'Me';
  }
  var ownInitial = initials(ownName);
  var ownUnseen = myStories.length > 0 && hasUnseenStories(myStories);
  var ownRingClass = ownUnseen ? 'story-ring' : 'story-ring seen';

  var html = '';

  // Own ring — always first
  html += '<div class="story-ring-wrap story-ring-mine" role="listitem">';
  html += '<div class="' + ownRingClass + '" tabindex="0" id="ownRingBtn" aria-label="My status">';
  html += '<div class="story-ring-inner">';
  html += '<span class="story-ring-avatar">';
  if (ownAvatarUrl) {
    html += '<img src="' + mediaUrl(ownAvatarUrl) + '" alt="' + esc(ownName) + '" />';
  } else {
    html += esc(ownInitial);
  }
  html += '</span>';
  html += '</div></div>';
  html += '<span class="story-ring-label">My status</span></div>';

  // Friend rings — one per author, grouped by latest story
  var authorMap = {};
  friendStories.forEach(function (s) {
    var aid = s.user_id;
    if (!authorMap[aid] || new Date(s.created_at) > new Date(authorMap[aid].created_at)) {
      authorMap[aid] = s;
    }
  });

  var authorList = Object.keys(authorMap).map(function (k) {
    return authorMap[k];
  });
  authorList.sort(function (a, b) {
    return new Date(b.created_at) - new Date(a.created_at);
  });

  authorList.forEach(function (s) {
    var avatarSrc = s.profile_image || s.avatar;
    var avatarHtml = avatarSrc
      ? '<img src="' + mediaUrl(avatarSrc) + '" alt="' + esc(s.display_name || s.name) + '" />'
      : esc(initials(s.display_name || s.name));
    var authorAllStories = allStories.filter(function (x) {
      return parseInt(x.user_id) === parseInt(s.user_id);
    });
    var unseen = hasUnseenStories(authorAllStories);
    var ringClass = unseen ? 'story-ring' : 'story-ring seen';
    html +=
      '<div class="story-ring-wrap story-ring-item" data-author-id="' +
      s.user_id +
      '" role="listitem">';
    html += '<div class="' + ringClass + '" tabindex="0">';
    html += '<div class="story-ring-inner">';
    html += '<span class="story-ring-avatar">' + avatarHtml + '</span>';
    html += '</div></div>';
    html +=
      '<span class="story-ring-label">' + esc(s.display_name || s.name || 'User') + '</span></div>';
  });

  container.innerHTML = html;
}

function bindRingClicks() {
  // Own ring — context-aware
  document.getElementById('ownRingBtn')?.addEventListener('click', function () {
    var uid = getLoggedUserId();
    var myStories = allStories.filter(function (s) {
      return parseInt(s.user_id) === uid;
    });
    if (myStories.length === 0) {
      // No active story → open composer
      var composer = document.getElementById('composerCard');
      if (composer) {
        composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () {
          document.getElementById('captionInput').focus();
        }, 300);
      }
    } else {
      // Has active story → open viewer from own stories, continuous through friends
      openContinuousViewer(uid);
    }
  });

  // Friend rings open viewer
  document
    .getElementById('ringsRow')
    .querySelectorAll('.story-ring-item')
    .forEach(function (el) {
      el.addEventListener('click', function () {
        var authorId = parseInt(el.dataset.authorId);
        openContinuousViewer(authorId);
      });
    });
}

function renderList() {
  var list = document.getElementById('storiesList');
  var uid = getLoggedUserId();

  var grouped = [];
  var seenAuthors = {};

  allStories.forEach(function (s) {
    var aid = s.user_id;
    if (!seenAuthors[aid]) {
      seenAuthors[aid] = true;
      var authorStories = allStories.filter(function (x) {
        return parseInt(x.user_id) === parseInt(aid);
      });
      authorStories.sort(function (a, b) {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      grouped.push({
        user_id: aid,
        display_name: s.display_name || s.name,
        name: s.name,
        profile_image: s.profile_image,
        avatar: s.avatar,
        stories: authorStories,
      });
    }
  });

  grouped.sort(function (a, b) {
    var aIsOwn = parseInt(a.user_id) === uid ? 0 : 1;
    var bIsOwn = parseInt(b.user_id) === uid ? 0 : 1;
    if (aIsOwn !== bIsOwn) return aIsOwn - bIsOwn;
    return new Date(b.stories[0].created_at) - new Date(a.stories[0].created_at);
  });

  list.innerHTML = grouped
    .map(function (g) {
      var latest = g.stories[0];
      var avatarSrc = g.profile_image || g.avatar;
      var avatarHtml = avatarSrc
        ? '<img src="' + mediaUrl(avatarSrc) + '" alt="' + esc(g.display_name || g.name) + '" />'
        : esc(initials(g.display_name || g.name));
      var unseen = hasUnseenStories(g.stories);
      var listRingClass = unseen ? 'stories-list-ring' : 'stories-list-ring seen';
      return (
        '<div class="stories-list-item" data-author-id="' +
        g.user_id +
        '">' +
        '<div class="' +
        listRingClass +
        '"><div class="stories-list-ring-inner">' +
        '<span class="stories-list-avatar">' +
        avatarHtml +
        '</span>' +
        '</div></div>' +
        '<div class="stories-list-info">' +
        '<div class="stories-list-name">' +
        esc(g.display_name || g.name) +
        '</div>' +
        '<div class="stories-list-meta">' +
        '<span>' +
        storyTimeAgo(latest.created_at) +
        '</span>' +
        (latest.privacy === 'friends'
          ? '<span> · <i class="fas fa-lock" style="font-size:0.6rem;"></i> Friends</span>'
          : '') +
        '</div>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  list.querySelectorAll('.stories-list-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var authorId = parseInt(item.dataset.authorId);
      openContinuousViewer(authorId);
    });
  });
}

function isSeen(story) {
  var viewed = JSON.parse(localStorage.getItem('viewedStories') || '{}');
  return !!viewed[story.id];
}

function markSeen(storyId) {
  var viewed = JSON.parse(localStorage.getItem('viewedStories') || '{}');
  viewed[storyId] = true;
  localStorage.setItem('viewedStories', JSON.stringify(viewed));
}

/* ========================= COMPOSER ==================================== */

document.getElementById('cameraBtn')?.addEventListener('click', function () {
  document.getElementById('storyFile').click();
});

document.getElementById('storyFile')?.addEventListener('change', function () {
  var file = this.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById('previewImg').src = e.target.result;
    document.getElementById('previewWrap').classList.remove('hidden');
    checkSendReady();
  };
  reader.readAsDataURL(file);
});

document.getElementById('previewRemove')?.addEventListener('click', function () {
  clearComposer();
});

document.getElementById('captionInput')?.addEventListener('input', function () {
  checkSendReady();
});

document.getElementById('descInput')?.addEventListener('input', function () {
  checkSendReady();
});

function checkSendReady() {
  var hasFile = document.getElementById('storyFile').files.length > 0;
  var hasText = document.getElementById('captionInput').value.trim().length > 0;
  var hasDesc = document.getElementById('descInput').value.trim().length > 0;
  var ready = hasFile || hasText || hasDesc;
  var btn = document.getElementById('sendBtn');
  var draftBtn = document.getElementById('saveDraftBtn');
  if (ready) {
    btn.classList.add('active');
    btn.disabled = false;
    draftBtn.disabled = false;
  } else {
    btn.classList.remove('active');
    btn.disabled = true;
    draftBtn.disabled = true;
  }
}

function clearComposer() {
  document.getElementById('storyFile').value = '';
  document.getElementById('captionInput').value = '';
  document.getElementById('descInput').value = '';
  document.getElementById('descWrap').classList.add('hidden');
  document.getElementById('addDescBtn').classList.remove('hidden');
  document.getElementById('previewWrap').classList.add('hidden');
  document.getElementById('sendBtn').classList.remove('active');
  document.getElementById('sendBtn').disabled = true;
  document.getElementById('saveDraftBtn').disabled = true;
}

document.getElementById('privToggle')?.addEventListener('click', function () {
  var btn = this;
  var isFriends = btn.classList.contains('friends');
  if (isFriends) {
    btn.classList.remove('friends');
    btn.dataset.privacy = 'public';
    btn.innerHTML = '<i class="fas fa-globe-asia"></i>';
    btn.title = 'Visible to everyone';
  } else {
    btn.classList.add('friends');
    btn.dataset.privacy = 'friends';
    btn.innerHTML = '<i class="fas fa-lock"></i>';
    btn.title = 'Visible to friends only';
  }
});

document.getElementById('addDescBtn')?.addEventListener('click', function () {
  document.getElementById('descWrap').classList.remove('hidden');
  this.classList.add('hidden');
  document.getElementById('descInput').focus();
});

var rotators = [
  'Share a moment from your day',
  "What's on your mind today?",
  "How's your day going?",
  'Got something to share?',
  'Capture the moment...',
  'Thinking about something?',
  'A photo says a thousand words',
  'What made you smile today?',
];
var rotatorIdx = 0;
setInterval(function () {
  var el = document.getElementById('rotatorText');
  if (!el) return;
  rotatorIdx = (rotatorIdx + 1) % rotators.length;
  el.textContent = rotators[rotatorIdx];
}, 5000);

document.getElementById('sendBtn')?.addEventListener('click', async function () {
  var btn = this;
  if (btn.disabled) return;
  btn.disabled = true;

  var file = document.getElementById('storyFile').files?.[0];
  var caption = document.getElementById('captionInput').value.trim();
  var description = document.getElementById('descInput').value.trim();
  var privacy = document.getElementById('privToggle').dataset.privacy || 'public';

  if (!file && !caption) {
    btn.disabled = false;
    return;
  }

  var fd = new FormData();
  if (file) {
    fd.append('media', file);
    fd.append('type', 'image');
  } else {
    fd.append('type', 'text');
    fd.append('background', '#1a1a2e');
  }
  fd.append('caption', caption);
  fd.append('description', description);
  fd.append('privacy', privacy);

  try {
    var res = await fetch(API_BASE + '/stories', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + getToken() },
      body: fd,
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      alert(data.error || 'Failed to post status.');
      btn.disabled = false;
      return;
    }
    clearComposer();
    await loadStories();
  } catch {
    alert('Network error posting status.');
    btn.disabled = false;
  }
});

/* ========================= DRAFTS ====================================== */

document.getElementById('saveDraftBtn')?.addEventListener('click', async function () {
  var btn = this;
  if (btn.disabled) return;
  btn.disabled = true;

  var file = document.getElementById('storyFile').files?.[0];
  var caption = document.getElementById('captionInput').value.trim();
  var description = document.getElementById('descInput').value.trim();

  if (!file && !caption) {
    btn.disabled = false;
    return;
  }

  var fd = new FormData();
  if (file) {
    fd.append('media', file);
    fd.append('type', 'image');
  }
  fd.append('caption', caption);
  fd.append('description', description);

  try {
    var res = await fetch(API_BASE + '/stories/draft', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + getToken() },
      body: fd,
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      alert(data.error || 'Failed to save draft.');
      btn.disabled = false;
      return;
    }
    clearComposer();
    loadDrafts();
  } catch {
    alert('Network error saving draft.');
    btn.disabled = false;
  }
});

async function loadDrafts() {
  var section = document.getElementById('draftsSection');
  var list = document.getElementById('draftsList');
  try {
    var data = await authFetch('/stories/drafts');
    var drafts = data.drafts || [];
    if (drafts.length === 0) {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');
    list.innerHTML = drafts
      .map(function (d) {
        var preview = d.caption || d.description || 'Untitled draft';
        if (preview.length > 50) preview = preview.slice(0, 50) + '...';
        var typeIcon =
          d.story_type === 'image' ? '<i class="fas fa-image"></i>' : '<i class="fas fa-font"></i>';
        return (
          '<div class="stories-draft-item" data-id="' +
          d.id +
          '">' +
          '<div class="stories-draft-info">' +
          '<div class="stories-draft-preview">' +
          typeIcon +
          ' ' +
          esc(preview) +
          '</div>' +
          '<div class="stories-draft-time">Saved ' +
          storyTimeAgo(d.created_at) +
          '</div>' +
          '</div>' +
          '<div class="stories-draft-actions">' +
          '<button class="stories-draft-resume" data-id="' +
          d.id +
          '" title="Resume editing"><i class="fas fa-edit"></i></button>' +
          '<button class="stories-draft-publish" data-id="' +
          d.id +
          '" title="Publish now"><i class="fas fa-arrow-up"></i></button>' +
          '<button class="stories-draft-discard" data-id="' +
          d.id +
          '" title="Discard draft"><i class="fas fa-trash"></i></button>' +
          '</div>' +
          '</div>'
        );
      })
      .join('');
    list.querySelectorAll('.stories-draft-resume').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        resumeDraft(parseInt(btn.dataset.id));
      });
    });
    list.querySelectorAll('.stories-draft-publish').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        publishDraft(parseInt(btn.dataset.id));
      });
    });
    list.querySelectorAll('.stories-draft-discard').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        discardDraft(parseInt(btn.dataset.id));
      });
    });
  } catch {
    section.classList.add('hidden');
  }
}

async function resumeDraft(draftId) {
  try {
    var data = await authFetch('/stories/drafts');
    var drafts = data.drafts || [];
    var draft = drafts.find(function (d) {
      return d.id === draftId;
    });
    if (!draft) return;
    document.getElementById('captionInput').value = draft.caption || '';
    document.getElementById('descInput').value = draft.description || '';
    if (draft.description) {
      document.getElementById('descWrap').classList.remove('hidden');
      document.getElementById('addDescBtn').classList.add('hidden');
    }
    document.getElementById('composerCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('captionInput').focus();
    checkSendReady();
  } catch {}
}

async function publishDraft(draftId) {
  try {
    var res = await authFetch('/stories/draft/' + draftId + '/publish', { method: 'POST' });
    if (res.story) {
      loadDrafts();
      await loadStories();
    }
  } catch {}
}

async function discardDraft(draftId) {
  if (!confirm('Discard this draft?')) return;
  try {
    await authFetch('/stories/draft/' + draftId, { method: 'DELETE' });
    loadDrafts();
  } catch {}
}

/* Get current story's index within its author's story sequence */
function getLocalStoryIndex() {
  var story = viewerQueue[currentViewerIndex];
  if (!story) return { localIndex: 0, totalCount: 0 };
  var authorId = parseInt(story.user_id);
  var localIdx = 0,
    total = 0;
  for (var i = 0; i < viewerQueue.length; i++) {
    if (parseInt(viewerQueue[i].user_id) === authorId) {
      if (i < currentViewerIndex) localIdx++;
      total++;
    }
  }
  return { localIndex: localIdx, totalCount: total };
}

/* Build progress bars for the current author's story sequence */
function buildProgressBars() {
  var pos = getLocalStoryIndex();
  var row = document.getElementById('progressRow');
  var html = '';
  for (var i = 0; i < pos.totalCount; i++) {
    var fill = i < pos.localIndex ? 100 : i === pos.localIndex ? 0 : 0;
    html +=
      '<div class="stories-progress-bar"><div class="stories-progress-fill" data-seg="' +
      i +
      '" style="width:' +
      fill +
      '%"></div></div>';
  }
  row.innerHTML = html;
}

/* ========================= CONTINUOUS VIEWER =========================== */

function openContinuousViewer(targetAuthorId) {
  var uid = getLoggedUserId();
  if (!uid) return;

  // Build a flat queue of ALL stories, continuous across authors
  // Target author first, then others sorted by latest story time
  var authorGroups = {};
  allStories.forEach(function (s) {
    var aid = s.user_id;
    if (!authorGroups[aid]) authorGroups[aid] = [];
    authorGroups[aid].push(s);
  });

  // Sort each author's stories chronologically (oldest first)
  Object.keys(authorGroups).forEach(function (aid) {
    authorGroups[aid].sort(function (a, b) {
      return new Date(a.created_at) - new Date(b.created_at);
    });
  });

  // Order authors: target first, then others by latest story time desc
  var authorIds = Object.keys(authorGroups);
  var orderedIds = [String(targetAuthorId)];
  authorIds.forEach(function (aid) {
    if (aid !== String(targetAuthorId)) orderedIds.push(aid);
  });
  orderedIds.sort(function (a, b) {
    if (a === String(targetAuthorId)) return -1;
    if (b === String(targetAuthorId)) return 1;
    var aLatest = authorGroups[a][authorGroups[a].length - 1].created_at;
    var bLatest = authorGroups[b][authorGroups[b].length - 1].created_at;
    return new Date(bLatest) - new Date(aLatest);
  });

  viewerQueue = [];
  orderedIds.forEach(function (aid) {
    viewerQueue = viewerQueue.concat(authorGroups[aid]);
  });

  // Find start index: first story by target author
  currentViewerIndex = -1;
  for (var i = 0; i < viewerQueue.length; i++) {
    if (parseInt(viewerQueue[i].user_id) === targetAuthorId) {
      currentViewerIndex = i;
      break;
    }
  }

  if (currentViewerIndex === -1) return;
  showCurrentViewerStory();
}

function showCurrentViewerStory() {
  if (currentViewerIndex >= viewerQueue.length) {
    closeViewer();
    return;
  }

  var story = viewerQueue[currentViewerIndex];
  var overlay = document.getElementById('viewerOverlay');
  var viewer = document.getElementById('viewerContent');
  var mediaEl = document.getElementById('viewerMedia');
  var textStatus = document.getElementById('viewerTextStatus');
  var textCaption = document.getElementById('viewerTextCaption');
  var textBg = document.getElementById('viewerTextBg');
  var captionEl = document.getElementById('viewerCaption');
  var footer = document.getElementById('viewerFooter');
  var nameEl = document.getElementById('viewerName');
  var timeEl = document.getElementById('viewerTime');
  var avatarEl = document.getElementById('viewerAvatar');
  var deleteBtn = document.getElementById('viewerDelete');
  var addWrap = document.getElementById('viewerAddWrap');

  buildProgressBars();

  nameEl.textContent = story.display_name || story.name;
  timeEl.textContent = storyTimeAgo(story.created_at);

  var avatarSrc = story.profile_image || story.avatar;
  avatarEl.innerHTML = avatarSrc
    ? '<img src="' +
      mediaUrl(avatarSrc) +
      '" alt="' +
      esc(story.display_name || story.name) +
      '" />'
    : esc(initials(story.display_name || story.name));

  if (story.story_type === 'text') {
    mediaEl.classList.add('hidden');
    textStatus.classList.remove('hidden');
    textCaption.textContent = story.caption || '';
    textBg.style.background = story.background || '#1a1a2e';
  } else {
    textStatus.classList.add('hidden');
    mediaEl.classList.remove('hidden');
    mediaEl.src = mediaUrl(story.media_url);
    mediaEl.alt = story.caption || 'Story image';
  }

  if (story.caption) {
    captionEl.textContent = story.caption;
    footer.classList.remove('hidden');
  } else {
    footer.classList.add('hidden');
  }

  var uid = getLoggedUserId();
  if (uid && parseInt(story.user_id) === uid) {
    deleteBtn.classList.remove('hidden');
    deleteBtn._storyId = story.id;
    deleteBtn._queueIndex = currentViewerIndex;
    addWrap.classList.remove('hidden');
  } else {
    deleteBtn.classList.add('hidden');
    addWrap.classList.add('hidden');
  }

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  markSeen(story.id);
  startViewTimer(story.id);
}

function startViewTimer(storyId) {
  clearInterval(viewTimer);
  viewProgress = 0;
  isPaused = false;
  var start = Date.now();

  recordView(storyId);

  viewTimer = setInterval(function () {
    if (isPaused) {
      start = Date.now();
      return;
    }
    var elapsed = Date.now() - start;
    viewProgress = Math.min((elapsed / VIEW_DURATION) * 100, 100);
    var fills = document.querySelectorAll('.stories-progress-fill');
    var pos = getLocalStoryIndex();
    fills.forEach(function (f, idx) {
      if (idx < pos.localIndex) f.style.width = '100%';
      else if (idx === pos.localIndex) f.style.width = viewProgress + '%';
      else f.style.width = '0%';
    });
    if (viewProgress >= 100) {
      clearInterval(viewTimer);
      currentViewerIndex++;
      showCurrentViewerStory();
    }
  }, 50);
}

function recordView(storyId) {
  authFetch('/stories/' + storyId + '/view', { method: 'POST' }).catch(function () {});
}

function closeViewer() {
  clearInterval(viewTimer);
  document.getElementById('viewerOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  currentViewerIndex = -1;
  viewerQueue = [];
}

/* ========================= VIEWER CONTROLS ============================= */

document.getElementById('viewerDelete')?.addEventListener('click', async function () {
  var storyId = this._storyId;
  if (!storyId) return;
  if (!confirm('Delete this status update permanently?')) return;
  try {
    await authFetch('/stories/' + storyId, { method: 'DELETE' });
    // Remove from viewerQueue and adjust index
    var idx = viewerQueue.findIndex(function (s) {
      return s.id === storyId;
    });
    if (idx !== -1) viewerQueue.splice(idx, 1);
    if (currentViewerIndex >= viewerQueue.length) currentViewerIndex = viewerQueue.length - 1;
    if (viewerQueue.length === 0) {
      closeViewer();
      await loadStories();
      return;
    }
    showCurrentViewerStory();
    await loadStories();
  } catch (err) {
    alert(err.message || 'Failed to delete.');
  }
});

// "Add another" — closes viewer and opens composer
document.getElementById('viewerAddBtn')?.addEventListener('click', function () {
  closeViewer();
  var composer = document.getElementById('composerCard');
  if (composer) {
    composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () {
      document.getElementById('captionInput').focus();
    }, 300);
  }
});

document.getElementById('tapNext')?.addEventListener('click', function (e) {
  e.stopPropagation();
  var hasMore = currentViewerIndex + 1 < viewerQueue.length;
  if (hasMore) {
    clearInterval(viewTimer);
    currentViewerIndex++;
    showCurrentViewerStory();
  } else {
    closeViewer();
  }
});

document.getElementById('tapPrev')?.addEventListener('click', function (e) {
  e.stopPropagation();
  if (currentViewerIndex > 0) {
    clearInterval(viewTimer);
    currentViewerIndex--;
    showCurrentViewerStory();
  }
});

document.getElementById('viewerBody')?.addEventListener('mousedown', function () {
  isPaused = true;
});
document.getElementById('viewerBody')?.addEventListener('mouseup', function () {
  isPaused = false;
});
document.getElementById('viewerBody')?.addEventListener('touchstart', function () {
  isPaused = true;
});
document.getElementById('viewerBody')?.addEventListener('touchend', function () {
  isPaused = false;
});

document.getElementById('viewerClose')?.addEventListener('click', closeViewer);

document.getElementById('viewerOverlay')?.addEventListener('click', function (e) {
  if (e.target === this) closeViewer();
});

document.addEventListener('keydown', function (e) {
  var overlay = document.getElementById('viewerOverlay');
  if (overlay.classList.contains('hidden')) return;
  if (e.key === 'Escape') {
    closeViewer();
    return;
  }
  if (e.key === 'ArrowRight') {
    clearInterval(viewTimer);
    currentViewerIndex++;
    showCurrentViewerStory();
    return;
  }
  if (e.key === 'ArrowLeft') {
    if (currentViewerIndex > 0) {
      clearInterval(viewTimer);
      currentViewerIndex--;
      showCurrentViewerStory();
    }
    return;
  }
});

/* ========================= INIT ======================================== */

document.addEventListener('DOMContentLoaded', async function () {
  if (!isLoggedIn()) {
    redirectToLogin('stories.html');
    return;
  }
  refreshNotifBadge();
  // Refresh cached user profile so avatar is always up-to-date
  try {
    var me = await authFetch('/auth/me');
    if (me && me.id && typeof setAuth === 'function' && getToken()) {
      setAuth(me, getToken());
    }
  } catch {
    /* use cached data */
  }
  loadStories();
  loadDrafts();
});
