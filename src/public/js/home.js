function setupHome() {
  const user = getStoredUser();
  const loggedIn = !!user && isLoggedIn();

  document.getElementById('homeGuest').classList.toggle('hidden', loggedIn);
  document.getElementById('homeUser').classList.toggle('hidden', !loggedIn);

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
    window.location.replace(getPostLoginRedirect(user));
    return;
  }
  updateNavForUser(null);
  setupHome();
});