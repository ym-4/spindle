(function () {
  function esc(t) { var d = document.createElement('div'); d.textContent = t ?? ''; return d.innerHTML; }

  var _confirmCallback = null, _confirmStep2 = null;
  var _pendingBanUserId = null, _showBannedOnly = false;
  var _selectedUserIds = {};
  var _breadcrumbStack = [];
  var _cmdBuffer = '';
  var _cmdTimer = null;
  var _filterPresets = JSON.parse(localStorage.getItem('adminFilterPresets') || '{}');

  function hideEl(id) { var e = byId(id); if (e) e.classList.add('hidden'); }
  function showEl(id) { var e = byId(id); if (e) e.classList.remove('hidden'); }
  function byId(id) { return document.getElementById(id); }
  function hasClass(el, c) { return el.classList.contains(c); }
  function toggleClass(el, c, force) { el.classList.toggle(c, force); }

  // ---- Theme ----
  function applyTheme(theme) { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('adminTheme', theme); }
  function applyAccessibility(on) {
    var val = on ? 'on' : 'off';
    document.documentElement.setAttribute('data-accessibility', val);
    localStorage.setItem('adminAccessibility', val);
    // Show/hide a visible indicator
    var indicator = byId('accIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'accIndicator';
      indicator.style.cssText = 'position:fixed;bottom:8px;right:8px;background:var(--accent);color:#fff;font-size:0.7rem;padding:0.2rem 0.6rem;border-radius:6px;z-index:9999;';
      document.body.appendChild(indicator);
    }
    indicator.textContent = val === 'on' ? 'High Contrast ON' : '';
    indicator.style.display = val === 'on' ? 'block' : 'none';
  }

  // ---- Skeleton loader ----
  function renderSkeleton(rows, cols) {
    var h = '';
    for (var r = 0; r < rows; r++) { h += '<div class="skel-row">'; for (var c = 0; c < cols; c++) { h += '<div class="skel-cell skel" style="flex:' + (c === 0 ? 1 : 2) + ';height:1rem;"></div>'; } h += '</div>'; }
    return h;
  }
  function showSkeleton(id, rows, cols) {
    var el = byId(id); if (!el) return;
    el.classList.remove('hidden');
    el.innerHTML = '<div class="admin-card-body">' + renderSkeleton(rows || 5, cols || 5) + '</div>';
  }
  function hideSkeleton(id) { var el = byId(id); if (el) el.classList.add('hidden'); }

  // ---- Empty state ----
  function emptyState(icon, text) { return '<div class="empty-state"><i class="fas fa-' + icon + '"></i><p>' + esc(text) + '</p></div>'; }

  // ---- CSV export ----
  function exportCSV(filename, headers, rows) {
    var csv = headers.join(',') + '\n';
    rows.forEach(function(r) { csv += r.map(function(v) { var s = String(v ?? '').replace(/"/g, '""'); return s.indexOf(',') >= 0 ? '"' + s + '"' : s; }).join(',') + '\n'; });
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Confirmation modal ----
  function openConfirm(title, desc, cb, opts) {
    opts = opts || {};
    byId('confirmTitle').textContent = title;
    byId('confirmDesc').innerHTML = desc;
    var extra = byId('confirmExtra'), input = byId('confirmInput');
    if (opts.requireTyping) { extra.classList.remove('hidden'); byId('confirmTypeWord').textContent = opts.requireTyping; input.value = ''; input.placeholder = 'Type "' + opts.requireTyping + '"'; }
    else { extra.classList.add('hidden'); }
    _confirmCallback = cb; _confirmStep2 = opts.requireTyping || null;
    showEl('confirmModal'); input.focus();
  }
  byId('confirmCancel').addEventListener('click', function () { hideEl('confirmModal'); _confirmCallback = null; _confirmStep2 = null; });
  byId('confirmOk').addEventListener('click', function () {
    if (_confirmStep2) { var val = byId('confirmInput').value.trim(); if (val !== _confirmStep2) { alert('Type "' + _confirmStep2 + '" to confirm.'); return; } }
    hideEl('confirmModal'); if (typeof _confirmCallback === 'function') _confirmCallback(); _confirmCallback = null; _confirmStep2 = null;
  });
  byId('confirmInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') byId('confirmOk').click(); });

  // ---- Ban modal ----
  byId('banReasonSelect').addEventListener('change', function () { var txt = byId('banReasonText'); this.value === 'Other' ? txt.classList.remove('hidden') : txt.classList.add('hidden'); });
  byId('banCancel').addEventListener('click', function () { hideEl('banModal'); _pendingBanUserId = null; });
  byId('banConfirm').addEventListener('click', function () {
    var uid = _pendingBanUserId; if (!uid) return;
    var duration = parseInt(byId('banDuration').value, 10);
    var reason = byId('banReasonSelect').value;
    if (!reason) { alert('Please select a ban reason.'); return; }
    if (reason === 'Other') { var custom = byId('banReasonText').value.trim(); if (!custom) { alert('Please enter a reason.'); return; } reason = custom; }
    hideEl('banModal'); _pendingBanUserId = null;
    executeBan(uid, duration, reason);
  });
  function openBanModal(userId, label) { _pendingBanUserId = userId; byId('banUserLabel').textContent = 'Ban ' + label + ' (ID: ' + userId + ')'; byId('banDuration').value = '1'; byId('banReasonSelect').value = ''; byId('banReasonText').value = ''; byId('banReasonText').classList.add('hidden'); showEl('banModal'); }
  function executeBan(userId, hours, reason) {
    // Handle both single and bulk (array) bans
    var ids = Array.isArray(userId) ? userId : [userId];
    var done = 0;
    ids.forEach(function (id) {
      authFetch('/auth/admin/ban-with-reason', { method: 'POST', body: JSON.stringify({ user_id: parseInt(id, 10), duration_hours: hours || null, reason: reason }) }).then(function () { done++; if (done === ids.length) { _selectedUserIds = {}; loadReports(); loadStats(); loadAdminPanel(); } }).catch(function (err) { done++; if (done === ids.length) { alert('Ban failed for some users: ' + err.message); } });
    });
  }

  // ---- Breadcrumb ----
  function setBreadcrumb(items) {
    _breadcrumbStack = items;
    var el = byId('breadcrumb');
    if (!items || items.length === 0) { el.innerHTML = ''; return; }
    var h = '';
    for (var i = 0; i < items.length; i++) {
      if (i > 0) h += '<span class="bc-sep">/</span>';
      if (i === items.length - 1) h += '<span class="bc-current">' + esc(items[i].label) + '</span>';
      else h += '<span class="bc-link" data-idx="' + i + '">' + esc(items[i].label) + '</span>';
    }
    el.innerHTML = h;
    el.querySelectorAll('.bc-link').forEach(function (link) { link.addEventListener('click', function () { var idx = parseInt(link.dataset.idx, 10); var item = _breadcrumbStack[idx]; if (item && item.action) item.action(); }); });
  }

  // ---- Command palette (global search) ----
  byId('btnCmdPalette').addEventListener('click', function () { openCmdPalette(); });
  function openCmdPalette() { showEl('cmdOverlay'); setTimeout(function () { byId('cmdInput').value = ''; byId('cmdResults').innerHTML = ''; byId('cmdInput').focus(); }, 50); }
  function closeCmdPalette() { hideEl('cmdOverlay'); }
  byId('cmdOverlay').addEventListener('click', function (e) { if (e.target.id === 'cmdOverlay') closeCmdPalette(); });
  byId('cmdInput').addEventListener('input', function () {
    var q = this.value.trim();
    clearTimeout(_cmdTimer);
    if (q.length < 1) { byId('cmdResults').innerHTML = ''; return; }
    _cmdTimer = setTimeout(function () { performGlobalSearch(q); }, 250);
  });
  byId('cmdInput').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCmdPalette();
    if (e.key === 'Enter') { var items = byId('cmdResults').querySelectorAll('.cmd-item'); if (items.length > 0) items[0].click(); }
  });
  function performGlobalSearch(q) {
    authFetch('/auth/admin/global-search?q=' + encodeURIComponent(q)).then(function (data) {
      var el = byId('cmdResults');
      if (!data || (!data.users.length && !data.posts.length && !data.reports.length)) { el.innerHTML = '<div class="cmd-empty"><i class="fas fa-search me-2"></i>No results for "' + esc(q) + '"</div>'; return; }
      var h = '';
      if (data.users.length) {
        h += '<div class="cmd-group"><div class="cmd-group-label"><i class="fas fa-users me-1"></i>Users</div>';
        data.users.forEach(function (u) { h += '<div class="cmd-item" data-type="user" data-id="' + u.id + '"><span class="cmd-type">User</span><strong>' + esc(u.display_name || u.name) + '</strong><span class="text-muted small">' + esc(u.email) + '</span></div>'; });
        h += '</div>';
      }
      if (data.posts.length) {
        h += '<div class="cmd-group"><div class="cmd-group-label"><i class="fas fa-newspaper me-1"></i>Posts</div>';
        data.posts.forEach(function (p) { h += '<div class="cmd-item" data-type="post" data-id="' + p.id + '"><span class="cmd-type">Post</span><strong>' + esc(p.title || 'Untitled') + '</strong><span class="text-muted small"> by ' + esc(p.author_name) + '</span></div>'; });
        h += '</div>';
      }
      if (data.reports.length) {
        h += '<div class="cmd-group"><div class="cmd-group-label"><i class="fas fa-flag me-1"></i>Reports</div>';
        data.reports.forEach(function (r) { h += '<div class="cmd-item" data-type="report" data-id="' + r.id + '" data-post-id="' + r.post_id + '"><span class="cmd-type">Report</span><strong>#' + r.id + ' - ' + esc(r.reason) + '</strong><span class="text-muted small"> by ' + esc(r.reporter_name) + '</span></div>'; });
        h += '</div>';
      }
      el.innerHTML = h;
      el.querySelectorAll('.cmd-item').forEach(function (item) {
        item.addEventListener('click', function () {
          closeCmdPalette();
          var type = item.dataset.type, id = item.dataset.id;
          if (type === 'user') { openUserPanel(parseInt(id, 10)); }
          else if (type === 'post') { switchTab('posts'); }
          else if (type === 'report') { switchTab('reports'); }
        });
      });
    }).catch(function () { byId('cmdResults').innerHTML = '<div class="cmd-empty">Search failed.</div>'; });
  }

  // ---- Keyboard shortcuts ----
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeCmdPalette(); hideEl('confirmModal'); hideEl('banModal'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openCmdPalette(); return; }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    _cmdBuffer += e.key.toLowerCase();
    clearTimeout(_cmdTimer);
    _cmdTimer = setTimeout(function () { _cmdBuffer = ''; }, 800);
    if (_cmdBuffer === 'gu') { _cmdBuffer = ''; switchTab('users'); }
    else if (_cmdBuffer === 'gp') { _cmdBuffer = ''; switchTab('posts'); }
    else if (_cmdBuffer === 'gr') { _cmdBuffer = ''; switchTab('reports'); }
    else if (_cmdBuffer === 'ga') { _cmdBuffer = ''; switchTab('appeals'); }
    else if (_cmdBuffer === 'gl') { _cmdBuffer = ''; switchTab('audit'); }
  });

  // ---- Side panel (user drill-down) ----
  byId('spClose').addEventListener('click', closeSidePanel);
  byId('spOverlay').addEventListener('click', closeSidePanel);
  function closeSidePanel() { hideEl('sidePanel'); hideEl('spOverlay'); setBreadcrumb(null); }
  function openUserPanel(userId) {
    showEl('spOverlay');
    byId('spContent').innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    showEl('sidePanel');
    setBreadcrumb([{ label: 'Users', action: function () { closeSidePanel(); switchTab('users'); } }, { label: 'User #' + userId, action: null }]);
    authFetch('/auth/admin/users/' + userId + '/activity').then(function (data) {
      var h = '<h3>User Activity <small class="text-muted" style="font-weight:400;font-size:0.85rem;">#ID: ' + userId + '</small></h3>';
      // Posts
      h += '<div class="side-panel-section"><h6><i class="fas fa-newspaper me-1"></i>Posts (' + (data.posts || []).length + ')</h6>';
      if (!data.posts || data.posts.length === 0) h += '<div class="text-muted small">No posts.</div>';
      else { data.posts.forEach(function (p) { h += '<div class="sp-item"><span>' + esc(p.title || 'Untitled') + '</span><span class="badge bg-light text-dark">' + esc(p.category || '-') + '</span></div>'; }); }
      h += '</div>';
      // Reports against
      h += '<div class="side-panel-section"><h6><i class="fas fa-flag me-1"></i>Reports Against (' + (data.reports_against || []).length + ')</h6>';
      if (!data.reports_against || data.reports_against.length === 0) h += '<div class="text-muted small">No reports.</div>';
      else { data.reports_against.forEach(function (r) { h += '<div class="sp-item"><span>' + esc(r.reason) + '</span><span class="small text-muted">' + new Date(r.created_at).toLocaleDateString() + '</span></div>'; }); }
      h += '</div>';
      // Bans
      h += '<div class="side-panel-section"><h6><i class="fas fa-ban me-1"></i>Ban History (' + (data.bans || []).length + ')</h6>';
      if (!data.bans || data.bans.length === 0) h += '<div class="text-muted small">No bans.</div>';
      else { data.bans.forEach(function (b) { var d = b.suspended_until ? new Date(b.suspended_until) : null; var isPerm = d && d.getFullYear() >= 2999; h += '<div class="sp-item"><span>' + esc(b.banned_reason || '-') + '</span><span class="badge ' + (isPerm ? 'badge-danger' : 'badge-warning') + '">' + (isPerm ? 'Permanent' : (d ? d.toLocaleDateString() : 'Unknown')) + '</span></div>'; }); }
      h += '</div>';
      // Appeals
      h += '<div class="side-panel-section"><h6><i class="fas fa-gavel me-1"></i>Appeals (' + (data.appeals || []).length + ')</h6>';
      if (!data.appeals || data.appeals.length === 0) h += '<div class="text-muted small">No appeals.</div>';
      else { data.appeals.forEach(function (a) { h += '<div class="sp-item"><span>' + esc(a.message) + '</span><span class="badge ' + (a.status === 'pending' ? 'badge-warning' : 'badge-secondary') + '">' + esc(a.status) + '</span></div>'; }); }
      h += '</div>';
      byId('spContent').innerHTML = h;
    }).catch(function () { byId('spContent').innerHTML = '<div class="text-center py-4 text-danger">Failed to load user data.</div>'; });
  }

  // ---- Priority strip ----
  function updatePriorityStrip(stats, reports, appeals) {
    var el = byId('priorityStrip');
    var pendingReports = 0, pendingAppeals = 0;
    if (reports) { reports.forEach(function (r) { if (!r.dismissed) pendingReports++; }); }
    if (appeals) { appeals.forEach(function (a) { if (a.status === 'pending') pendingAppeals++; }); }
    if (pendingReports === 0 && pendingAppeals === 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    var h = '<i class="fas fa-exclamation-triangle text-danger me-1"></i><strong>Needs Attention:</strong>';
    if (pendingReports > 0) h += '<span class="strip-item"><span class="badge bg-danger">' + pendingReports + ' pending report' + (pendingReports > 1 ? 's' : '') + '</span><button class="strip-action" data-tab="reports">Review</button></span>';
    if (pendingAppeals > 0) h += '<span class="strip-item"><span class="badge bg-warning text-dark">' + pendingAppeals + ' pending appeal' + (pendingAppeals > 1 ? 's' : '') + '</span><button class="strip-action" data-tab="appeals">Review</button></span>';
    el.innerHTML = h;
    el.querySelectorAll('.strip-action').forEach(function (btn) { btn.addEventListener('click', function () { switchTab(btn.dataset.tab); }); });
  }

  // ---- User bulk actions ----
  function updateBulkBar() {
    var ids = Object.keys(_selectedUserIds);
    var countEl = byId('bulkUserCount'), bar = byId('bulkUserBar');
    if (ids.length === 0) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    countEl.textContent = ids.length + ' selected';
  }
  byId('bulkUserClear').addEventListener('click', function () { _selectedUserIds = {}; updateBulkBar(); renderUsers(_lastUsers || []); });
  byId('bulkUserDelete').addEventListener('click', function () {
    var ids = Object.keys(_selectedUserIds);
    if (ids.length === 0) return;
    openConfirm('Delete Users', 'Delete ' + ids.length + ' user' + (ids.length > 1 ? 's' : '') + '? This cannot be undone.', function () {
      var done = 0; ids.forEach(function (id) { authFetch('/auth/admin/users/' + id, { method: 'DELETE' }).then(function () { done++; if (done === ids.length) { _selectedUserIds = {}; loadAdminPanel(); loadStats(); } }).catch(function () { done++; }); });
    }, { requireTyping: 'DELETE' });
  });
  byId('bulkUserBan').addEventListener('click', function () {
    var ids = Object.keys(_selectedUserIds);
    if (ids.length === 0) return;
    openBanModal(ids[0], ids.length + ' users');
    _pendingBanUserId = ids;
  });

  // ---- Filter presets ----
  function renderPresetChips(containerId, presets, activeKey, onClick) {
    var el = byId(containerId); if (!el) return;
    if (!presets || presets.length === 0) { el.innerHTML = ''; return; }
    var h = '';
    presets.forEach(function (p, i) {
      var key = p.key || i;
      h += '<span class="filter-chip' + (key === activeKey ? ' active' : '') + '" data-key="' + key + '">' + esc(p.label) + '<span class="chip-remove" data-key="' + key + '">&times;</span></span>';
    });
    el.innerHTML = h;
    el.querySelectorAll('.filter-chip:not(.chip-remove)').forEach(function (chip) {
      chip.addEventListener('click', function (e) { if (e.target.classList.contains('chip-remove')) return; if (typeof onClick === 'function') onClick(chip.dataset.key); });
    });
    el.querySelectorAll('.chip-remove').forEach(function (rm) {
      rm.addEventListener('click', function (e) { e.stopPropagation(); var key = rm.dataset.key; var idx = parseInt(key, 10); if (!isNaN(idx) && _filterPresets.users) { _filterPresets.users.splice(idx, 1); localStorage.setItem('adminFilterPresets', JSON.stringify(_filterPresets)); renderUserPresets(); } });
    });
  }

  // ---- Tab switching ----
  var _lastUsers = null;
  function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.toggle('hidden', c.id !== 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1)); });
    if (tab === 'reports') loadReports();
    else if (tab === 'posts') loadPosts();
    else if (tab === 'appeals') loadAppeals();
    else if (tab === 'audit') loadAuditLog();
    else if (tab === 'users') loadAdminPanel();
    setBreadcrumb([{ label: tab.charAt(0).toUpperCase() + tab.slice(1), action: null }]);
  }
  document.querySelectorAll('.tab-btn').forEach(function (btn) { btn.addEventListener('click', function () { switchTab(btn.dataset.tab); }); });

  // ---- Render functions ----
  function renderUsers(users) {
    _lastUsers = users;
    var tbody = byId('adminUsersBody'), count = byId('userCount');
    if (!tbody) return;
    tbody.innerHTML = '';
    count.textContent = users.length + ' user' + (users.length !== 1 ? 's' : '');
    if (users.length === 0) { tbody.innerHTML = '<tr><td colspan="8">' + emptyState('users', 'No users found.') + '</td></tr>'; return; }
    users.forEach(function (u) {
      var isSuspended = u.suspended_until && new Date(u.suspended_until) > new Date();
      var until = isSuspended ? new Date(u.suspended_until) : null;
      var isPerm = until && until.getFullYear() >= 2999;
      var susLabel = isSuspended ? (isPerm ? 'Permanent Ban' : 'Banned until ' + until.toLocaleDateString()) : '';
      var roleClass = 'role-badge--' + (u.role || 'user');
      var joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : '-';
      var checked = _selectedUserIds[u.id] || false;
      var rowClass = isSuspended ? 'row-ban' : 'row-ok';
      var row = document.createElement('tr');
      row.className = rowClass;
      row.innerHTML =
        '<td><input type="checkbox" class="user-cb" data-id="' + u.id + '"' + (checked ? ' checked' : '') + '></td>' +
        '<td>' + u.id + '</td>' +
        '<td><a href="#" class="user-name-link text-decoration-none fw-semibold" data-id="' + u.id + '" style="color:var(--accent);">' + esc(u.display_name || u.name) + '</a></td>' +
        '<td>' + esc(u.email) + '</td>' +
        '<td><span class="role-badge ' + roleClass + '">' + esc(u.role || 'user') + '</span></td>' +
        '<td><small class="text-muted">' + joined + '</small></td>' +
        '<td>' + (isSuspended ? '<span class="badge badge-danger">' + susLabel + '</span>' : '<span class="badge badge-ok" style="background:#e6f9ee;color:var(--success);">Active</span>') + '</td>' +
        '<td style="white-space:nowrap;">' +
          '<button class="btn-action btn-edit-sm me-1 view-user-btn" data-id="' + u.id + '" title="View activity"><i class="fas fa-eye"></i></button>' +
          '<button class="btn-action btn-danger-sm me-1 delete-user-btn" data-user-id="' + u.id + '" data-user-name="' + esc(u.display_name || u.name) + '" title="Delete"><i class="fas fa-trash-alt"></i></button>' +
          (isSuspended ? '<button class="btn-action btn-success-sm unsuspend-user-btn" data-user-id="' + u.id + '" title="Unsuspend"><i class="fas fa-unlock"></i></button>' : '') +
        '</td>';
      tbody.appendChild(row);
    });
    // Select all
    var selectAll = byId('userSelectAll');
    if (selectAll) {
      selectAll.checked = users.length > 0 && users.every(function (u) { return _selectedUserIds[u.id]; });
      selectAll.addEventListener('change', function () {
        users.forEach(function (u) { if (selectAll.checked) _selectedUserIds[u.id] = true; else delete _selectedUserIds[u.id]; });
        tbody.querySelectorAll('.user-cb').forEach(function (cb) { cb.checked = selectAll.checked; });
        updateBulkBar();
      });
    }
    tbody.querySelectorAll('.user-cb').forEach(function (cb) {
      cb.addEventListener('change', function () { if (cb.checked) _selectedUserIds[cb.dataset.id] = true; else delete _selectedUserIds[cb.dataset.id]; updateBulkBar(); });
    });
    bindUserActions();
  }

  function renderBannedUsers(users) {
    _lastUsers = users;
    var tbody = byId('adminUsersBody'), count = byId('userCount');
    if (!tbody) return;
    tbody.innerHTML = ''; count.textContent = users.length + ' banned';
    if (users.length === 0) { tbody.innerHTML = '<tr><td colspan="8">' + emptyState('check-circle', 'No banned users.') + '</td></tr>'; return; }
    users.forEach(function (u) {
      var until = new Date(u.suspended_until); var isPerm = until.getFullYear() >= 2999;
      var roleClass = 'role-badge--' + (u.role || 'user');
      var row = document.createElement('tr'); row.className = 'row-ban';
      row.innerHTML =
        '<td></td><td>' + u.id + '</td>' +
        '<td><a href="#" class="user-name-link text-decoration-none fw-semibold" data-id="' + u.id + '" style="color:var(--accent);">' + esc(u.display_name || u.name) + '</a></td>' +
        '<td>' + esc(u.email) + '</td>' +
        '<td><span class="role-badge ' + roleClass + '">' + esc(u.role || 'user') + '</span></td>' +
        '<td><small class="text-muted">-</small></td>' +
        '<td><span class="badge badge-danger">' + (isPerm ? 'Permanent' : 'Until ' + until.toLocaleDateString()) + '</span></td>' +
        '<td><button class="btn-action btn-success-sm unsuspend-user-btn" data-user-id="' + u.id + '"><i class="fas fa-unlock"></i> Revert</button></td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('.unsuspend-user-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConfirm('Unsuspend User', 'Lift the ban on user ID <strong>' + btn.dataset.userId + '</strong>?', function () {
          authFetch('/auth/admin/unsuspend', { method: 'POST', body: JSON.stringify({ user_id: btn.dataset.userId }) }).then(function () { loadAdminPanel(); loadStats(); }).catch(function (err) { alert(err.message); });
        });
      });
    });
    tbody.querySelectorAll('.user-name-link').forEach(function (link) { link.addEventListener('click', function (e) { e.preventDefault(); openUserPanel(parseInt(link.dataset.id, 10)); }); });
  }

  function renderStats(stats, trends) {
    var el = byId('adminStats'); if (!el) return;
    var s = stats || {}, t = trends || {};
    function trendHtml(val) {
      if (val === undefined || val === null) return '';
      var n = parseInt(val, 10);
      var icon = n >= 0 ? 'arrow-up' : 'arrow-down';
      var cls = n >= 0 ? 'text-success' : 'text-danger';
      return '<div class="trend ' + cls + '"><i class="fas fa-' + icon + ' me-1"></i>' + (n >= 0 ? '+' : '') + n + ' this week</div>';
    }
    el.innerHTML =
      '<div class="col-md-3 col-6"><div class="stat-card"><div class="num" style="color:var(--accent);">' + (s.users || 0) + '</div>' + trendHtml(t.users_7d) + '<div class="label">Total Users</div></div></div>' +
      '<div class="col-md-3 col-6"><div class="stat-card"><div class="num" style="color:var(--success);">' + (s.posts || 0) + '</div>' + trendHtml(t.posts_7d) + '<div class="label">Total Posts</div></div></div>' +
      '<div class="col-md-3 col-6"><div class="stat-card"><div class="num" style="color:var(--warning);">' + (s.reports || 0) + '</div>' + trendHtml(t.reports_7d) + '<div class="label">Total Reports</div></div></div>' +
      '<div class="col-md-3 col-6"><div class="stat-card"><div class="num" style="color:var(--danger);">' + (s.suspended || 0) + '</div><div class="label">Suspended Users</div></div></div>';
  }

  function renderReports(reports, showResolved) {
    var tbody = byId('reportsBody'), count = byId('reportCount');
    if (!tbody) return;
    // Sort: undismissed first, then by severity
    var severity = { 'Harassment': 1, 'Inappropriate Content': 2, 'Spam': 3 };
    reports.sort(function (a, b) {
      if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
      return (severity[a.reason] || 99) - (severity[b.reason] || 99);
    });
    tbody.innerHTML = ''; count.textContent = reports.length + ' report' + (reports.length !== 1 ? 's' : '');
    if (reports.length === 0) { tbody.innerHTML = '<tr><td colspan="8">' + emptyState('flag', 'All caught up — no reports to review.') + '</td></tr>'; return; }
    reports.forEach(function (r) {
      var isDismissed = r.dismissed;
      var severityClass = 'row-default';
      if (!isDismissed) {
        if (r.reason === 'Harassment' || r.reason === 'Inappropriate Content') severityClass = 'row-ban';
        else if (r.reason === 'Spam') severityClass = 'row-warning';
      }
      var reasonBadge = 'badge-warning';
      if (r.reason === 'Harassment') reasonBadge = 'badge-danger';
      else if (r.reason === 'Spam') reasonBadge = 'badge-secondary';
      else if (isDismissed) reasonBadge = 'badge-secondary';
      var row = document.createElement('tr'); row.className = severityClass;
      row.innerHTML =
        '<td>' + r.id + '</td>' +
        '<td><a href="posts.html?id=' + r.post_id + '" target="_blank" class="text-decoration-none">' + esc(r.post_title || 'Post #' + r.post_id) + '</a></td>' +
        '<td><span class="badge ' + reasonBadge + '">' + esc(r.reason) + '</span></td>' +
        '<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(r.description || '') + '">' + esc(r.description || '-') + '</td>' +
        '<td><strong>' + esc(r.reporter_name) + '</strong></td>' +
        '<td><strong>' + esc(r.post_author_name || 'Unknown') + '</strong> <small class="text-muted">(ID: ' + r.post_author_id + ')</small></td>' +
        '<td><small>' + new Date(r.created_at).toLocaleDateString() + '</small></td>' +
        '<td style="white-space:nowrap;">' + (isDismissed ? '<span class="badge badge-dismissed">Dismissed</span>' :
          '<div class="dropdown d-inline-block me-1">' +
            '<button class="btn-action btn-danger-sm dropdown-toggle" type="button" data-bs-toggle="dropdown"><i class="fas fa-gavel"></i></button>' +
            '<ul class="dropdown-menu dropdown-menu-end p-2" style="min-width:200px;">' +
              '<li><button class="dropdown-item ban-btn" data-user-id="' + r.post_author_id + '" data-name="' + esc(r.post_author_name) + '">Ban this user</button></li>' +
              '<li><hr class="dropdown-divider"></li>' +
              '<li><button class="dropdown-item text-danger delete-post-btn" data-post-id="' + r.post_id + '">Delete post</button></li>' +
              '<li><button class="dropdown-item text-secondary dismiss-report-btn" data-report-id="' + r.id + '">Dismiss report</button></li>' +
            '</ul>' +
          '</div>'
        ) + '</td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('.ban-btn').forEach(function (btn) { btn.addEventListener('click', function () { openBanModal(btn.dataset.userId, btn.dataset.name); }); });
    document.querySelectorAll('.delete-post-btn').forEach(function (btn) { btn.addEventListener('click', function () { openConfirm('Delete Post', 'Delete post #' + btn.dataset.postId + '? This cannot be undone.', function () { authFetch('/posts/' + btn.dataset.postId, { method: 'DELETE' }).then(function () { loadReports(); loadStats(); }).catch(function (err) { alert(err.message); }); }, { requireTyping: 'DELETE' }); }); });
    document.querySelectorAll('.dismiss-report-btn').forEach(function (btn) { btn.addEventListener('click', function () { authFetch('/auth/admin/reports/' + btn.dataset.reportId + '/dismiss', { method: 'POST' }).then(function () { loadReports(); }).catch(function (err) { alert(err.message); }); }); });
  }

  function renderPosts(posts) {
    var tbody = byId('adminPostsBody'), count = byId('postCount');
    if (!tbody) return;
    tbody.innerHTML = ''; count.textContent = posts.length + ' post' + (posts.length !== 1 ? 's' : '');
    if (posts.length === 0) { tbody.innerHTML = '<tr><td colspan="6">' + emptyState('newspaper', 'No posts found.') + '</td></tr>'; return; }
    posts.forEach(function (p) {
      var row = document.createElement('tr');
      row.innerHTML =
        '<td>' + p.id + '</td>' +
        '<td><a href="posts.html?id=' + p.id + '" target="_blank" class="text-decoration-none fw-semibold">' + esc(p.title || 'Untitled') + '</a></td>' +
        '<td>' + esc(p.author_name || 'Unknown') + '</td>' +
        '<td><span class="badge bg-light text-dark">' + esc(p.category || '-') + '</span></td>' +
        '<td><small>' + new Date(p.created_at).toLocaleDateString() + '</small></td>' +
        '<td><button class="btn-action btn-danger-sm delete-post-btn" data-post-id="' + p.id + '" title="Delete"><i class="fas fa-trash-alt"></i></button></td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('#adminPostsBody .delete-post-btn').forEach(function (btn) { btn.addEventListener('click', function () { openConfirm('Delete Post', 'Delete post #' + btn.dataset.postId + '? This cannot be undone.', function () { authFetch('/posts/' + btn.dataset.postId, { method: 'DELETE' }).then(function () { loadPosts(); loadStats(); }).catch(function (err) { alert(err.message); }); }, { requireTyping: 'DELETE' }); }); });
  }

  function renderAppeals(appeals) {
    var tbody = byId('appealsBody'), count = byId('appealCount');
    if (!tbody) return;
    // Sort: pending first, then by created_at
    appeals.sort(function (a, b) { if (a.status === 'pending' && b.status !== 'pending') return -1; if (a.status !== 'pending' && b.status === 'pending') return 1; return new Date(b.created_at) - new Date(a.created_at); });
    tbody.innerHTML = ''; count.textContent = appeals.length + ' appeal' + (appeals.length !== 1 ? 's' : '');
    if (appeals.length === 0) { tbody.innerHTML = '<tr><td colspan="7">' + emptyState('gavel', 'No appeals to review.') + '</td></tr>'; return; }
    appeals.forEach(function (a) {
      var until = a.suspended_until ? new Date(a.suspended_until) : null;
      var isPerm = until && until.getFullYear() >= 2999;
      var durStr = isPerm ? 'Permanent' : (until ? 'Until ' + until.toLocaleDateString() : 'Unknown');
      var statusBadge = a.status === 'pending' ? 'badge-warning' : (a.status === 'approved' ? 'badge-approved' : 'badge-dismissed');
      var row = document.createElement('tr'); if (a.status === 'pending') row.className = 'row-warning';
      row.innerHTML =
        '<td>' + a.id + '</td>' +
        '<td><strong>' + esc(a.user_name || a.user_username) + '</strong> <small class="text-muted">(ID: ' + a.user_id + ')</small></td>' +
        '<td>' + esc(a.banned_reason || '-') + '</td>' +
        '<td><span class="badge ' + (isPerm ? 'badge-danger' : 'badge-info') + '">' + durStr + '</span></td>' +
        '<td style="max-width:200px;">' + esc(a.message) + '</td>' +
        '<td><small>' + new Date(a.created_at).toLocaleDateString() + '</small></td>' +
        '<td style="white-space:nowrap;">' +
          (a.status === 'pending' ?
            '<button class="btn-action btn-success-sm me-1 approve-appeal-btn" data-appeal-id="' + a.id + '"><i class="fas fa-check"></i> Revert</button>' +
            '<button class="btn-action btn-edit-sm dismiss-appeal-btn" data-appeal-id="' + a.id + '"><i class="fas fa-times"></i> Ignore</button>'
          : '<span class="badge ' + statusBadge + '">' + esc(a.status) + '</span>') +
        '</td>';
      tbody.appendChild(row);
    });
    document.querySelectorAll('.approve-appeal-btn').forEach(function (btn) { btn.addEventListener('click', function () { openConfirm('Approve Appeal', 'Unsuspend the user and mark the appeal as approved?', function () { authFetch('/auth/admin/appeals/' + btn.dataset.appealId + '/approve', { method: 'POST' }).then(function () { loadAppeals(); loadStats(); }).catch(function (err) { alert(err.message); }); }); }); });
    document.querySelectorAll('.dismiss-appeal-btn').forEach(function (btn) { btn.addEventListener('click', function () { openConfirm('Dismiss Appeal', 'Mark this appeal as dismissed? The ban will remain.', function () { authFetch('/auth/admin/appeals/' + btn.dataset.appealId + '/dismiss', { method: 'POST' }).then(function () { loadAppeals(); }).catch(function (err) { alert(err.message); }); }); }); });
  }

  function renderAuditLog(log) {
    var tbody = byId('auditBody'); if (!tbody) return;
    tbody.innerHTML = '';
    if (!log || log.length === 0) { tbody.innerHTML = '<tr><td colspan="5">' + emptyState('history', 'No audit log entries.') + '</td></tr>'; return; }
    log.forEach(function (entry) {
      var row = document.createElement('tr');
      row.innerHTML =
        '<td><small>' + new Date(entry.created_at).toLocaleString() + '</small></td>' +
        '<td>' + esc(entry.admin_name || entry.admin_username) + '</td>' +
        '<td><span class="badge bg-info text-dark">' + esc(entry.action) + '</span></td>' +
        '<td>' + esc(entry.target_type || '-') + ' #' + (entry.target_id || '-') + '</td>' +
        '<td style="max-width:250px;">' + esc(entry.details || '') + '</td>';
      tbody.appendChild(row);
    });
  }

  // ---- Bind user actions ----
  function bindUserActions() {
    document.querySelectorAll('.delete-user-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConfirm('Delete User', 'Delete user <strong>' + btn.dataset.userName + '</strong> (ID: ' + btn.dataset.userId + ')?', function () {
          authFetch('/auth/admin/users/' + btn.dataset.userId, { method: 'DELETE' }).then(function () { loadAdminPanel(); loadStats(); }).catch(function (err) { alert(err.message); });
        }, { requireTyping: btn.dataset.userName });
      });
    });
    document.querySelectorAll('.role-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var newRole = sel.value, userName = sel.dataset.userName, currentRole = sel.dataset.currentRole;
        var desc = 'Change <strong>' + userName + '</strong> from ' + currentRole + ' to ' + newRole + '.';
        openConfirm('Change Role', desc, function () {
          authFetch('/auth/admin/users/' + sel.dataset.userId, { method: 'PUT', body: JSON.stringify({ role: newRole }) }).then(function () { loadAdminPanel(); loadStats(); }).catch(function (err) { alert(err.message); });
        }, { requireTyping: newRole.toUpperCase() });
        sel.value = currentRole;
      });
    });
    document.querySelectorAll('.unsuspend-user-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openConfirm('Unsuspend User', 'Lift the ban on user ID <strong>' + btn.dataset.userId + '</strong>?', function () {
          authFetch('/auth/admin/unsuspend', { method: 'POST', body: JSON.stringify({ user_id: btn.dataset.userId }) }).then(function () { loadAdminPanel(); loadStats(); }).catch(function (err) { alert(err.message); });
        });
      });
    });
    document.querySelectorAll('.view-user-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { openUserPanel(parseInt(btn.dataset.id, 10)); });
    });
    document.querySelectorAll('.user-name-link').forEach(function (link) {
      link.addEventListener('click', function (e) { e.preventDefault(); openUserPanel(parseInt(link.dataset.id, 10)); });
    });
  }

  // ---- Load functions ----
  function loadAdminPanel() {
    showEl('adminLoading'); hideEl('adminError'); hideEl('adminPanel');
    var url = '/auth/admin/users';
    if (_showBannedOnly) {
      authFetch('/auth/admin/banned-users').then(function (data) { hideEl('adminLoading'); showEl('adminPanel'); renderBannedUsers(data.users || []); }).catch(function (err) { hideEl('adminLoading'); showEl('adminError'); byId('adminError').textContent = err.message; });
      return;
    }
    // Apply filters
    var roleFilter = byId('userFilterRole').value;
    var statusFilter = byId('userFilterStatus').value;
    var searchTerm = byId('userSearch').value.trim();
    if (searchTerm) { url = '/auth/admin/search-users?q=' + encodeURIComponent(searchTerm); }
    authFetch(url).then(function (data) {
      hideEl('adminLoading'); showEl('adminPanel');
      var users = data.users || data || [];
      if (roleFilter) users = users.filter(function (u) { return u.role === roleFilter; });
      if (statusFilter === 'banned') users = users.filter(function (u) { return u.suspended_until && new Date(u.suspended_until) > new Date(); });
      else if (statusFilter === 'active') users = users.filter(function (u) { return !u.suspended_until || new Date(u.suspended_until) <= new Date(); });
      renderUsers(users);
    }).catch(function (err) { hideEl('adminLoading'); showEl('adminError'); byId('adminError').textContent = err.message; });
  }

  function loadStats() {
    authFetch('/auth/admin/stats').then(function (stats) {
      authFetch('/auth/admin/trend-stats').then(function (trends) { renderStats(stats, trends); }).catch(function () { renderStats(stats); });
    }).catch(function () {});
  }

  function loadPosts(search, category, dateFilter) {
    showSkeleton('postsLoading', 5, 5); hideEl('postsError'); hideEl('postsPanel');
    var params = [];
    if (search) params.push('search=' + encodeURIComponent(search));
    if (category) params.push('category=' + encodeURIComponent(category));
    if (dateFilter) params.push('date=' + encodeURIComponent(dateFilter));
    var qs = params.length ? '?' + params.join('&') : '';
    authFetch('/posts/admin/all' + qs).then(function (data) {
      hideSkeleton('postsLoading'); showEl('postsPanel');
      renderPosts(Array.isArray(data) ? data : []);
    }).catch(function (err) { hideSkeleton('postsLoading'); showEl('postsError'); byId('postsError').textContent = err.message; });
  }

  function loadReports(includeResolved) {
    showSkeleton('reportsLoading', 5, 6); hideEl('reportsError'); hideEl('reportsPanel');
    authFetch('/posts/reports' + (includeResolved ? '?includeDismissed=true' : '')).then(function (data) {
      hideSkeleton('reportsLoading'); showEl('reportsPanel');
      var reports = Array.isArray(data) ? data : [];
      renderReports(reports, includeResolved);
      // Also update priority strip
      authFetch('/auth/admin/appeals').then(function (aData) { updatePriorityStrip(null, reports, aData.appeals); }).catch(function () {});
    }).catch(function (err) { hideSkeleton('reportsLoading'); showEl('reportsError'); byId('reportsError').textContent = err.message; });
  }

  function loadAppeals() {
    showSkeleton('appealsLoading', 4, 5); hideEl('appealsError'); hideEl('appealsPanel');
    authFetch('/auth/admin/appeals').then(function (data) {
      hideSkeleton('appealsLoading'); showEl('appealsPanel');
      renderAppeals(data.appeals || []);
    }).catch(function (err) { hideSkeleton('appealsLoading'); showEl('appealsError'); byId('appealsError').textContent = err.message; });
  }

  function loadAuditLog() {
    showSkeleton('auditLoading', 5, 4); hideEl('auditError'); hideEl('auditPanel');
    authFetch('/auth/admin/audit-log').then(function (data) {
      hideSkeleton('auditLoading'); showEl('auditPanel');
      renderAuditLog(data.log || []);
    }).catch(function (err) { hideSkeleton('auditLoading'); showEl('auditError'); byId('auditError').textContent = err.message; });
  }

  // ---- Filter handlers ----
  byId('userSearch').addEventListener('input', function () { clearTimeout(this._t); var self = this; self._t = setTimeout(function () { loadAdminPanel(); }, 300); });
  byId('userFilterRole').addEventListener('change', loadAdminPanel);
  byId('userFilterStatus').addEventListener('change', loadAdminPanel);

  // ---- Save filter preset ----
  byId('saveUserFilterBtn').addEventListener('click', function () {
    byId('presetNameInput').value = '';
    showEl('presetModal');
    byId('presetNameInput').focus();
  });
  byId('presetCancel').addEventListener('click', function () { hideEl('presetModal'); });
  byId('presetSave').addEventListener('click', function () {
    var label = byId('presetNameInput').value.trim();
    if (!label) { alert('Please enter a preset name.'); return; }
    hideEl('presetModal');
    var preset = { label: label, role: byId('userFilterRole').value, status: byId('userFilterStatus').value };
    _filterPresets.users = _filterPresets.users || [];
    _filterPresets.users.push(preset);
    localStorage.setItem('adminFilterPresets', JSON.stringify(_filterPresets));
    renderUserPresets();
  });
  function renderUserPresets() {
    var presets = _filterPresets.users || [];
    renderPresetChips('userPresetChips', presets, null, function (key) {
      var p = presets[parseInt(key, 10)]; if (!p) return;
      byId('userFilterRole').value = p.role || '';
      byId('userFilterStatus').value = p.status || '';
      loadAdminPanel();
    });
  }

  // ---- CSV export ----
  byId('exportUsersBtn').addEventListener('click', function () {
    var users = _lastUsers || [];
    var headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Joined'];
    var rows = users.map(function (u) {
      var isSuspended = u.suspended_until && new Date(u.suspended_until) > new Date();
      return [u.id, u.display_name || u.name, u.email, u.role || 'user', isSuspended ? 'Banned' : 'Active', u.created_at ? new Date(u.created_at).toLocaleDateString() : ''];
    });
    exportCSV('spindle-users.csv', headers, rows);
  });
  byId('exportAuditBtn').addEventListener('click', function () {
    var log = [];
    var rows = byId('auditBody').querySelectorAll('tr');
    rows.forEach(function (r) {
      var cells = r.querySelectorAll('td');
      if (cells.length >= 5) log.push([cells[0].textContent.trim(), cells[1].textContent.trim(), cells[2].textContent.trim(), cells[3].textContent.trim(), cells[4].textContent.trim()]);
    });
    var headers = ['Date', 'Admin', 'Action', 'Target', 'Details'];
    exportCSV('spindle-audit.csv', headers, log.length > 0 ? log : [['No data']]);
  });

  // ---- Post filter handlers ----
  var postSearch = byId('postSearch'), filterCategory = byId('filterCategory'), filterDate = byId('filterDate');
  function reloadPosts() { loadPosts(postSearch.value.trim() || undefined, filterCategory.value || undefined, filterDate.value || undefined); }
  var searchTimer;
  postSearch.addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(reloadPosts, 300); });
  filterCategory.addEventListener('change', reloadPosts);
  filterDate.addEventListener('change', reloadPosts);

  // ---- Show banned toggle ----
  byId('showBannedBtn').addEventListener('click', function () {
    _showBannedOnly = !_showBannedOnly;
    this.textContent = _showBannedOnly ? 'Show All Users' : 'Show Banned';
    loadAdminPanel();
  });

  // ---- Resolved reports toggle ----
  var showResolved = false;
  byId('showResolvedReportsBtn').addEventListener('click', function () {
    showResolved = !showResolved;
    this.innerHTML = showResolved ? '<i class="fas fa-flag me-1"></i>Active Reports' : '<i class="fas fa-check-double me-1"></i>Resolved';
    loadReports(showResolved);
  });

  // ---- Theme toggles ----
  byId('btnDarkMode').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
    this.innerHTML = cur === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
  });
  byId('btnAccessibility').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-accessibility') || 'off';
    var next = cur === 'on' ? 'off' : 'on';
    applyAccessibility(next === 'on');
    this.classList.toggle('btn-outline-warning', next === 'on');
    this.classList.toggle('btn-outline-secondary', next === 'off');
    this.querySelector('i').className = next === 'on' ? 'fas fa-eye-slash' : 'fas fa-eye';
    var label = byId('accLabel');
    if (label) label.textContent = next === 'on' ? 'ON' : 'OFF';
  });

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', function () {
    // Restore theme
    var savedTheme = localStorage.getItem('adminTheme') || 'light';
    applyTheme(savedTheme);
    if (savedTheme === 'dark') byId('btnDarkMode').innerHTML = '<i class="fas fa-sun"></i>';
    var savedAcc = localStorage.getItem('adminAccessibility') || 'off';
    applyAccessibility(savedAcc === 'on');
    if (savedAcc === 'on') {
      byId('btnAccessibility').classList.add('btn-outline-warning');
      byId('btnAccessibility').classList.remove('btn-outline-secondary');
      var icon = byId('btnAccessibility').querySelector('i');
      if (icon) icon.className = 'fas fa-eye-slash';
      var label = byId('accLabel');
      if (label) label.textContent = 'ON';
    }

    if (typeof isLoggedIn === 'function' && typeof isAdmin === 'function') {
      if (!isLoggedIn()) { window.location.replace('home.html?login=1&return=admin.html'); return; }
      if (!isAdmin(getStoredUser())) { window.location.replace('home.html'); return; }
    }
    if (typeof updateNavForUser === 'function') updateNavForUser(getStoredUser());

    loadStats();
    loadAdminPanel();
    renderUserPresets();

    // Logout
    byId('btnLogout').addEventListener('click', function () {
      if (typeof clearAuth === 'function') clearAuth();
      window.location.href = 'home.html';
    });

    // User search also triggers on input
    // Show banned button
    // Already bound above

    setBreadcrumb([{ label: 'Users', action: null }]);
  });
})();
