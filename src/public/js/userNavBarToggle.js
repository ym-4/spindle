// ─────────────────────────────────────────────────────────
//  Spindle — navbar.js
//  Toggles login/signup vs profile/logout based on token.
//  Include on every page AFTER the navbar HTML.
// ─────────────────────────────────────────────────────────

function spindleGetToken() {
  if (typeof getToken === 'function') return getToken();
  return localStorage.getItem('token');
}

function spindleClearAuth() {
  if (typeof clearAuth === 'function') clearAuth();
  else {
    localStorage.removeItem('token');
    localStorage.removeItem('loggedInUserId');
    localStorage.removeItem('pineappleUser');
    localStorage.removeItem('pineappleToken');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const loginButton    = document.getElementById('loginButton');
  const registerButton = document.getElementById('registerButton');
  const profileButton  = document.getElementById('profileButton');
  const logoutButton   = document.getElementById('logoutButton');
  if (!loginButton || !registerButton || !profileButton || !logoutButton) return;

  const token = spindleGetToken();

  if (token) {
    // Logged in — show profile & logout, hide auth buttons
    loginButton.classList.add('d-none');
    registerButton.classList.add('d-none');
    profileButton.classList.remove('d-none');
    logoutButton.classList.remove('d-none');
  } else {
    // Logged out — show auth buttons, hide profile & logout
    loginButton.classList.remove('d-none');
    registerButton.classList.remove('d-none');
    profileButton.classList.add('d-none');
    logoutButton.classList.add('d-none');
  }

  logoutButton.addEventListener('click', function () {
    spindleClearAuth();
    window.location.href = 'home.html';
  });
});