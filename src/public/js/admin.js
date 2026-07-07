(function () {
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showLoading(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }
  function hideLoading(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }
  function showError(id, msg) {
    var el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  }
  function hideError(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }

  function renderUsers(users) {
    var tbody = document.getElementById('adminUsersBody');
    var count = document.getElementById('userCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    count.textContent = users.length + ' users';
    users.forEach(function (user) {
      var isSuspended = user.suspended_until && new Date(user.suspended_until) > new Date();
      var suspendLabel = '';
      if (isSuspended) {
        var until = new Date(user.suspended_until);
        var isPerm = until.getFullYear() >= 2999;
        suspendLabel = isPerm ? ' (Permanently banned)' : ' (Banned until ' + until.toLocaleDateString() + ')';
      }
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' + user.id + '</td>' +
        '<td><strong>' + escapeHtml(user.display_name || user.name) + '</strong>' + (isSuspended ? ' <span class="badge bg-danger">SUSPENDED</span>' : '') + '</td>' +
        '<td>' + escapeHtml(user.email) + '</td>' +
        '<td>' +
          '<select class="form-select form-select-sm role-select" data-user-id="' + user.id + '" style="width:auto;display:inline-block;">' +
            '<option value="user"' + (user.role === 'user' ? ' selected' : '') + '>User</option>' +
            '<option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>Admin</option>' +
          '</select>' +
        '</td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn-action btn-danger-sm me-1 delete-user-btn" data-user-id="' + user.id + '" data-user-name="' + escapeHtml(user.name) + '" title="Delete user"><i class="fas fa-trash-alt"></i></button>' +
          '<button class="btn-action btn-edit-sm unsuspend-user-btn" data-user-id="' + user.id + '" title="Unsuspend user (clear ban)" style="' + (isSuspended ? '' : 'display:none;') + '"><i class="fas fa-unlock"></i></button>' +
        '</td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('.delete-user-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Delete user "' + btn.dataset.userName + '" (ID: ' + btn.dataset.userId + ')? This cannot be undone.')) {
          deleteUser(btn.dataset.userId);
        }
      });
    });
    document.querySelectorAll('.role-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        updateUserRole(sel.dataset.userId, sel.value);
      });
    });
    document.querySelectorAll('.unsuspend-user-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Unsuspend user ID ' + btn.dataset.userId + '?')) {
          unsuspendUser(btn.dataset.userId);
        }
      });
    });
  }

  function renderReports(reports) {
    var tbody = document.getElementById('reportsBody');
    var count = document.getElementById('reportCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    count.textContent = reports.length + ' reports';
    if (reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No reports yet.</td></tr>';
      return;
    }
    reports.forEach(function (r) {
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' + r.id + '</td>' +
        '<td><a href="posts.html?id=' + r.post_id + '" target="_blank" class="text-decoration-none">' + escapeHtml(r.post_title || 'Post #' + r.post_id) + '</a></td>' +
        '<td><span class="badge bg-warning text-dark">' + escapeHtml(r.reason) + '</span></td>' +
        '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(r.description || '') + '">' + (escapeHtml(r.description) || '-') + '</td>' +
        '<td><strong>' + escapeHtml(r.reporter_name) + '</strong><br><small class="text-muted">' + escapeHtml(r.reporter_email) + '</small></td>' +
        '<td><strong>' + escapeHtml(r.post_author_name || 'Unknown') + '</strong> <small class="text-muted">(ID: ' + r.post_author_id + ')</small></td>' +
        '<td><small>' + new Date(r.created_at).toLocaleDateString() + '</small></td>' +
        '<td>' +
          '<div class="dropdown">' +
            '<button class="btn-action btn-danger-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" title="Ban user"><i class="fas fa-gavel"></i></button>' +
            '<ul class="dropdown-menu dropdown-menu-end p-2" style="min-width:200px;">' +
              '<li><button class="dropdown-item ban-user-btn" data-user-id="' + r.post_author_id + '" data-hours="1">Ban 1 hour</button></li>' +
              '<li><button class="dropdown-item ban-user-btn" data-user-id="' + r.post_author_id + '" data-hours="6">Ban 6 hours</button></li>' +
              '<li><button class="dropdown-item ban-user-btn" data-user-id="' + r.post_author_id + '" data-hours="24">Ban 24 hours</button></li>' +
              '<li><button class="dropdown-item ban-user-btn" data-user-id="' + r.post_author_id + '" data-hours="72">Ban 3 days</button></li>' +
              '<li><button class="dropdown-item ban-user-btn" data-user-id="' + r.post_author_id + '" data-hours="168">Ban 7 days</button></li>' +
              '<li><button class="dropdown-item ban-user-btn" data-user-id="' + r.post_author_id + '" data-hours="720">Ban 30 days</button></li>' +
              '<li><hr class="dropdown-divider"></li>' +
              '<li><button class="dropdown-item text-danger ban-user-btn" data-user-id="' + r.post_author_id + '" data-hours="0">Ban permanently</button></li>' +
            '</ul>' +
          '</div>' +
        '</td>' +
        '<td><button class="btn-action btn-danger-sm delete-post-btn" data-post-id="' + r.post_id + '" title="Delete post"><i class="fas fa-trash-alt"></i></button></td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('.ban-user-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var hours = parseInt(btn.dataset.hours, 10);
        var label = btn.textContent.trim();
        if (confirm('Suspend user ID ' + btn.dataset.userId + ' for "' + label + '"?')) {
          banUser(btn.dataset.userId, hours);
        }
      });
    });
    document.querySelectorAll('.delete-post-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Delete this post? This will also remove associated reports.')) {
          deletePost(btn.dataset.postId);
        }
      });
    });
  }

  function renderStats(stats) {
    var el = document.getElementById('adminStats');
    if (!el) return;
    var users = stats.users || 0;
    var posts = stats.posts || 0;
    var reports = stats.reports || 0;
    el.innerHTML =
      '<div class="row g-3 mb-4">' +
        '<div class="col-md-3 col-6"><div class="admin-card"><div class="admin-card-body text-center"><h3 class="fw-bold text-primary mb-0">' + users + '</h3><small class="text-muted">Total Users</small></div></div></div>' +
        '<div class="col-md-3 col-6"><div class="admin-card"><div class="admin-card-body text-center"><h3 class="fw-bold text-success mb-0">' + posts + '</h3><small class="text-muted">Total Posts</small></div></div></div>' +
        '<div class="col-md-3 col-6"><div class="admin-card"><div class="admin-card-body text-center"><h3 class="fw-bold text-warning mb-0">' + reports + '</h3><small class="text-muted">Total Reports</small></div></div></div>' +
        '<div class="col-md-3 col-6"><div class="admin-card"><div class="admin-card-body text-center"><h3 class="fw-bold text-danger mb-0">' + (stats.suspended || 0) + '</h3><small class="text-muted">Suspended Users</small></div></div></div>' +
      '</div>';
  }

  function deleteUser(userId) {
    return authFetch('/auth/admin/users/' + userId, { method: 'DELETE' })
      .then(function () { loadAdminPanel(); })
      .catch(function (err) { alert('Failed to delete user: ' + err.message); });
  }

  function updateUserRole(userId, role) {
    authFetch('/auth/admin/users/' + userId, {
      method: 'PUT',
      body: JSON.stringify({ role: role })
    }).then(function () { loadAdminPanel(); })
      .catch(function (err) { alert('Failed to update role: ' + err.message); });
  }

  function banUser(userId, hours) {
    authFetch('/auth/admin/ban', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, duration_hours: hours || null })
    }).then(function (data) {
      alert(data.message);
      loadReports();
    }).catch(function (err) { alert('Failed to ban user: ' + err.message); });
  }

  function deletePost(postId) {
    authFetch('/posts/' + postId, { method: 'DELETE' })
      .then(function () { loadReports(); })
      .catch(function (err) { alert('Failed to delete post: ' + err.message); });
  }

  function unsuspendUser(userId) {
    authFetch('/auth/admin/unsuspend', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId })
    }).then(function (data) {
      alert(data.message);
      loadAdminPanel();
      loadStats();
    }).catch(function (err) { alert('Failed to unsuspend user: ' + err.message); });
  }

  async function loadAdminPanel() {
    showLoading('adminLoading');
    hideError('adminError');
    var panel = document.getElementById('adminPanel');
    if (panel) panel.classList.add('hidden');

    try {
      var data = await authFetch('/auth/admin/users');
      hideLoading('adminLoading');
      if (panel) panel.classList.remove('hidden');
      renderUsers(data.users || []);
    } catch (err) {
      hideLoading('adminLoading');
      showError('adminError', err.message);
    }
  }

  async function loadStats() {
    try {
      var data = await authFetch('/auth/admin/stats');
      renderStats(data);
    } catch (e) { /* stats optional */ }
  }

  async function loadReports() {
    showLoading('reportsLoading');
    hideError('reportsError');
    var panel = document.getElementById('reportsPanel');
    if (panel) panel.classList.add('hidden');

    try {
      var reports = await authFetch('/posts/reports');
      hideLoading('reportsLoading');
      if (panel) panel.classList.remove('hidden');
      renderReports(reports);
    } catch (err) {
      hideLoading('reportsLoading');
      showError('reportsError', err.message);
    }
  }

  function renderPosts(posts) {
    var tbody = document.getElementById('adminPostsBody');
    var count = document.getElementById('postCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    count.textContent = posts.length + ' posts';
    if (posts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No posts found.</td></tr>';
      return;
    }
    posts.forEach(function (p) {
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' + p.id + '</td>' +
        '<td><a href="posts.html?id=' + p.id + '" target="_blank" class="text-decoration-none fw-semibold">' + escapeHtml(p.title || 'Untitled') + '</a></td>' +
        '<td>' + escapeHtml(p.author_name || 'Unknown') + '</td>' +
        '<td><span class="badge bg-light text-dark">' + escapeHtml(p.category || '-') + '</span></td>' +
        '<td><small>' + new Date(p.created_at).toLocaleDateString() + '</small></td>' +
        '<td><button class="btn-action btn-danger-sm delete-post-btn" data-post-id="' + p.id + '" title="Delete post"><i class="fas fa-trash-alt"></i></button></td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('#adminPostsBody .delete-post-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Delete post #' + btn.dataset.postId + '? This cannot be undone.')) {
          authFetch('/posts/' + btn.dataset.postId, { method: 'DELETE' })
            .then(function () { loadPosts(); loadStats(); })
            .catch(function (err) { alert('Failed to delete post: ' + err.message); });
        }
      });
    });
  }

  var _allPosts = [];

  function loadPosts(searchTerm) {
    showLoading('postsLoading');
    hideError('postsError');
    var panel = document.getElementById('postsPanel');
    if (panel) panel.classList.add('hidden');

    var url = '/posts/admin/all';
    if (searchTerm) url += '?search=' + encodeURIComponent(searchTerm);

    authFetch(url)
      .then(function (data) {
        hideLoading('postsLoading');
        if (panel) panel.classList.remove('hidden');
        _allPosts = Array.isArray(data) ? data : [];
        renderPosts(_allPosts);
      })
      .catch(function (err) {
        hideLoading('postsLoading');
        showError('postsError', err.message);
      });
  }

  function redirectIfNotAdmin() {
    if (typeof isLoggedIn !== 'function' || typeof isAdmin !== 'function') return;
    if (!isLoggedIn()) {
      window.location.replace('home.html?login=1&return=admin.html');
      return true;
    }
    if (!isAdmin(getStoredUser())) {
      window.location.replace('home.html');
      return true;
    }
    return false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (redirectIfNotAdmin()) return;

    if (typeof updateNavForUser === 'function') {
      updateNavForUser(getStoredUser());
    }

    loadStats();
    loadAdminPanel();

    document.getElementById('tabUsers').addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.getElementById('tabUsers').classList.add('active');
      document.getElementById('adminUsersSection').classList.remove('hidden');
      document.getElementById('adminReportsSection').classList.add('hidden');
    });

    document.getElementById('tabPosts').addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.getElementById('tabPosts').classList.add('active');
      document.getElementById('adminUsersSection').classList.add('hidden');
      document.getElementById('adminPostsSection').classList.remove('hidden');
      document.getElementById('adminReportsSection').classList.add('hidden');
      loadPosts();
    });

    document.getElementById('tabReports').addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.getElementById('tabReports').classList.add('active');
      document.getElementById('adminUsersSection').classList.add('hidden');
      document.getElementById('adminPostsSection').classList.add('hidden');
      document.getElementById('adminReportsSection').classList.remove('hidden');
      loadReports();
    });

    var addBtn = document.getElementById('addUserBtn');
    if (addBtn) {
      addBtn.addEventListener('click', async function () {
        var name = document.getElementById('newUserName').value.trim();
        var email = document.getElementById('newUserEmail').value.trim();
        var password = document.getElementById('newUserPassword').value;
        var role = document.getElementById('newUserRole').value;
        if (!name || !email || !password) { alert('Please fill in all fields.'); return; }
        try {
          await authFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name: name, email: email, password: password, role: role })
          });
          alert('User created successfully.');
          document.getElementById('newUserName').value = '';
          document.getElementById('newUserEmail').value = '';
          document.getElementById('newUserPassword').value = '';
          loadAdminPanel();
          loadStats();
        } catch (err) {
          alert('Failed to create user: ' + err.message);
        }
      });
    }

    var postSearch = document.getElementById('postSearch');
    if (postSearch) {
      var searchTimer;
      postSearch.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          var term = postSearch.value.trim();
          loadPosts(term || undefined);
        }, 300);
      });
    }

    var logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        if (typeof clearAuth === 'function') clearAuth();
        window.location.href = 'home.html';
      });
    }
  });
})();