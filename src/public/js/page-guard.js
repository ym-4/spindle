/**
 * Must run synchronously right after api.js on protected pages.
 */
(function runPageGuard() {
  const script = document.currentScript;
  if (!script) return;

  const returnPath = script.dataset.return || 'chat.html';
  const needsLogin = script.dataset.requireLogin !== undefined;
  const needsAdmin = script.dataset.requireAdmin !== undefined;

  function goLogin() {
    const params = new URLSearchParams({ login: '1', return: returnPath });
    window.location.replace(`home.html?${params.toString()}`);
  }

  if (needsLogin && !isLoggedIn()) {
    goLogin();
    return;
  }

  if (needsAdmin) {
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    const user = getStoredUser();
    if (!isAdmin(user)) {
      window.location.replace('chat.html');
    }
  }
})();
