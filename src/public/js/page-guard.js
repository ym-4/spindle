/**
 * Runs immediately on protected pages (include after api.js).
 * data-require-login — must be signed in
 * data-require-admin — must be signed in as admin
 * data-return — page to open after login (e.g. profile.html)
 */
(function runPageGuard() {
  const script = document.currentScript;
  if (!script) return;

  const returnPath = script.dataset.return || 'profile.html';

  if (script.dataset.requireLogin && !isLoggedIn()) {
    redirectToLogin(returnPath);
    return;
  }

  if (script.dataset.requireAdmin) {
    if (!isLoggedIn()) {
      redirectToLogin(returnPath);
      return;
    }
    if (!isAdmin(getStoredUser())) {
      window.location.replace('profile.html');
    }
  }
})();
