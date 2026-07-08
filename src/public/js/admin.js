(function () {
  function esc(t) {
    var d = document.createElement('div');
    d.textContent = t ?? '';
    return d.innerHTML;
  }

  var _confirmCallback = null;
  var _confirmStep2 = null;
  var _pendingBanUserId = null;
  var _pendingBanPostAuthorId = null;
  var _showBannedOnly = false;

  function hideEl(id) {
    var e = document.getElementById(id);
    if (e) e.classList.add('hidden');
  }
  function showEl(id) {
    var e = document.getElementById(id);
    if (e) e.classList.remove('hidden');
  }

  // ---- Confirmation modal (double-confirm for destructive actions) ----
  function openConfirm(title, desc, cb, opts) {
    opts = opts || {};
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmDesc').innerHTML = desc;
    var extra = document.getElementById('confirmExtra');
    var input = document.getElementById('confirmInput');
    if (opts.requireTyping) {
      extra.classList.remove('hidden');
      document.getElementById('confirmTypeWord').textContent = opts.requireTyping;
      input.value = '';
      input.placeholder = 'Type "' + opts.requireTyping + '"';
    } else {
      extra.classList.add('hidden');
    }
    _confirmCallback = cb;
    _confirmStep2 = opts.requireTyping ? opts.requireTyping : null;
    showEl('confirmModal');
    input.focus();
  }

  document.getElementById('confirmCancel').addEventListener('click', function () {
    hideEl('confirmModal');
    _confirmCallback = null;
    _confirmStep2 = null;
  });
  document.getElementById('confirmOk').addEventListener('click', function () {
    if (_confirmStep2) {
      var val = document.getElementById('confirmInput').value.trim();
      if (val !== _confirmStep2) {
        alert('Type "' + _confirmStep2 + '" to confirm.');
        return;
      }
    }
    hideEl('confirmModal');
    if (typeof _confirmCallback === 'function') _confirmCallback();
    _confirmCallback = null;
    _confirmStep2 = null;
  });
  document.getElementById('confirmInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('confirmOk').click();
  });

  // ---- Ban modal ----
  document.getElementById('banReasonSelect').addEventListener('change', function () {
    var txt = document.getElementById('banReasonText');
    if (this.value === 'Other') {
      txt.classList.remove('hidden');
    } else {
      txt.classList.add('hidden');
    }
  });
  document.getElementById('banCancel').addEventListener('click', function () {
    hideEl('banModal');
    _pendingBanUserId = null;
  });
  document.getElementById('banConfirm').addEventListener('click', function () {
    var userId = _pendingBanUserId;
    if (!userId) return;
    var duration = parseInt(document.getElementById('banDuration').value, 10);
    var reason = document.getElementById('banReasonSelect').value;
    if (!reason) {
      alert('Please select a ban reason.');
      return;
    }
    if (reason === 'Other') {
      var custom = document.getElementById('banReasonText').value.trim();
      if (!custom) {
        alert('Please enter a reason.');
        return;
      }
      reason = custom;
    }
    hideEl('banModal');
    _pendingBanUserId = null;
    executeBan(userId, duration, reason);
  });

  function openBanModal(userId, label) {
    _pendingBanUserId = userId;
    document.getElementById('banUserLabel').textContent = 'Ban ' + label + ' (ID: ' + userId + ')';
    document.getElementById('banDuration').value = '1';
    document.getElementById('banReasonSelect').value = '';
    document.getElementById('banReasonText').value = '';
    document.getElementById('banReasonText').classList.add('hidden');
    showEl('banModal');
  }

  function executeBan(userId, hours, reason) {
    authFetch('/auth/admin/ban-with-reason', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, duration_hours: hours || null, reason: reason }),
    })
      .then(function (data) {
        loadReports();
        loadStats();
        loadAdminPanel();
      })
      .catch(function (err) {
        alert('Ban failed: ' + err.message);
      });
  }

  // ---- Render functions ----
  function renderUsers(users) {
    var tbody = document.getElementById('adminUsersBody');
    var count = document.getElementById('userCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    count.textContent = users.length + ' users';
    if (users.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted py-4">No users found.</td></tr>';
      return;
    }
    users.forEach(function (u) {
      var isSuspended = u.suspended_until && new Date(u.suspended_until) > new Date();
      var suspendLabel = '';
      if (isSuspended) {
        var until = new Date(u.suspended_until);
        suspendLabel =
          until.getFullYear() >= 2999
            ? 'Permanent Ban'
            : 'Banned until ' + until.toLocaleDateString();
      }
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' +
        u.id +
        '</td>' +
        '<td><strong>' +
        esc(u.display_name || u.name) +
        '</strong></td>' +
        '<td>' +
        esc(u.email) +
        '</td>' +
        '<td>' +
        '<select class="form-select form-select-sm role-select" data-user-id="' +
        u.id +
        '" data-user-name="' +
        esc(u.display_name || u.name) +
        '" data-current-role="' +
        u.role +
        '" style="width:auto;display:inline-block;">' +
        '<option value="user"' +
        (u.role === 'user' ? ' selected' : '') +
        '>User</option>' +
        '<option value="admin"' +
        (u.role === 'admin' ? ' selected' : '') +
        '>Admin</option>' +
        '</select>' +
        '</td>' +
        '<td>' +
        (isSuspended
          ? '<span class="badge bg-danger">' + suspendLabel + '</span>'
          : '<span class="badge bg-success">Active</span>') +
        '</td>' +
        '<td style="white-space:nowrap;">' +
        '<button class="btn-action btn-danger-sm me-1 delete-user-btn" data-user-id="' +
        u.id +
        '" data-user-name="' +
        esc(u.display_name || u.name) +
        '" title="Delete user"><i class="fas fa-trash-alt"></i></button>' +
        (isSuspended
          ? '<button class="btn-action btn-success-sm unsuspend-user-btn" data-user-id="' +
            u.id +
            '" title="Unsuspend"><i class="fas fa-unlock"></i></button>'
          : '') +
        '</td>';
      tbody.appendChild(row);
    });
    bindUserActions();
  }

  function renderBannedUsers(users) {
    var tbody = document.getElementById('adminUsersBody');
    var count = document.getElementById('userCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    count.textContent = users.length + ' banned';
    if (users.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted py-4">No banned users.</td></tr>';
      return;
    }
    users.forEach(function (u) {
      var until = new Date(u.suspended_until);
      var isPerm = until.getFullYear() >= 2999;
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' +
        u.id +
        '</td>' +
        '<td><strong>' +
        esc(u.display_name || u.name) +
        '</strong></td>' +
        '<td>' +
        esc(u.email) +
        '</td>' +
        '<td><span class="role-badge role-badge--' +
        u.role +
        '">' +
        u.role +
        '</span></td>' +
        '<td><span class="badge bg-danger">' +
        (isPerm ? 'Permanent' : 'Until ' + until.toLocaleDateString()) +
        '</span></td>' +
        '<td style="white-space:nowrap;">' +
        '<button class="btn-action btn-success-sm unsuspend-user-btn" data-user-id="' +
        u.id +
        '" title="Unsuspend"><i class="fas fa-unlock"></i> Revert</button>' +
        '</td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('.unsuspend-user-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConfirm(
          'Unsuspend User',
          'Lift the ban on user ID <strong>' + btn.dataset.userId + '</strong>?',
          function () {
            authFetch('/auth/admin/unsuspend', {
              method: 'POST',
              body: JSON.stringify({ user_id: btn.dataset.userId }),
            })
              .then(function () {
                loadAdminPanel();
                loadStats();
              })
              .catch(function (err) {
                alert(err.message);
              });
          },
        );
      });
    });
  }

  function renderStats(stats, trends) {
    var el = document.getElementById('adminStats');
    if (!el) return;
    var s = stats || {};
    var t = trends || {};
    var trendHtml = function (val, label) {
      if (val === undefined || val === null) return '';
      var cls = parseInt(val) >= 0 ? 'text-success' : 'text-danger';
      return (
        '<div class="trend ' +
        cls +
        '"><i class="fas fa-' +
        (parseInt(val) >= 0 ? 'arrow-up' : 'arrow-down') +
        ' me-1"></i>' +
        val +
        ' this week</div>'
      );
    };
    el.innerHTML =
      '<div class="col-md-3 col-6"><div class="stat-card"><div class="num text-primary">' +
      (s.users || 0) +
      '</div>' +
      trendHtml(t.users_7d, 'users') +
      '<div class="label">Total Users</div></div></div>' +
      '<div class="col-md-3 col-6"><div class="stat-card"><div class="num text-success">' +
      (s.posts || 0) +
      '</div>' +
      trendHtml(t.posts_7d, 'posts') +
      '<div class="label">Total Posts</div></div></div>' +
      '<div class="col-md-3 col-6"><div class="stat-card"><div class="num text-warning">' +
      (s.reports || 0) +
      '</div>' +
      trendHtml(t.reports_7d, 'reports') +
      '<div class="label">Total Reports</div></div></div>' +
      '<div class="col-md-3 col-6"><div class="stat-card"><div class="num text-danger">' +
      (s.suspended || 0) +
      '</div><div class="label">Suspended Users</div></div></div>';
  }

  function renderReports(reports, showResolved) {
    var tbody = document.getElementById('reportsBody');
    var count = document.getElementById('reportCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    count.textContent = reports.length + ' reports';
    if (reports.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="text-center text-muted py-4">No reports.</td></tr>';
      return;
    }
    reports.forEach(function (r) {
      var isDismissed = r.dismissed;
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' +
        r.id +
        '</td>' +
        '<td><a href="posts.html?id=' +
        r.post_id +
        '" target="_blank" class="text-decoration-none">' +
        esc(r.post_title || 'Post #' + r.post_id) +
        '</a></td>' +
        '<td><span class="badge bg-warning text-dark">' +
        esc(r.reason) +
        '</span></td>' +
        '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' +
        esc(r.description || '') +
        '">' +
        esc(r.description || '-') +
        '</td>' +
        '<td><strong>' +
        esc(r.reporter_name) +
        '</strong></td>' +
        '<td><strong>' +
        esc(r.post_author_name || 'Unknown') +
        '</strong> <small class="text-muted">(ID: ' +
        r.post_author_id +
        ')</small></td>' +
        '<td><small>' +
        new Date(r.created_at).toLocaleDateString() +
        '</small></td>' +
        '<td style="white-space:nowrap;">' +
        (isDismissed
          ? '<span class="badge bg-secondary">Dismissed</span>'
          : '<div class="dropdown d-inline-block me-1">' +
            '<button class="btn-action btn-danger-sm dropdown-toggle" type="button" data-bs-toggle="dropdown"><i class="fas fa-gavel"></i></button>' +
            '<ul class="dropdown-menu dropdown-menu-end p-2" style="min-width:200px;">' +
            '<li><button class="dropdown-item ban-btn" data-user-id="' +
            r.post_author_id +
            '" data-name="' +
            esc(r.post_author_name) +
            '">Ban this user</button></li>' +
            '<li><hr class="dropdown-divider"></li>' +
            '<li><button class="dropdown-item text-danger delete-post-btn" data-post-id="' +
            r.post_id +
            '">Delete post</button></li>' +
            '<li><button class="dropdown-item text-secondary dismiss-report-btn" data-report-id="' +
            r.id +
            '">Dismiss report</button></li>' +
            '</ul>' +
            '</div>') +
        '</td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('.ban-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openBanModal(btn.dataset.userId, btn.dataset.name);
      });
    });
    document.querySelectorAll('.delete-post-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConfirm(
          'Delete Post',
          'Delete post #' + btn.dataset.postId + '? This cannot be undone.',
          function () {
            authFetch('/posts/' + btn.dataset.postId, { method: 'DELETE' })
              .then(function () {
                loadReports();
                loadStats();
              })
              .catch(function (err) {
                alert(err.message);
              });
          },
          { requireTyping: 'DELETE' },
        );
      });
    });
    document.querySelectorAll('.dismiss-report-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        authFetch('/auth/admin/reports/' + btn.dataset.reportId + '/dismiss', { method: 'POST' })
          .then(function () {
            loadReports();
          })
          .catch(function (err) {
            alert(err.message);
          });
      });
    });
  }

  function renderPosts(posts) {
    var tbody = document.getElementById('adminPostsBody');
    var count = document.getElementById('postCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    count.textContent = posts.length + ' posts';
    if (posts.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted py-4">No posts found.</td></tr>';
      return;
    }
    posts.forEach(function (p) {
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' +
        p.id +
        '</td>' +
        '<td><a href="posts.html?id=' +
        p.id +
        '" target="_blank" class="text-decoration-none fw-semibold">' +
        esc(p.title || 'Untitled') +
        '</a></td>' +
        '<td>' +
        esc(p.author_name || 'Unknown') +
        '</td>' +
        '<td><span class="badge bg-light text-dark">' +
        esc(p.category || '-') +
        '</span></td>' +
        '<td><small>' +
        new Date(p.created_at).toLocaleDateString() +
        '</small></td>' +
        '<td><button class="btn-action btn-danger-sm delete-post-btn" data-post-id="' +
        p.id +
        '" title="Delete"><i class="fas fa-trash-alt"></i></button></td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('#adminPostsBody .delete-post-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConfirm(
          'Delete Post',
          'Delete post #' + btn.dataset.postId + '? This cannot be undone.',
          function () {
            authFetch('/posts/' + btn.dataset.postId, { method: 'DELETE' })
              .then(function () {
                loadPosts();
                loadStats();
              })
              .catch(function (err) {
                alert(err.message);
              });
          },
          { requireTyping: 'DELETE' },
        );
      });
    });
  }

  function renderAppeals(appeals) {
    var tbody = document.getElementById('appealsBody');
    var count = document.getElementById('appealCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    count.textContent = appeals.length + ' pending';
    if (appeals.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted py-4">No pending appeals.</td></tr>';
      return;
    }
    appeals.forEach(function (a) {
      var until = a.suspended_until ? new Date(a.suspended_until) : null;
      var isPerm = until && until.getFullYear() >= 2999;
      var durStr = isPerm ? 'Permanent' : until ? 'Until ' + until.toLocaleDateString() : 'Unknown';
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' +
        a.id +
        '</td>' +
        '<td><strong>' +
        esc(a.user_name || a.user_username) +
        '</strong> <small class="text-muted">(ID: ' +
        a.user_id +
        ')</small></td>' +
        '<td>' +
        esc(a.banned_reason || '-') +
        '</td>' +
        '<td>' +
        durStr +
        '</td>' +
        '<td style="max-width:200px;">' +
        esc(a.message) +
        '</td>' +
        '<td><small>' +
        new Date(a.created_at).toLocaleDateString() +
        '</small></td>' +
        '<td style="white-space:nowrap;">' +
        '<button class="btn-action btn-success-sm me-1 approve-appeal-btn" data-appeal-id="' +
        a.id +
        '" title="Approve & unsuspend"><i class="fas fa-check"></i> Revert Ban</button>' +
        '<button class="btn-action btn-edit-sm dismiss-appeal-btn" data-appeal-id="' +
        a.id +
        '" title="Dismiss"><i class="fas fa-times"></i> Ignore</button>' +
        '</td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('.approve-appeal-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConfirm(
          'Approve Appeal',
          'Unsuspend the user and mark the appeal as approved?',
          function () {
            authFetch('/auth/admin/appeals/' + btn.dataset.appealId + '/approve', {
              method: 'POST',
            })
              .then(function () {
                loadAppeals();
                loadStats();
              })
              .catch(function (err) {
                alert(err.message);
              });
          },
        );
      });
    });
    document.querySelectorAll('.dismiss-appeal-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConfirm(
          'Dismiss Appeal',
          'Mark this appeal as dismissed? The ban will remain in effect.',
          function () {
            authFetch('/auth/admin/appeals/' + btn.dataset.appealId + '/dismiss', {
              method: 'POST',
            })
              .then(function () {
                loadAppeals();
              })
              .catch(function (err) {
                alert(err.message);
              });
          },
        );
      });
    });
  }

  function renderAuditLog(log) {
    var tbody = document.getElementById('auditBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!log || log.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center text-muted py-4">No audit log entries.</td></tr>';
      return;
    }
    log.forEach(function (entry) {
      var row = document.createElement('tr');
      row.innerHTML =
        '<td><small>' +
        new Date(entry.created_at).toLocaleString() +
        '</small></td>' +
        '<td>' +
        esc(entry.admin_name || entry.admin_username) +
        '</td>' +
        '<td><span class="badge bg-info text-dark">' +
        esc(entry.action) +
        '</span></td>' +
        '<td>' +
        esc(entry.target_type || '-') +
        ' #' +
        (entry.target_id || '-') +
        '</td>' +
        '<td style="max-width:250px;">' +
        esc(entry.details || '') +
        '</td>';
      tbody.appendChild(row);
    });
  }

  // ---- Bind user actions ----
  function bindUserActions() {
    document.querySelectorAll('.delete-user-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConfirm(
          'Delete User',
          'Delete user <strong>' +
            btn.dataset.userName +
            '</strong> (ID: ' +
            btn.dataset.userId +
            ')? This cannot be undone.',
          function () {
            authFetch('/auth/admin/users/' + btn.dataset.userId, { method: 'DELETE' })
              .then(function () {
                loadAdminPanel();
                loadStats();
              })
              .catch(function (err) {
                alert(err.message);
              });
          },
          { requireTyping: btn.dataset.userName },
        );
      });
    });
    document.querySelectorAll('.role-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var newRole = sel.value;
        var userName = sel.dataset.userName;
        var currentRole = sel.dataset.currentRole;
        var desc =
          'You are about to promote <strong>' +
          userName +
          '</strong> from ' +
          currentRole +
          ' to ' +
          newRole +
          '. ' +
          (newRole === 'admin'
            ? 'Admins can manage users, posts, and reports, including banning other users. This can be reversed later.'
            : '');
        openConfirm(
          'Change Role',
          desc,
          function () {
            authFetch('/auth/admin/users/' + sel.dataset.userId, {
              method: 'PUT',
              body: JSON.stringify({ role: newRole }),
            })
              .then(function () {
                loadAdminPanel();
                loadStats();
              })
              .catch(function (err) {
                alert(err.message);
              });
          },
          { requireTyping: newRole.toUpperCase() },
        );
        sel.value = currentRole;
      });
    });
    document.querySelectorAll('.unsuspend-user-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConfirm(
          'Unsuspend User',
          'Lift the ban on user ID <strong>' + btn.dataset.userId + '</strong>?',
          function () {
            authFetch('/auth/admin/unsuspend', {
              method: 'POST',
              body: JSON.stringify({ user_id: btn.dataset.userId }),
            })
              .then(function () {
                loadAdminPanel();
                loadStats();
              })
              .catch(function (err) {
                alert(err.message);
              });
          },
        );
      });
    });
  }

  // ---- Load functions ----
  function loadAdminPanel() {
    showEl('adminLoading');
    hideEl('adminError');
    hideEl('adminPanel');
    var url = '/auth/admin/users';
    if (_showBannedOnly) {
      authFetch('/auth/admin/banned-users')
        .then(function (data) {
          hideEl('adminLoading');
          showEl('adminPanel');
          renderBannedUsers(data.users || []);
        })
        .catch(function (err) {
          hideEl('adminLoading');
          showEl('adminError');
          document.getElementById('adminError').textContent = err.message;
        });
      return;
    }
    authFetch(url)
      .then(function (data) {
        hideEl('adminLoading');
        showEl('adminPanel');
        renderUsers(data.users || []);
      })
      .catch(function (err) {
        hideEl('adminLoading');
        showEl('adminError');
        document.getElementById('adminError').textContent = err.message;
      });
  }

  function loadStats() {
    authFetch('/auth/admin/stats')
      .then(function (data) {
        authFetch('/auth/admin/trend-stats')
          .then(function (trends) {
            renderStats(data, trends);
          })
          .catch(function () {
            renderStats(data);
          });
      })
      .catch(function () {});
  }

  function loadPosts(search, category, dateFilter) {
    showEl('postsLoading');
    hideEl('postsError');
    hideEl('postsPanel');
    var params = [];
    if (search) params.push('search=' + encodeURIComponent(search));
    if (category) params.push('category=' + encodeURIComponent(category));
    if (dateFilter) params.push('date=' + encodeURIComponent(dateFilter));
    var qs = params.length ? '?' + params.join('&') : '';
    authFetch('/posts/admin/all' + qs)
      .then(function (data) {
        hideEl('postsLoading');
        showEl('postsPanel');
        var posts = Array.isArray(data) ? data : [];
        renderPosts(posts);
      })
      .catch(function (err) {
        hideEl('postsLoading');
        showEl('postsError');
        document.getElementById('postsError').textContent = err.message;
      });
  }

  function loadReports(includeResolved) {
    showEl('reportsLoading');
    hideEl('reportsError');
    hideEl('reportsPanel');
    authFetch('/posts/reports' + (includeResolved ? '?includeDismissed=true' : ''))
      .then(function (data) {
        hideEl('reportsLoading');
        showEl('reportsPanel');
        var reports = Array.isArray(data) ? data : [];
        renderReports(reports, includeResolved);
      })
      .catch(function (err) {
        hideEl('reportsLoading');
        showEl('reportsError');
        document.getElementById('reportsError').textContent = err.message;
      });
  }

  function loadAppeals() {
    showEl('appealsLoading');
    hideEl('appealsError');
    hideEl('appealsPanel');
    authFetch('/auth/admin/appeals')
      .then(function (data) {
        hideEl('appealsLoading');
        showEl('appealsPanel');
        renderAppeals(data.appeals || []);
      })
      .catch(function (err) {
        hideEl('appealsLoading');
        showEl('appealsError');
        document.getElementById('appealsError').textContent = err.message;
      });
  }

  function loadAuditLog() {
    showEl('auditLoading');
    hideEl('auditError');
    hideEl('auditPanel');
    authFetch('/auth/admin/audit-log')
      .then(function (data) {
        hideEl('auditLoading');
        showEl('auditPanel');
        renderAuditLog(data.log || []);
      })
      .catch(function (err) {
        hideEl('auditLoading');
        showEl('auditError');
        document.getElementById('auditError').textContent = err.message;
      });
  }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof isLoggedIn === 'function' && typeof isAdmin === 'function') {
      if (!isLoggedIn()) {
        window.location.replace('home.html?login=1&return=admin.html');
        return;
      }
      if (!isAdmin(getStoredUser())) {
        window.location.replace('home.html');
        return;
      }
    }
    if (typeof updateNavForUser === 'function') updateNavForUser(getStoredUser());

    loadStats();
    loadAdminPanel();

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(function (c) {
          c.classList.add('hidden');
        });
        var tab = document.getElementById(
          'tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1),
        );
        if (tab) tab.classList.remove('hidden');
        if (btn.dataset.tab === 'reports') loadReports();
        if (btn.dataset.tab === 'posts') loadPosts();
        if (btn.dataset.tab === 'appeals') loadAppeals();
        if (btn.dataset.tab === 'audit') loadAuditLog();
        if (btn.dataset.tab === 'users') loadAdminPanel();
      });
    });

    // Post search + filters
    var postSearch = document.getElementById('postSearch');
    var filterCategory = document.getElementById('filterCategory');
    var filterDate = document.getElementById('filterDate');
    function reloadPosts() {
      loadPosts(
        postSearch.value.trim() || undefined,
        filterCategory.value || undefined,
        filterDate.value || undefined,
      );
    }
    var searchTimer;
    postSearch.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(reloadPosts, 300);
    });
    filterCategory.addEventListener('change', reloadPosts);
    filterDate.addEventListener('change', reloadPosts);

    // User search
    var userSearch = document.getElementById('userSearch');
    var userSearchTimer;
    userSearch.addEventListener('input', function () {
      clearTimeout(userSearchTimer);
      userSearchTimer = setTimeout(function () {
        var term = userSearch.value.trim();
        if (!term) {
          _showBannedOnly = false;
          loadAdminPanel();
          return;
        }
        authFetch('/auth/admin/search-users?q=' + encodeURIComponent(term))
          .then(function (data) {
            var panel = document.getElementById('adminPanel');
            panel.classList.remove('hidden');
            renderUsers(data.users || []);
          })
          .catch(function () {});
      }, 300);
    });

    // Show banned button
    document.getElementById('showBannedBtn').addEventListener('click', function () {
      _showBannedOnly = !_showBannedOnly;
      this.textContent = _showBannedOnly ? 'Show All Users' : 'Show Banned';
      loadAdminPanel();
    });

    // Resolved reports toggle
    var showResolved = false;
    document.getElementById('showResolvedReportsBtn').addEventListener('click', function () {
      showResolved = !showResolved;
      this.textContent = showResolved ? 'Active Reports' : 'Resolved';
      loadReports(showResolved);
    });

    // Logout
    document.getElementById('btnLogout').addEventListener('click', function () {
      if (typeof clearAuth === 'function') clearAuth();
      window.location.href = 'home.html';
    });
  });
})();
