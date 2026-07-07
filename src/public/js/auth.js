let pendingVerifyEmail = '';
let pendingVerifyStep = 'register';

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
  const verifyForm = document.getElementById('verifyForm');
  if (verifyForm) verifyForm.classList.remove('is-active');
  const msg = document.getElementById('authMessage');
  if (msg) showMessage(msg, '');
  const title = document.querySelector('.auth-modal__panel h1');
  if (title) title.textContent = tab === 'register' ? 'REGISTER' : 'LOGIN';
}

function showVerifyStep(email, previewCode, step = 'register') {
  document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('is-active'));
  document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('is-active'));
  const verifyForm = document.getElementById('verifyForm');
  if (verifyForm) verifyForm.classList.add('is-active');
  pendingVerifyEmail = email;
  pendingVerifyStep = step;

  const title = document.getElementById('verifyTitle');
  const hintEl = document.getElementById('verifyHint');
  const rememberRow = document.getElementById('verifyRememberRow');

  if (title) {
    title.textContent =
      step === 'login' ? 'Two-step verification' : 'Verify your Gmail';
  }
  const safeEmail = String(email || '').replace(/</g, '');
  if (hintEl) {
    hintEl.innerHTML =
      step === 'login'
        ? `Enter the 6-digit code sent to <strong>${safeEmail}</strong> (simulated Gmail for now).`
        : `Finish registration — code sent to <strong>${safeEmail}</strong>.`;
  }
  if (rememberRow) rememberRow.classList.toggle('hidden', step !== 'login');
  const msg = document.getElementById('authMessage');
  const hint = previewCode
    ? `Code (dev preview): ${previewCode}`
    : 'Check your Gmail inbox for the 6-digit code.';
  showMessage(msg, hint, 'success');
}

function finishAuth(user, token, msgEl, rememberToken) {
  setAuth(user, token);
  if (rememberToken) setRememberToken(rememberToken);
  showMessage(msgEl, `Welcome, ${user.display_name || user.name}!`, 'success');
  updateNavForUser(user);
  initHeroLinks(user);
  if (typeof injectWaNav === 'function') injectWaNav('home');
  if (document.getElementById('waHeaderSlot') && typeof injectHeaderActions === 'function') {
    injectHeaderActions('waHeaderSlot');
  }
  setTimeout(() => {
    closeAuthModal();
    redirectAfterLogin(user);
  }, 500);
}

async function handleLogin(event) {
  event.preventDefault();
  const msg = document.getElementById('authMessage');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    showMessage(msg, 'Checking password...', '');
    const data = await authFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        remember_token: getRememberToken(),
      }),
    });

    if (data.needs2FA) {
      showVerifyStep(data.email, data.previewCode, 'login');
      return;
    }
    if (data.needsVerification) {
      showVerifyStep(data.email, data.previewCode, 'register');
      return;
    }

    finishAuth(data.user, data.token, msg, data.remember_token);
  } catch (err) {
    if (err.needsVerification) {
      showVerifyStep(err.email || username, err.previewCode, 'register');
      return;
    }
    if (err.banned) {
      var until = err.suspended_until ? new Date(err.suspended_until) : null;
      var isPerm = until && until.getFullYear() >= 2999;
      var durStr = isPerm ? 'permanently' : (until ? 'until ' + until.toLocaleDateString() : '');
      showMessage(msg, 'Your account has been banned ' + durStr + '. Reason: ' + (err.reason || 'Not specified'), 'error');
      var loginForm = document.getElementById('loginForm');
      if (loginForm) {
        var existing = loginForm.querySelector('.appeal-section');
        if (!existing) {
          var div = document.createElement('div');
          div.className = 'appeal-section mt-3';
          div.innerHTML = '<hr><p class="small text-muted">If you believe this was a mistake, submit an appeal:</p><textarea id="appealMessage" class="form-control form-control-sm mb-2" rows="2" placeholder="Write your appeal..."></textarea><button type="button" class="btn btn-outline-warning btn-sm w-100" id="btnSubmitAppeal">Submit Appeal</button><div id="appealResult" class="small mt-1"></div>';
          loginForm.appendChild(div);
          document.getElementById('btnSubmitAppeal').addEventListener('click', async function () {
            var msg = document.getElementById('appealMessage').value.trim();
            if (!msg) { document.getElementById('appealResult').textContent = 'Please write a message.'; return; }
            try {
              var res = await fetch('/auth/appeal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: err.user_id, message: msg })
              });
              var d = await res.json();
              document.getElementById('appealResult').textContent = d.message || 'Appeal submitted.';
              document.getElementById('appealResult').className = 'small text-success mt-1';
              document.getElementById('appealMessage').disabled = true;
              document.getElementById('btnSubmitAppeal').disabled = true;
            } catch (e) {
              document.getElementById('appealResult').textContent = 'Failed to submit appeal.';
              document.getElementById('appealResult').className = 'small text-danger mt-1';
            }
          });
        }
      }
      return;
    }
    showMessage(msg, err.message, 'error');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const msg = document.getElementById('authMessage');
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;

  try {
    showMessage(msg, 'Creating account and sending Gmail code...', '');
    const data = await authFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (data.needsVerification) {
      showVerifyStep(data.email, data.previewCode, 'register');
      return;
    }
    finishAuth(data.user, data.token, msg, data.remember_token);
  } catch (err) {
    showMessage(msg, err.message, 'error');
  }
}

async function handleVerify(event) {
  event.preventDefault();
  const msg = document.getElementById('authMessage');
  const code = document.getElementById('verifyCode').value.trim();
  const rememberMe = document.getElementById('verifyRemember')?.checked;

  try {
    if (pendingVerifyStep === 'login') {
      const data = await authFetch('/auth/verify-login', {
        method: 'POST',
        body: JSON.stringify({
          email: pendingVerifyEmail,
          code,
          remember_me: rememberMe,
        }),
      });
      finishAuth(data.user, data.token, msg, data.remember_token);
      return;
    }

    const data = await authFetch('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: pendingVerifyEmail, code }),
    });
    finishAuth(data.user, data.token, msg, data.remember_token);
  } catch (err) {
    showMessage(msg, err.message, 'error');
  }
}

async function handleResendCode() {
  const msg = document.getElementById('authMessage');
  const purpose = pendingVerifyStep === 'login' ? 'login_2fa' : 'email_verify';
  try {
    const data = await authFetch('/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify({ email: pendingVerifyEmail, purpose }),
    });
    showMessage(
      msg,
      data.previewCode ? `New code: ${data.previewCode}` : 'Code resent to your email.',
      'success',
    );
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
  const userLinks = document.getElementById('heroLinksUser');
  if (!userLinks) return;
  userLinks.classList.toggle('hidden', !user);
  if (user && userLinks.children.length === 0) {
    userLinks.innerHTML = `
      <a href="chat.html">Open chats</a>
      <a href="stories.html">Status</a>
      <a href="settings.html">Settings</a>`;
  }
}

function initAuth() {
  const user = getStoredUser();
  updateNavForUser(user);
  initHeroLinks(user);

  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === '1' && !isLoggedIn()) {
    openAuthModal(params.get('tab') === 'register' ? 'register' : 'login');
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
  document.getElementById('verifyForm')?.addEventListener('submit', handleVerify);
  document.getElementById('btnResendCode')?.addEventListener('click', handleResendCode);
}

document.addEventListener('DOMContentLoaded', initAuth);

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('loggedInUserId');
    localStorage.removeItem('pineappleUser');
    localStorage.removeItem('pineappleToken');
    localStorage.removeItem('displayName');
    
    // Redirect to login page
    window.location.href = 'login.html';
}