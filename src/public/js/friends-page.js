var currentTab = 'online';
var pendingSubTab = 'received';
var searchTimer = null;
var allFriendsData = [];

function esc(t) {
  var d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function avatarHtml(u, size) {
  size = size || 44;
  var initials = (u.display_name || u.name || '?').slice(0, 2).toUpperCase();
  var color = u.avatar_color || '#3b82f6';
  if (u.profile_image) {
    return (
      '<img src="' +
      esc(mediaUrl(u.profile_image)) +
      '" alt="" class="friend-card__avatar" style="width:' +
      size +
      'px;height:' +
      size +
      'px" />'
    );
  }
  return (
    '<span class="friend-card__avatar" style="width:' +
    size +
    'px;height:' +
    size +
    'px;background:' +
    color +
    '">' +
    esc(initials) +
    '</span>'
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  var now = new Date();
  var d = new Date(dateStr);
  var diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function renderFriendCard(u, opts) {
  opts = opts || {};
  var mutualHtml = '';
  if (u.mutual_friends > 0) {
    mutualHtml =
      '<span class="friend-card__mutual" data-mutual="' +
      u.id +
      '">' +
      u.mutual_friends +
      ' mutual</span>';
  }
  var sinceHtml = u.friends_since
    ? '<span>Friends since ' + formatDate(u.friends_since) + '</span>'
    : '';
  var subHtml = [mutualHtml, sinceHtml].filter(Boolean).join('<span class="text-muted">·</span>');

  var actionsHtml = opts.actions || '';
  if (!actionsHtml) {
    var rel = u.relationship || 'none';
    if (rel === 'friends') {
      actionsHtml =
        '<button class="btn-friend btn-friend--success" data-message="' +
        u.id +
        '" title="Message"><i class="fas fa-comment"></i></button>' +
        '<button class="btn-friend btn-friend--danger" data-unfriend="' +
        u.id +
        '" title="Unfriend"><i class="fas fa-user-minus"></i></button>';
    } else if (rel === 'pending_sent') {
      actionsHtml = '<button class="btn-friend btn-friend--disabled" disabled>Pending</button>';
    } else if (rel === 'pending_received') {
      actionsHtml =
        '<button class="btn-friend btn-friend--success" data-accept="' +
        (u.request_id || '') +
        '">Accept</button>' +
        '<button class="btn-friend btn-friend--danger" data-decline="' +
        (u.request_id || '') +
        '">Decline</button>';
    } else {
      actionsHtml =
        '<button class="btn-friend btn-friend--primary" data-add="' +
        u.id +
        '"><i class="fas fa-user-plus"></i> Add</button>';
    }
  }

  var favHtml = '';
  if (opts.showFav !== false) {
    var favClass = u.is_favorite ? 'is-favorite' : '';
    favHtml =
      '<button class="friend-card__fav ' +
      favClass +
      '" data-fav="' +
      u.id +
      '" title="' +
      (u.is_favorite ? 'Unfavorite' : 'Favorite') +
      '">' +
      (u.is_favorite ? '\u2605' : '\u2606') +
      '</button>';
  }

  return (
    '<div class="friend-card" data-user-id="' +
    u.id +
    '">' +
    '<div class="friend-card__avatar-wrap">' +
    avatarHtml(u) +
    (opts.showOnline ? '<span class="friend-card__online-dot"></span>' : '') +
    '</div>' +
    '<div class="friend-card__body">' +
    '<div class="friend-card__name">' +
    '<a href="profile.html?id=' +
    u.id +
    '">' +
    esc(u.display_name || u.name) +
    '</a>' +
    favHtml +
    '</div>' +
    '<div class="friend-card__sub">@' +
    esc(u.name) +
    (subHtml ? ' <span class="text-muted">\u00B7</span> ' + subHtml : '') +
    '</div>' +
    '</div>' +
    '<div class="friend-card__actions">' +
    actionsHtml +
    '</div>' +
    '</div>'
  );
}

function showMutualPopup(e, userId) {
  var existing = document.querySelector('.mutual-popup');
  if (existing) existing.remove();

  var popup = document.createElement('div');
  popup.className = 'mutual-popup';
  popup.innerHTML = '<div class="mutual-popup__title">Loading mutual friends\u2026</div>';
  document.body.appendChild(popup);

  var rect = e.target.getBoundingClientRect();
  popup.style.left = Math.min(rect.left, window.innerWidth - 280) + 'px';
  popup.style.top = rect.bottom + 6 + 'px';

  authFetch('/friends/mutual/' + userId)
    .then(function (data) {
      var users = data.users || [];
      if (users.length === 0) {
        popup.innerHTML = '<div class="mutual-popup__title">No mutual friends</div>';
        return;
      }
      popup.innerHTML =
        '<div class="mutual-popup__title">Mutual friends (' +
        users.length +
        ')</div>' +
        users
          .map(function (u) {
            var initials = (u.display_name || u.name || '?').slice(0, 2).toUpperCase();
            var color = u.avatar_color || '#3b82f6';
            var imgHtml = u.profile_image
              ? '<img src="' +
                esc(mediaUrl(u.profile_image)) +
                '" alt="" class="mutual-popup__avatar" />'
              : '<span class="mutual-popup__avatar" style="background:' +
                color +
                '">' +
                esc(initials) +
                '</span>';
            return (
              '<div class="mutual-popup__item">' +
              imgHtml +
              '<a href="profile.html?id=' +
              u.id +
              '" style="color:inherit;text-decoration:none">' +
              esc(u.display_name || u.name) +
              '</a></div>'
            );
          })
          .join('');
    })
    .catch(function () {
      popup.innerHTML = '<div class="mutual-popup__title">Could not load</div>';
    });

  function closePopup(e2) {
    if (!popup.contains(e2.target)) {
      popup.remove();
      document.removeEventListener('click', closePopup);
    }
  }
  setTimeout(function () {
    document.addEventListener('click', closePopup);
  }, 10);
}

function showRequestModal(userId, userName) {
  var overlay = document.createElement('div');
  overlay.className = 'request-modal-overlay';
  overlay.innerHTML =
    '<div class="request-modal">' +
    '<h3>Add ' +
    esc(userName) +
    '</h3>' +
    '<p class="text-muted small">Optional: include a message</p>' +
    '<textarea id="requestMessage" placeholder="Hi! Want to connect about the group project\u2026" maxlength="200"></textarea>' +
    '<div class="request-modal-actions">' +
    '<button class="btn-ghost" id="cancelRequest">Cancel</button>' +
    '<button class="btn-neon" id="sendRequest">Send Request</button>' +
    '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  document.getElementById('cancelRequest').addEventListener('click', function () {
    overlay.remove();
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.remove();
  });

  document.getElementById('sendRequest').addEventListener('click', async function () {
    var msg = document.getElementById('requestMessage').value.trim();
    try {
      await authFetch('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ receiver_id: userId, message: msg }),
      });
      overlay.remove();
      refreshAll();
    } catch (err) {
      alert(err.message);
    }
  });
}

