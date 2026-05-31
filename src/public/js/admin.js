function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderUsers(users) {
  const tbody = document.getElementById('adminUsersBody');
  tbody.innerHTML = '';

  users.forEach((user) => {
    const row = document.createElement('tr');
    const roleClass = user.role === 'admin' ? 'role-badge role-badge--admin' : 'role-badge';
    row.innerHTML = `
      <td>${user.id}</td>
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td><span class="${roleClass}">${user.role}</span></td>
    `;
    tbody.appendChild(row);
  });
}

async function loadAdminPanel() {
  const loading = document.getElementById('adminLoading');
  const errorEl = document.getElementById('adminError');
  const panel = document.getElementById('adminPanel');
  const user = getStoredUser();

  if (!isLoggedIn()) {
    redirectToLogin('admin.html');
    return;
  }

  if (!isAdmin(user)) {
    window.location.replace('home.html');
    return;
  }

  try {
    const { users } = await authFetch('/auth/admin/users');
    loading.classList.add('hidden');
    panel.classList.remove('hidden');
    renderUsers(users);
  } catch (err) {
    loading.classList.add('hidden');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateNavForUser(getStoredUser());
  loadAdminPanel();
});
