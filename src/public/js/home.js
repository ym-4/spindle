function setupHome() {
  const user = getStoredUser();
  const loggedIn = !!user && isLoggedIn();

  document.getElementById('homeGuest').classList.toggle('hidden', loggedIn);
  document.getElementById('homeUser').classList.toggle('hidden', !loggedIn);
  const sidebar = document.getElementById('homeSidebar');
  if (sidebar) sidebar.style.display = loggedIn ? 'block' : 'none';
  if (loggedIn) document.body.classList.add('logged-in');

  if (loggedIn) {
    const navUser = document.getElementById('navUser');
    navUser.classList.remove('hidden');
    navUser.style.display = 'flex';
    injectHeaderActions('waHeaderSlot');
    connectSocket();
    onWs('notification', () => refreshNotifBadge());
  }

  document.getElementById('btnHeroLogin')?.addEventListener('click', () => openAuthModal('login'));
}

document.addEventListener('DOMContentLoaded', () => {
  if (getToken() && !getStoredUser()) clearAuth();
  if (isLoggedIn()) {
    const user = getStoredUser();
    document.getElementById('navGuest').classList.add('hidden');
    document.getElementById('navUser').classList.remove('hidden');
    document.getElementById('navUser').style.display = 'flex';
    document.getElementById('homeGuest').classList.add('hidden');
    document.getElementById('homeUser').classList.remove('hidden');
    if (typeof injectHeaderActions === 'function') injectHeaderActions('waHeaderSlot');
    if (typeof connectSocket === 'function') {
      connectSocket();
      onWs('notification', () => refreshNotifBadge());
    }
    return;
  }
  updateNavForUser(null);
  setupHome();
});