function bindFriendActions(root) {
  root.querySelectorAll('[data-add]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var userId = Number(btn.dataset.add);
      var card = btn.closest('.friend-card') || btn.closest('.suggested-card');
      var name = card
        ? (card.querySelector('.friend-card__name') || card.querySelector('.suggested-card__name'))
            ?.textContent || 'this user'
        : 'this user';
      showRequestModal(userId, name.trim());
    });
  });

  root.querySelectorAll('[data-accept]').forEach(function (btn) {
    btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      try {
        await authFetch('/friends/accept', {
          method: 'POST',
          body: JSON.stringify({ request_id: Number(btn.dataset.accept) }),
        });
        refreshAll();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  root.querySelectorAll('[data-decline]').forEach(function (btn) {
    btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      try {
        await authFetch('/friends/decline', {
          method: 'POST',
          body: JSON.stringify({ request_id: Number(btn.dataset.decline) }),
        });
        refreshAll();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  root.querySelectorAll('[data-unfriend]').forEach(function (btn) {
    btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      if (!confirm('Remove this friend?')) return;
      try {
        await authFetch('/friends/' + btn.dataset.unfriend, { method: 'DELETE' });
        refreshAll();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  root.querySelectorAll('[data-message]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      window.location.href = 'chat.html?dm=' + btn.dataset.message;
    });
  });

  root.querySelectorAll('[data-fav]').forEach(function (btn) {
    btn.addEventListener('click', async function (e) {
      e.stopPropagation();
      var friendId = Number(btn.dataset.fav);
      try {
        var data = await authFetch('/friends/favorite', {
          method: 'POST',
          body: JSON.stringify({ friend_id: friendId }),
        });
        if (data.is_favorite) {
          btn.classList.add('is-favorite');
          btn.title = 'Unfavorite';
          btn.textContent = '\u2605';
        } else {
          btn.classList.remove('is-favorite');
          btn.title = 'Favorite';
          btn.textContent = '\u2606';
        }
      } catch (err) {
        alert(err.message);
      }
    });
  });

  root.querySelectorAll('[data-mutual]').forEach(function (el) {
    el.addEventListener('mouseenter', function (e) {
      showMutualPopup(e, Number(el.dataset.mutual));
    });
  });
}

function loadOnline() {
  var list = document.getElementById('onlineFriendsList');
  if (!list) return;
  var online = allFriendsData.filter(function (f) {
    return f.is_online;
  });
  if (online.length === 0) {
    list.innerHTML =
      '<div class="friends-empty"><div class="friends-empty-icon"><i class="fas fa-wifi-slash"></i></div><p>No friends currently online</p><p class="small text-muted">When friends are active online, they\'ll show up here.</p></div>';
    return;
  }
  list.innerHTML = online
    .map(function (f) {
      return renderFriendCard(f, { showOnline: true });
    })
    .join('');
  bindFriendActions(list);
}

function loadAllFriends(sort) {
  var list = document.getElementById('allFriendsList');
  if (!list) return;

  var sorted = [].concat(allFriendsData);
  if (sort === 'recent') {
    sorted.sort(function (a, b) {
      return new Date(b.friends_since || 0) - new Date(a.friends_since || 0);
    });
  } else if (sort === 'name') {
    sorted.sort(function (a, b) {
      return (a.display_name || a.name || '').localeCompare(b.display_name || b.name || '');
    });
  } else if (sort === 'group') {
    /* backend already sorted by shared group count; keep order */
  } else {
    sorted.sort(function (a, b) {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return (a.display_name || a.name || '').localeCompare(b.display_name || b.name || '');
    });
  }

  var filterVal = (document.getElementById('allFriendsSearch')?.value || '').toLowerCase().trim();
  if (filterVal) {
    sorted = sorted.filter(function (f) {
      var name = (f.display_name || f.name || '').toLowerCase();
      var uname = (f.name || '').toLowerCase();
      return (
        name.indexOf(filterVal) === 0 ||
        name.indexOf(' ' + filterVal) >= 0 ||
        uname.indexOf(filterVal) === 0
      );
    });
  }

  if (sorted.length === 0) {
    list.innerHTML =
      '<div class="friends-empty"><div class="friends-empty-icon"><i class="fas fa-user-friends"></i></div><p>' +
      (filterVal ? 'No friends match your filter.' : "You haven't added any friends yet.") +
      '</p></div>';
    return;
  }
  list.innerHTML = sorted
    .map(function (f) {
      return renderFriendCard(f, { showFav: true });
    })
    .join('');
  bindFriendActions(list);
}

function loadPending() {
  var list = document.getElementById('pendingRequestsList');
  if (!list) return;
  list.innerHTML = '<div class="friends-empty"><p class="text-muted">Loading\u2026</p></div>';

  authFetch('/friends/requests?tab=' + pendingSubTab)
    .then(function (data) {
      var requests = data.requests || [];
      if (requests.length === 0) {
        list.innerHTML =
          '<div class="friends-empty"><div class="friends-empty-icon"><i class="fas fa-inbox"></i></div><p>No ' +
          pendingSubTab +
          ' requests.</p></div>';
        return;
      }
      list.innerHTML = requests
        .map(function (r) {
          var u = r.user;
          u.relationship = pendingSubTab === 'received' ? 'pending_received' : 'pending_sent';
          u.request_id = r.request_id;
          var msgHtml = r.message
            ? '<div class="friend-request-message">\u201C' + esc(r.message) + '\u201D</div>'
            : '';
          var ago = timeAgo(r.created_at);
          var sub =
            '@' + esc(u.name) + (ago ? ' <span class="text-muted">\u00B7</span> ' + ago : '');
          var actionsHtml;
          if (pendingSubTab === 'received') {
            actionsHtml =
              '<button class="btn-friend btn-friend--success" data-accept="' +
              r.request_id +
              '">Accept</button>' +
              '<button class="btn-friend btn-friend--danger" data-decline="' +
              r.request_id +
              '">Decline</button>';
          } else {
            actionsHtml =
              '<button class="btn-friend btn-friend--danger" data-decline="' +
              r.request_id +
              '">Cancel</button>';
          }
          return (
            '<div class="friend-card">' +
            '<div class="friend-card__avatar-wrap">' +
            avatarHtml(u) +
            '</div>' +
            '<div class="friend-card__body">' +
            '<div class="friend-card__name"><a href="profile.html?id=' +
            u.id +
            '">' +
            esc(u.display_name || u.name) +
            '</a></div>' +
            '<div class="friend-card__sub">' +
            sub +
            '</div>' +
            msgHtml +
            '</div>' +
            '<div class="friend-card__actions">' +
            actionsHtml +
            '</div>' +
            '</div>'
          );
        })
        .join('');
      bindFriendActions(list);
    })
    .catch(function (err) {
      list.innerHTML = '<div class="friends-empty text-danger">' + esc(err.message) + '</div>';
    });
}

function loadBlocked() {
  var list = document.getElementById('blockedUsersList');
  if (!list) return;
  authFetch('/block/list')
    .then(function (users) {
      if (!users || users.length === 0) {
        list.innerHTML =
          '<div class="friends-empty"><div class="friends-empty-icon"><i class="fas fa-ban"></i></div><p>You haven\'t blocked anyone.</p></div>';
        return;
      }
      list.innerHTML = users
        .map(function (u) {
          return (
            '<div class="friend-card">' +
            '<div class="friend-card__avatar-wrap">' +
            '<span class="friend-card__avatar" style="background:#6b7280">' +
            esc((u.name || '?').slice(0, 2).toUpperCase()) +
            '</span>' +
            '</div>' +
            '<div class="friend-card__body">' +
            '<div class="friend-card__name"><span style="color:var(--text-muted)">' +
            esc(u.name) +
            '</span></div>' +
            '</div>' +
            '<div class="friend-card__actions">' +
            '<button class="btn-friend btn-friend--primary" data-unblock="' +
            u.blocked_id +
            '">Unblock</button>' +
            '</div>' +
            '</div>'
          );
        })
        .join('');
      list.querySelectorAll('[data-unblock]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await authFetch('/block/' + btn.dataset.unblock, { method: 'DELETE' });
            loadBlocked();
          } catch (err) {
            alert(err.message);
          }
        });
      });
    })
    .catch(function () {
      list.innerHTML =
        '<div class="friends-empty text-danger"><p>Could not load blocked users.</p></div>';
    });
}

function loadSuggested() {
  var list = document.getElementById('suggestedFriends');
  if (!list) return;

  authFetch('/friends/suggested')
    .then(function (data) {
      var users = data.users || [];
      if (users.length === 0) {
        list.innerHTML =
          '<div class="friends-empty" style="grid-column:1/-1"><p class="text-muted small">No suggestions yet. Join study groups to find people!</p></div>';
        return;
      }
      list.innerHTML = users
        .map(function (u) {
          var initials = (u.display_name || u.name || '?').slice(0, 2).toUpperCase();
          var color = u.avatar_color || '#3b82f6';
          var imgHtml = u.profile_image
            ? '<img src="' +
              esc(mediaUrl(u.profile_image)) +
              '" alt="" class="suggested-card__avatar" />'
            : '<span class="suggested-card__avatar" style="background:' +
              color +
              '">' +
              esc(initials) +
              '</span>';
          var metaParts = [];
          if (u.shared_groups > 0)
            metaParts.push(u.shared_groups + ' shared group' + (u.shared_groups > 1 ? 's' : ''));
          if (u.mutual_friends > 0) metaParts.push(u.mutual_friends + ' mutual');
          return (
            '<div class="suggested-card">' +
            '<a href="profile.html?id=' +
            u.id +
            '" style="text-decoration:none;color:inherit">' +
            imgHtml +
            '<div class="suggested-card__name">' +
            esc(u.display_name || u.name) +
            '</div>' +
            '</a>' +
            '<div class="suggested-card__meta">' +
            metaParts.join(' \u00B7 ') +
            '</div>' +
            '<button class="btn-friend btn-friend--primary" data-add="' +
            u.id +
            '"><i class="fas fa-user-plus"></i> Add</button>' +
            '</div>'
          );
        })
        .join('');
      bindFriendActions(list);
    })
    .catch(function () {
      list.innerHTML =
        '<div class="friends-empty" style="grid-column:1/-1"><p class="text-danger small">Could not load suggestions.</p></div>';
    });
}

function searchUsers(q) {
  var list = document.getElementById('searchResults');
  if (!list) return;
  var query = q.trim();
  if (!query) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = '<div class="friends-empty"><p class="text-muted">Searching\u2026</p></div>';
  authFetch('/friends/search?q=' + encodeURIComponent(query))
    .then(function (data) {
      var users = data.users || [];
      if (users.length === 0) {
        list.innerHTML =
          '<div class="friends-empty"><div class="friends-empty-icon"><i class="fas fa-search"></i></div><p>No users found matching "' +
          esc(query) +
          '"</p></div>';
        return;
      }
      list.innerHTML =
        '<h6 class="mt-2 mb-1">Search results</h6>' +
        users
          .map(function (u) {
            return renderFriendCard(u);
          })
          .join('');
      bindFriendActions(list);
    })
    .catch(function (err) {
      list.innerHTML = '<div class="friends-empty text-danger">' + esc(err.message) + '</div>';
    });
}

function updateBadges() {
  authFetch('/friends/requests?tab=received')
    .then(function (data) {
      var count = (data.requests || []).length;
      var badge = document.getElementById('pendingBadge');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? '' : 'none';
      }
    })
    .catch(function () {});
}

