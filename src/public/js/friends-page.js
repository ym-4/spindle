function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function avatarHtml(u) {
  const initials = (u.display_name || u.name || '?').slice(0, 2).toUpperCase();
  if (u.profile_image) {
    return `<img src="${mediaUrl(u.profile_image)}" alt="" class="rounded-circle" width="40" height="40" style="object-fit:cover" />`;
  }
  return `<span class="rounded-circle d-inline-flex align-items-center justify-content-center bg-danger text-white fw-bold" style="width:40px;height:40px;font-size:0.85rem">${esc(initials)}</span>`;
}

function friendActionButton(u) {
  const st = u.relationship || 'none';
  if (st === 'friends') return '<span class="badge bg-success">Friends</span>';
  if (st === 'pending_sent') return '<button class="btn btn-sm btn-secondary" disabled>Pending</button>';
  if (st === 'pending_received') {
    return `<button class="btn btn-sm btn-primary" data-accept="${u.request_id}">Accept</button>
      <button class="btn btn-sm btn-outline-secondary" data-decline="${u.request_id}">Decline</button>`;
  }
  return `<button class="btn btn-sm btn-primary" data-add="${u.id}">Add</button>`;
}

function bindRowActions(root) {
  root.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await authFetch('/friends/request', {
          method: 'POST',
          body: JSON.stringify({ receiver_id: Number(btn.dataset.add) }),
        });
        searchUsers(document.getElementById('friendSearch').value);
        loadRequests();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  root.querySelectorAll('[data-accept]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await authFetch('/friends/accept', {
          method: 'POST',
          body: JSON.stringify({ request_id: Number(btn.dataset.accept) }),
        });
        loadRequests();
        searchUsers(document.getElementById('friendSearch').value);
      } catch (err) {
        alert(err.message);
      }
    });
  });
  root.querySelectorAll('[data-decline]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await authFetch('/friends/decline', {
          method: 'POST',
          body: JSON.stringify({ request_id: Number(btn.dataset.decline) }),
        });
        loadRequests();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

let friendReqTab = 'received';
let searchTimer = null;

async function searchUsers(q) {
  const list = document.getElementById('findPeopleList');
  const hint = document.getElementById('friendSearchHint');
  if (!list) return;

  const query = q.trim();
  if (!query) {
    list.innerHTML = '';
    if (hint) hint.textContent = 'Click a name to view their profile, or tap Add to send a request.';
    return;
  }

  list.innerHTML = '<li class="list-group-item text-muted">Searching…</li>';
  try {
    const { users } = await authFetch(`/friends/search?q=${encodeURIComponent(query)}`);
    if (users.length === 0) {
      list.innerHTML = '<li class="list-group-item text-muted">No users found.</li>';
      return;
    }
    list.innerHTML = users
      .map(
        (u) => `
      <li class="list-group-item d-flex align-items-center gap-2">
        <button type="button" class="btn btn-link p-0 text-start flex-grow-1 d-flex align-items-center gap-2 text-decoration-none text-dark" data-profile="${u.id}">
          ${avatarHtml(u)}
          <span><strong>${esc(u.display_name || u.name)}</strong><br><small class="text-muted">@${esc(u.name)}</small></span>
        </button>
        <div>${friendActionButton(u)}</div>
      </li>`,
      )
      .join('');
    list.querySelectorAll('[data-profile]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.href = `profile.html?id=${btn.dataset.profile}`;
      });
    });
    bindRowActions(list);
  } catch (err) {
    list.innerHTML = `<li class="list-group-item text-danger">${esc(err.message)}</li>`;
  }
}

async function loadRequests() {
  const list = document.getElementById('friendRequestsList');
  if (!list) return;
  try {
    const { requests } = await authFetch(`/friends/requests?tab=${friendReqTab}`);
    if (requests.length === 0) {
      list.innerHTML = '<li class="list-group-item text-muted">No requests</li>';
      return;
    }
    const isReceived = friendReqTab === 'received';
    list.innerHTML = requests
      .map((r) => {
        const actions = isReceived
          ? `<button class="btn btn-sm btn-primary" data-accept="${r.request_id}">Accept</button>
             <button class="btn btn-sm btn-outline-secondary" data-decline="${r.request_id}">Decline</button>`
          : `<button class="btn btn-sm btn-outline-secondary" data-decline="${r.request_id}">Cancel</button>`;
        return `<li class="list-group-item d-flex align-items-center gap-2">
          <button type="button" class="btn btn-link p-0 text-start flex-grow-1 d-flex align-items-center gap-2 text-decoration-none text-dark" data-profile="${r.user.id}">
            ${avatarHtml(r.user)}
            <strong>${esc(r.user.display_name || r.user.name)}</strong>
          </button>
          <div class="d-flex gap-1">${actions}</div>
        </li>`;
      })
      .join('');
    list.querySelectorAll('[data-profile]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.href = `profile.html?id=${btn.dataset.profile}`;
      });
    });
    bindRowActions(list);
  } catch (err) {
    list.innerHTML = `<li class="list-group-item text-danger">${esc(err.message)}</li>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('friendSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchUsers(e.target.value), 300);
  });
  document.querySelectorAll('[data-req-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      friendReqTab = tab.dataset.reqTab;
      document.querySelectorAll('.friend-tab').forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.classList.toggle('text-muted', t !== tab);
        t.classList.toggle('fw-semibold', t === tab);
      });
      loadRequests();
    });
  });
  loadRequests();
});
