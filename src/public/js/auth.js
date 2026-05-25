function showMessage(el, text, type) {
  el.textContent = text;
  el.className = 'auth-message';
  if (type) el.classList.add(`auth-message--${type}`);
}

function openAuthModal(tab = 'login') {
  const overlay = document.getElementById('authOverlay');
  if (!overlay) return;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  switchAuthTab(tab);
}

function closeAuthModal() {
  const overlay = document.getElementById('authOverlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.auth-form').forEach((form) => {
    form.classList.toggle('is-active', form.id === `${tab}Form`);
  });
  const msg = document.getElementById('authMessage');
  if (msg) showMessage(msg, '');
}

async function handleLogin(event) {
  event.preventDefault();
  const msg = document.getElementById('authMessage');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    showMessage(msg, 'Authenticating...', '');
    const { user, token } = await authFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuth(user, token);
    showMessage(msg, `Welcome back, ${user.name}!`, 'success');
    updateNavForUser(user);
    initHeroLinks(user);
    setTimeout(() => {
      closeAuthModal();
      redirectAfterLogin(user);
    }, 600);
  } catch (err) {
    showMessage(msg, err.message, 'error');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const msg = document.getElementById('authMessage');
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const avatar = document.getElementById('registerAvatar').value.trim();

  try {
    showMessage(msg, 'Creating account...', '');
    const { user, token } = await authFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        avatar: avatar || undefined,
      }),
    });
    setAuth(user, token);
    showMessage(msg, 'Account created! Redirecting...', 'success');
    updateNavForUser(user);
    initHeroLinks(user);
    setTimeout(() => {
      closeAuthModal();
      redirectAfterLogin(user);
    }, 600);
  } catch (err) {
    showMessage(msg, err.message, 'error');
  }
}

function handleLogout() {
  clearAuth();
  updateNavForUser(null);
  window.location.href = 'home.html';
}

function initHeroLinks(user) {
  const guestLinks = document.getElementById('heroLinksGuest');
  const userLinks = document.getElementById('heroLinksUser');
  const adminNote = document.getElementById('heroAdminNote');
  if (!guestLinks || !userLinks) return;

  if (user) {
    guestLinks.classList.add('hidden');
    userLinks.classList.remove('hidden');
    if (adminNote) {
      adminNote.classList.toggle('hidden', !isAdmin(user));
    }
  } else {
    guestLinks.classList.remove('hidden');
    userLinks.classList.add('hidden');
    if (adminNote) adminNote.classList.add('hidden');
  }

  document.getElementById('heroSignInProfile')?.addEventListener('click', () => {
    const params = new URLSearchParams(window.location.search);
    params.set('login', '1');
    params.set('return', 'profile.html');
    window.history.replaceState({}, '', `home.html?${params.toString()}`);
    openAuthModal('login');
  });
}

function initAuth() {
  const user = getStoredUser();
  updateNavForUser(user);
  initHeroLinks(user);

  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === '1' && !isLoggedIn()) {
    openAuthModal('login');
  }

  if (isLoggedIn() && params.get('return')) {
    window.location.replace(getPostLoginRedirect(user));
    return;
  }

  document.getElementById('btnOpenLogin')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('btnOpenRegister')?.addEventListener('click', () => openAuthModal('register'));
  document.getElementById('authClose')?.addEventListener('click', closeAuthModal);
  document.getElementById('btnLogout')?.addEventListener('click', handleLogout);

  document.getElementById('authOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'authOverlay') closeAuthModal();
  });

  document.querySelectorAll('.auth-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });

  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAuthModal();
  });
}

document.addEventListener('DOMContentLoaded', initAuth);