function fetchAllFriends(cb) {
  var sort = document.getElementById('friendsSort')?.value || '';
  authFetch('/friends?sort=' + sort)
    .then(function (data) {
      allFriendsData = data.friends || [];
      var badge = document.getElementById('allFriendsBadge');
      if (badge) badge.textContent = allFriendsData.length;
      if (cb) cb();
    })
    .catch(function () {});
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.friends-page-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.friendTab === tab);
  });
  document.querySelectorAll('.friend-tab-panel').forEach(function (p) {
    p.classList.toggle('d-none', p.id !== 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  });
  if (tab === 'online') loadOnline();
  if (tab === 'all') loadAllFriends(document.getElementById('friendsSort')?.value);
  if (tab === 'pending') loadPending();
  if (tab === 'blocked') loadBlocked();
  if (tab === 'add') loadSuggested();
}

function refreshAll() {
  fetchAllFriends(function () {
    loadOnline();
    loadAllFriends(document.getElementById('friendsSort')?.value);
    updateBadges();
    if (currentTab === 'pending') loadPending();
  });
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-friend-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchTab(tab.dataset.friendTab);
    });
  });

  document.querySelectorAll('[data-pending-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      pendingSubTab = tab.dataset.pendingTab;
      document.querySelectorAll('[data-pending-tab]').forEach(function (t) {
        t.classList.toggle('active', t === tab);
      });
      loadPending();
    });
  });

  document.getElementById('friendSearch')?.addEventListener('input', function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      searchUsers(e.target.value);
    }, 300);
  });

  document.getElementById('friendsSort')?.addEventListener('change', function (e) {
    fetchAllFriends(function () {
      loadAllFriends(e.target.value);
    });
  });

  document.getElementById('allFriendsSearch')?.addEventListener('input', function () {
    loadAllFriends(document.getElementById('friendsSort')?.value);
  });

  fetchAllFriends(function () {
    loadOnline();
    loadAllFriends('');
    updateBadges();
  });
});
