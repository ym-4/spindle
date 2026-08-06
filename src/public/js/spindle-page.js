/** Shared init for Spindle-layout pages (index, chat, settings, profile, …) */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page) {
    document.querySelector(`.sidebar-item[data-page="${page}"]`)?.classList.add('active');
  }

  const file = window.location.pathname.split('/').pop() || 'index.html';
  const isPublicFeed =
    file === 'index.html' ||
    file === 'home.html' ||
    file === 'posts.html' ||
    file === 'search.html';

  if (!isPublicFeed && typeof isLoggedIn === 'function' && !isLoggedIn()) {
    redirectToLogin(file);
    return;
  }

  if (
    typeof isLoggedIn === 'function' &&
    isLoggedIn() &&
    typeof injectNotificationsOnly === 'function'
  ) {
    injectNotificationsOnly('spindleNotifSlot');
  }

  // Skip theme on auth pages (home/login/register) — they have their own design
  var isAuth = file === 'home.html' || file === 'login.html' || file === 'register.html';
  if (!isAuth) {
    var savedTheme = localStorage.getItem('spindle-theme');
    document.documentElement.dataset.theme = savedTheme || 'light';
  }
});
