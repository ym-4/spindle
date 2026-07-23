/* global fetchMethod, getStoredUser, IsLoggedIn, updateNavForUser, onWs, handleLogout, refreshNotifBadge, openAuthModal, clearAuth, getPostLoginRedirect */

function setupHome() {
  const user = getStoredUser();
  const loggedIn = !!user && isLoggedIn();

  document.getElementById('homeGuest').classList.toggle('hidden', loggedIn);
  document.getElementById('homeUser').classList.toggle('hidden', !loggedIn);

  updateNavForUser(user);

  if (loggedIn) {
    const slot = document.getElementById('waHeaderSlot');
    if (slot) {
      slot.innerHTML =
        '<button type="button" class="wa-btn wa-btn--ghost wa-btn--small" id="waHeaderLogout">Log out</button>';
      document.getElementById('waHeaderLogout')?.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
      });
    }
    connectSocket();
    onWs('notification', () => refreshNotifBadge());
  }

  document.getElementById('btnHeroLogin')?.addEventListener('click', () => openAuthModal('login'));
}

document.addEventListener('DOMContentLoaded', () => {
  if (getToken() && !getStoredUser()) clearAuth();
  const params = new URLSearchParams(location.search);

  if (isLoggedIn() && params.has('return')) {
    const user = getStoredUser();
    window.location.replace(getPostLoginRedirect(user));
    return;
  }
  setupHome();
});
