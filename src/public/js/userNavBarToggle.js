(function () {
  function getStoredToken() {
    if (typeof getToken === 'function') return getToken();
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('pineappleToken') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('pineappleToken')
    );
  }

  function isAuthenticated() {
    if (typeof isLoggedIn === 'function') return isLoggedIn();
    const token = getStoredToken();
    if (!token) return false;
    if (typeof getStoredUser === 'function') return !!getStoredUser();
    return true;
  }

  function handleNavbarLogout(event) {
    event.preventDefault();
    if (typeof handleLogout === 'function') {
      handleLogout();
      return;
    }
    if (typeof clearAuth === 'function') {
      clearAuth();
    } else {
      ['token', 'pineappleToken', 'loggedInUserId', 'pineappleUser', 'displayName'].forEach(
        (key) => {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        },
      );
    }
    window.location.href = 'home.html';
  }

  function ensureAuthButtons() {
    const target = document.querySelector('.navbar-right');
    if (!target) return;

    const page = window.location.pathname.split('/').pop() || 'index.html';
    const returnPath = encodeURIComponent(page === 'home.html' ? 'index.html' : page);

    if (!document.getElementById('loginButton')) {
      const loginButton = document.createElement('a');
      loginButton.id = 'loginButton';
      loginButton.href = `home.html?login=1&tab=login&return=${returnPath}`;
      loginButton.className = 'btn-navbar-login';
      loginButton.textContent = 'Log In';
      target.prepend(loginButton);
    }

    if (!document.getElementById('registerButton')) {
      const registerButton = document.createElement('a');
      registerButton.id = 'registerButton';
      registerButton.href = `home.html?login=1&tab=register&return=${returnPath}`;
      registerButton.className = 'btn-navbar-signup';
      registerButton.textContent = 'Sign Up';
      target.prepend(registerButton);
    }
  }

  function applyNavbarState() {
    ensureAuthButtons();
    const loggedIn = isAuthenticated();
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const profileButton = document.getElementById('profileButton');
    const logoutButton = document.getElementById('logoutButton');

    [loginButton, registerButton].forEach((button) => {
      if (!button) return;
      button.classList.toggle('d-none', loggedIn);
      button.classList.toggle('hidden', loggedIn);
      button.style.display = loggedIn ? 'none' : '';
    });

    [profileButton, logoutButton].forEach((button) => {
      if (!button) return;
      button.classList.toggle('d-none', !loggedIn);
      button.classList.toggle('hidden', !loggedIn);
      button.style.display = loggedIn ? '' : 'none';
    });

    if (logoutButton) {
      logoutButton.onclick = handleNavbarLogout;
      logoutButton.removeEventListener('click', handleNavbarLogout);
      logoutButton.addEventListener('click', handleNavbarLogout);
    }
  }

  function init() {
    applyNavbarState();
    window.addEventListener('storage', applyNavbarState);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) applyNavbarState();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
