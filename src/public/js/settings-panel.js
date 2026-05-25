let settingsCache = null;

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.compact = settingsCache?.compact_mode ? '1' : '0';
  document.documentElement.dataset.fontSize = settingsCache?.font_size || 'medium';
}

async function loadAllSettings() {
  const { settings } = await authFetch('/profile/settings');
  settingsCache = settings;
  applyTheme(settings.theme);
  fillSettingsForms(settings);
}

function fillSettingsForms(s) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v ?? '';
  };
  const setCheck = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!v;
  };
  set('accDisplayName', s.display_name || s.name);
  set('accEmail', s.email);
  set('accLanguage', s.language || 'en');
  set('accTimezone', s.timezone || 'Asia/Singapore');
  set('accBio', s.bio);
  set('paymentBillingName', s.billing_name);
  set('paymentMethod', s.payment_method);
  set('paymentCardLast4', s.card_last4);
  setCheck('sec2fa', s.two_factor_enabled);
  setCheck('secLoginNotify', s.login_notifications);
  setCheck('ntfEmail', s.notify_email);
  setCheck('ntfProduct', s.notify_product);
  setCheck('ntfSecurity', s.notify_security);
  set('ntfFrequency', s.notify_frequency || 'weekly');
  set('appTheme', s.theme || 'dark');
  setCheck('appCompact', s.compact_mode);
  set('appFontSize', s.font_size || 'medium');
  setCheck('privPublic', s.public_profile);
  setCheck('privTracking', s.activity_tracking);
  set('privCookies', s.cookie_preferences || 'essential');
  const preview = document.getElementById('avatarPreview');
  if (preview) {
    if (s.profile_image) {
      preview.innerHTML = `<img src="${esc(s.profile_image)}" alt="Profile" />`;
    } else {
      preview.textContent = (s.avatar || s.name || '?').slice(0, 2).toUpperCase();
    }
  }
}

function setupSettingsNav() {
  document.querySelectorAll('.settings-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.settingsPanel;
      document.querySelectorAll('.settings-nav-btn').forEach((b) => {
        b.classList.toggle('settings-nav-btn--active', b === btn);
      });
      document.querySelectorAll('.settings-panel-pane').forEach((p) => {
        p.classList.toggle('hidden', p.id !== `settingsPane-${panel}`);
      });
    });
  });
}

async function saveAccount(e) {
  e.preventDefault();
  const msg = document.getElementById('accMsg');
  try {
    const { settings } = await authFetch('/profile/settings/account', {
      method: 'PUT',
      body: JSON.stringify({
        display_name: document.getElementById('accDisplayName').value,
        email: document.getElementById('accEmail').value,
        bio: document.getElementById('accBio').value,
        language: document.getElementById('accLanguage').value,
        timezone: document.getElementById('accTimezone').value,
      }),
    });
    settingsCache = settings;
    msg.textContent = 'Account saved.';
    msg.className = 'form-msg form-msg--success';
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'form-msg form-msg--error';
  }
}

async function uploadAvatar(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('avatar', file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/auth/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  await loadAllSettings();
}

function bindSettingsForms() {
  document.getElementById('accountSettingsForm')?.addEventListener('submit', saveAccount);
  document.getElementById('avatarFile')?.addEventListener('change', uploadAvatar);
  document.getElementById('securityForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await authFetch('/profile/settings/security', {
      method: 'PUT',
      body: JSON.stringify({
        two_factor_enabled: document.getElementById('sec2fa').checked,
        login_notifications: document.getElementById('secLoginNotify').checked,
      }),
    });
  });
  document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await authFetch('/profile/settings/password', {
      method: 'PUT',
      body: JSON.stringify({
        current_password: document.getElementById('curPassword').value,
        new_password: document.getElementById('newPassword').value,
      }),
    });
    document.getElementById('passMsg').textContent = 'Password updated.';
  });
  document.getElementById('notificationsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await authFetch('/profile/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify({
        notify_email: document.getElementById('ntfEmail').checked,
        notify_product: document.getElementById('ntfProduct').checked,
        notify_security: document.getElementById('ntfSecurity').checked,
        notify_frequency: document.getElementById('ntfFrequency').value,
      }),
    });
  });
  document.getElementById('appearanceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { settings } = await authFetch('/profile/settings/appearance', {
      method: 'PUT',
      body: JSON.stringify({
        theme: document.getElementById('appTheme').value,
        compact_mode: document.getElementById('appCompact').checked,
        font_size: document.getElementById('appFontSize').value,
      }),
    });
    applyTheme(settings.theme);
  });
  document.getElementById('privacyForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await authFetch('/profile/settings/privacy', {
      method: 'PUT',
      body: JSON.stringify({
        public_profile: document.getElementById('privPublic').checked,
        activity_tracking: document.getElementById('privTracking').checked,
        cookie_preferences: document.getElementById('privCookies').value,
      }),
    });
  });
  document.getElementById('btnExportData')?.addEventListener('click', async () => {
    const data = await authFetch('/profile/settings/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'campus-hub-data.json';
    a.click();
  });
  document.getElementById('btnDeactivate')?.addEventListener('click', async () => {
    if (!confirm('Deactivate your account? You can contact support to reactivate.')) return;
    await authFetch('/profile/settings/deactivate', { method: 'POST' });
    handleLogout();
  });
  document.getElementById('btnDeleteAccount')?.addEventListener('click', async () => {
    const confirmText = prompt('Type DELETE to permanently remove your account:');
    if (confirmText !== 'DELETE') return;
    await authFetch('/profile/settings/delete', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    handleLogout();
  });
  loadSessions();
}

async function loadSessions() {
  const list = document.getElementById('sessionsList');
  if (!list) return;
  const { sessions } = await authFetch('/profile/settings/sessions');
  list.innerHTML =
    sessions.length === 0
      ? '<li class="profile-list-empty">No active sessions.</li>'
      : sessions
          .map(
            (s) => `
      <li class="profile-list-item">
        <span>${esc(s.device_label)} · ${esc(s.ip_address || '')}<br><small>${new Date(s.last_active).toLocaleString()}</small></span>
        <button type="button" class="btn-neon btn-neon--small" data-revoke-session="${s.id}">Revoke</button>
      </li>`,
          )
          .join('');
  list.querySelectorAll('[data-revoke-session]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await authFetch(`/profile/settings/sessions/${btn.dataset.revokeSession}`, { method: 'DELETE' });
      loadSessions();
    });
  });
}

let settingsPanelBound = false;

function initSettingsPanel() {
  if (!settingsPanelBound) {
    settingsPanelBound = true;
    setupSettingsNav();
    bindSettingsForms();
  }
  loadAllSettings();
}
