/** Shared init for Spindle-layout pages (index, chat, settings, profile, …) */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page) {
    document.querySelector(`.sidebar-item[data-page="${page}"]`)?.classList.add('active');
  }

  const file = window.location.pathname.split('/').pop() || 'index.html';
  const isPublicPage = file === 'index.html' || file === 'home.html';

  if (!isPublicPage && typeof isLoggedIn === 'function' && !isLoggedIn()) {
    redirectToLogin(file + window.location.search);
    return;
  }

  if (typeof isLoggedIn === 'function' && isLoggedIn() && typeof injectNotificationsOnly === 'function') {
    injectNotificationsOnly('spindleNotifSlot');
  }

  document.getElementById('logoutButton')?.addEventListener('click', (e) => {
    if (typeof handleLogout === 'function') handleLogout();
    else {
      if (typeof clearAuth === 'function') clearAuth();
      else {
        localStorage.removeItem('token');
        localStorage.removeItem('loggedInUserId');
      }
      window.location.href = 'home.html';
    }
  });
});
