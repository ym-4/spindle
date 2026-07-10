/** Shared API helpers — works with Express (npm start) and Live Server */
(function redirectToExpressIfNeeded() {
  const { hostname, port, pathname, search, protocol } = window.location;
  if (protocol === 'file:') return;
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '3000') {
    const page = pathname.split('/').pop() || 'home.html';
    window.location.replace(`http://localhost:3000/${page}${search}`);
  }
})();

function getApiBase() {
  const { protocol, hostname, port } = window.location;

  if (protocol === 'file:') {
    return 'http://localhost:3000';
  }

  if (port === '3000' || (port === '' && hostname !== 'localhost' && hostname !== '127.0.0.1')) {
    return '';
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  return '';
}

const API_BASE = getApiBase();

const TOKEN_KEY = 'token';
const LEGACY_TOKEN_KEY = 'pineappleToken';
const USER_KEY = 'pineappleUser';
const USER_ID_KEY = 'loggedInUserId';
const REMEMBER_KEY = 'campusRemember30';

function getToken() {
  return (
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(LEGACY_TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(LEGACY_TOKEN_KEY)
  );
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getStoredUser() {
  try {
    const raw =
      localStorage.getItem(USER_KEY) ||
      sessionStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw);
    const id = localStorage.getItem(USER_ID_KEY);
    const token = getToken();
    if (id && token) return { id: Number(id) };
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload?.id) {
        return {
          id: payload.id,
          name: payload.name,
          email: payload.email,
          role: payload.role,
          avatar: payload.avatar ?? null,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function setAuth(user, token) {
  const userJson = JSON.stringify(user);
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, String(user.id));
  localStorage.setItem(USER_KEY, userJson);
  localStorage.setItem(LEGACY_TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, userJson);
  sessionStorage.setItem(LEGACY_TOKEN_KEY, token);
}

function getRememberToken() {
  return localStorage.getItem(REMEMBER_KEY);
}

function setRememberToken(token) {
  if (token) localStorage.setItem(REMEMBER_KEY, token);
  else localStorage.removeItem(REMEMBER_KEY);
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  setRememberToken(null);
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function isLoggedIn() {
  return !!(getToken() && getStoredUser());
}

/** Send guests to home login; after login they return to the protected page. */
function redirectToLogin(returnPath) {
  // Prevent nesting: if already on home.html with login=1, do nothing
  const page = window.location.pathname.split('/').pop() || '';
  if (page === 'home.html' && window.location.search.includes('login=1')) {
    return;
  }
  const params = new URLSearchParams({ login: '1' });
  if (returnPath) {
    const clean = returnPath.split('?')[0]; // strip any existing query
    if (/^[a-zA-Z0-9_-]+\.html$/.test(clean)) {
      params.set('return', clean);
    }
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
    return 'index.html';
  }
  if (returnPath) {
    return returnPath;
  }
  return isAdmin(user) ? 'admin.html' : 'index.html';
}

function getWsUrl() {
  const base = getApiBase();
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (!base) {
    const host = window.location.host || 'localhost:3000';
    return `${proto}//${host}/ws`;
  }
  const url = new URL(base);
  return `${proto}//${url.host}/ws`;
}

function mediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
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

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      'Cannot connect to the server. Run npm start, then open http://localhost:3000/home.html',
    );
  }

  const data = await response.json().catch(() => ({}));
  if (response.ok && (data.needs2FA || data.needsVerification)) {
    return data;
  }
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
      clearAuth();
      const ret = getSafeReturnPath() || window.location.pathname.split('/').pop() || 'chat.html';
      if (!window.location.pathname.endsWith('home.html')) {
        redirectToLogin(ret);
      }
    }
    const err = new Error(data.error || `Request failed (${response.status})`);
    Object.assign(err, data);
    throw err;
  }
  return data;
}

function redirectAfterLogin(user) {
  window.location.href = getPostLoginRedirect(user);
}

/** Keep Spindle feed keys in sync if user logged in via Campus Hub auth only */
// (function syncSpindleAuthKeys() {
//   const token = getToken();
//   if (!token) return;
//   const user = getStoredUser();
//   if (user?.id) {
//     if (!localStorage.getItem(USER_ID_KEY)) {
//       localStorage.setItem(USER_ID_KEY, String(user.id));
//     }
//     if (!localStorage.getItem(TOKEN_KEY)) {
//       localStorage.setItem(TOKEN_KEY, token);
//     }
//     if (!localStorage.getItem(USER_KEY)) {
//       localStorage.setItem(USER_KEY, JSON.stringify(user));
//     }
//   }
// })();

function updateNavForUser(user) {
  const guestActions = document.getElementById('navGuest');
  const userActions = document.getElementById('navUser');
  const adminLink = document.getElementById('navAdminLink');
  const userLabel = document.getElementById('navUserName');

  if (!guestActions || !userActions) return;

  if (user) {
    guestActions.classList.add('hidden');
    guestActions.style.display = 'none';
    userActions.classList.remove('hidden');
    userActions.style.display = 'flex';
    if (userLabel) userLabel.textContent = user.display_name || user.name;
    if (adminLink) {
      adminLink.classList.toggle('hidden', !isAdmin(user));
      adminLink.style.display = isAdmin(user) ? '' : 'none';
    }
  } else {
    guestActions.classList.remove('hidden');
    guestActions.style.display = '';
    userActions.classList.add('hidden');
    userActions.style.display = 'none';
    if (adminLink) {
      adminLink.classList.add('hidden');
      adminLink.style.display = 'none';
    }
  }
}