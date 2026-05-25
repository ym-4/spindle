/** Shared API helpers — works with Express (npm start) and Live Server */
const LIVE_SERVER_PORTS = ['5500', '5501', '5502'];
const API_BASE = LIVE_SERVER_PORTS.includes(window.location.port)
  ? 'http://localhost:3000'
  : '';

const TOKEN_KEY = 'pineappleToken';
const USER_KEY = 'pineappleUser';

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAuth(user, token) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(TOKEN_KEY, token);
}

function clearAuth() {
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function isLoggedIn() {
  return !!(getToken() && getStoredUser());
}

/** Send guests to home login; after login they return to the protected page. */
function redirectToLogin(returnPath) {
  const params = new URLSearchParams({ login: '1' });
  if (returnPath) {
    params.set('return', returnPath);
  }
  window.location.replace(`home.html?${params.toString()}`);
}

function getSafeReturnPath() {
  const ret = new URLSearchParams(window.location.search).get('return');
  if (ret && /^[a-zA-Z0-9_-]+\.html$/.test(ret)) {
    return ret;
  }
  return null;
}

function getPostLoginRedirect(user) {
  const returnPath = getSafeReturnPath();
  if (returnPath === 'admin.html' && !isAdmin(user)) {
    return 'profile.html';
  }
  if (returnPath) {
    return returnPath;
  }
  return isAdmin(user) ? 'admin.html' : 'profile.html';
}

async function authFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

function redirectAfterLogin(user) {
  window.location.href = getPostLoginRedirect(user);
}

function updateNavForUser(user) {
  const guestActions = document.getElementById('navGuest');
  const userActions = document.getElementById('navUser');
  const adminLink = document.getElementById('navAdminLink');
  const userLabel = document.getElementById('navUserName');

  if (!guestActions || !userActions) return;

  if (user) {
    guestActions.classList.add('hidden');
    userActions.classList.remove('hidden');
    if (userLabel) userLabel.textContent = user.name;
    if (adminLink) {
      adminLink.classList.toggle('hidden', !isAdmin(user));
    }
  } else {
    guestActions.classList.remove('hidden');
    userActions.classList.add('hidden');
    if (adminLink) adminLink.classList.add('hidden');
  }
}
