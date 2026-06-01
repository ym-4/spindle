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
  const notificationBell = document.getElementById('notifications');
  const messageIcon = document.getElementById('messages');

  const token = spindleGetToken();

  if (token) {
    // Logged in — show profile + logout + notif + messages, hide auth buttons
    loginButton.classList.add('d-none');
    registerButton.classList.add('d-none');
    profileButton.classList.remove('d-none');
    logoutButton.classList.remove('d-none');

    notificationBell.classList.remove('d-none');
    messageIcon.classList.remove('d-none');
  } else {
    // Logged out — show auth buttons, hide profile + logout + messages + notif
    loginButton.classList.remove('d-none');
    registerButton.classList.remove('d-none');
    profileButton.classList.add('d-none');
    logoutButton.classList.add('d-none');

    notificationBell.classList.add('d-none');
    messageIcon.classList.add('d-none');
  }

  logoutButton.addEventListener('click', async function (event) {
    event.preventDefault();
    const token = spindleGetToken();

    try {
      if (token) {
        await fetch('/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (err) {
      console.warn("Backend unregister skipped, clearing storage locally:", err);
    }

    spindleClearAuth();
    localStorage.removeItem('token');
    localStorage.removeItem('loggedInUserId');
    localStorage.removeItem('displayName');

    window.location.href = 'login.html';
  });
});
