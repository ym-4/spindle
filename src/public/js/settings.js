function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
}

function openSettingsPane(id) {
  document.getElementById('settingsMenuView').classList.add('is-hidden');
  document.getElementById('settingsDetailView').classList.remove('is-hidden');
  document.querySelectorAll('.settings-pane').forEach((p) => p.classList.add('is-hidden'));
  document.getElementById(`pane-${id}`)?.classList.remove('is-hidden');
}

function closeSettingsPane() {
  document.getElementById('settingsMenuView').classList.remove('is-hidden');
  document.getElementById('settingsDetailView').classList.add('is-hidden');
}

async function loadSettings() {
  const { settings } = await authFetch('/profile/settings');
  document.getElementById('accDisplayName').value = settings.display_name || settings.name || '';
  document.getElementById('accEmail').value = settings.email || '';
  document.getElementById('accBio').value = settings.bio || '';
  document.getElementById('accLanguage').value = settings.language || 'en';
  document.getElementById('accTimezone').value = settings.timezone || 'Asia/Singapore';
  document.getElementById('sec2fa').checked = !!settings.two_factor_enabled;
  document.getElementById('secLoginNotify').checked = settings.login_notifications !== false;
  document.getElementById('appTheme').value = settings.theme || 'dark';
  document.getElementById('appCompact').checked = !!settings.compact_mode;
  document.getElementById('appFontSize').value = settings.font_size || 'medium';
  document.getElementById('privPublic').checked = settings.public_profile !== false;
  document.getElementById('privTracking').checked = settings.activity_tracking !== false;
  document.getElementById('paymentBillingName').value = settings.billing_name || '';
  document.getElementById('paymentMethod').value = settings.payment_method || '';
  if (settings.card_last4) {
    document.getElementById('paymentCardInput').placeholder = `•••• •••• •••• ${settings.card_last4}`;
  }
  applyTheme(settings.theme);
  const preview = document.getElementById('avatarPreview');
  if (settings.profile_image) {
    preview.innerHTML = `<img src="${mediaUrl(settings.profile_image)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
  } else {
    preview.textContent = (settings.name || '?').slice(0, 2).toUpperCase();
  }
  loadSessions();
}

async function autoSaveToggle(el) {
  const body = { [el.dataset.field]: el.type === 'checkbox' ? el.checked : el.value };
  try {
    await authFetch(`/profile/settings/${el.dataset.autosave}`, { method: 'PUT', body: JSON.stringify(body) });
    if (el.dataset.field === 'theme') applyTheme(el.value);
    showToast('Saved');
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadSessions() {
  const list = document.getElementById('sessionsList');
  if (!list) return;
  const { sessions } = await authFetch('/profile/settings/sessions');
  list.innerHTML =
    sessions.length === 0
      ? '<li class="wa-list-empty">No linked devices</li>'
      : sessions
          .map(
            (s) => `
      <li class="wa-list-item">
        <div class="wa-list-body"><strong>${s.device_label || 'Device'}</strong><span>${new Date(s.last_active).toLocaleString()}</span></div>
        <button type="button" class="wa-btn wa-btn--ghost wa-btn--small" data-revoke="${s.id}">Revoke</button>
      </li>`,
          )
          .join('');
  list.querySelectorAll('[data-revoke]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await authFetch(`/profile/settings/sessions/${btn.dataset.revoke}`, { method: 'DELETE' });
        showToast('Device revoked');
        let sid = getStoredUser()?.sessionId;
        if (!sid && getToken()) {
          try {
            sid = JSON.parse(atob(getToken().split('.')[1])).sessionId;
          } catch {
            /* ignore */
          }
        }
        if (String(btn.dataset.revoke) === String(sid)) {
          handleLogout();
          return;
        }
        loadSessions();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

function bindSettings() {
  document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => openSettingsPane(btn.dataset.open));
  });
  document.getElementById('settingsBack')?.addEventListener('click', closeSettingsPane);

  document.getElementById('avatarFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('avatar', file);
    const res = await fetch(`${API_BASE}/auth/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(data.error || 'Upload failed', true);
    showToast('Photo updated');
    loadSettings();
  });

  document.getElementById('btnSaveBio')?.addEventListener('click', async () => {
    await authFetch('/profile/settings/account', {
      method: 'PUT',
      body: JSON.stringify({ bio: document.getElementById('accBio').value }),
    });
    showToast('Bio saved');
  });

  document.getElementById('accountForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await authFetch('/profile/settings/account', {
        method: 'PUT',
        body: JSON.stringify({
          display_name: document.getElementById('accDisplayName').value,
          email: document.getElementById('accEmail').value,
          language: document.getElementById('accLanguage').value,
          timezone: document.getElementById('accTimezone').value,
        }),
      });
      showToast('Account saved');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.querySelectorAll('[data-autosave]').forEach((el) => {
    el.addEventListener('change', () => autoSaveToggle(el));
  });

  document.getElementById('btnRequestPwdCode')?.addEventListener('click', async () => {
    try {
      const data = await authFetch('/profile/settings/password/request-code', { method: 'POST' });
      const hint = data.previewCode ? ` Code: ${data.previewCode}` : '';
      showToast(`2FA code sent to your email.${hint}`);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('newPasswordConfirm').value;
    if (newPw !== confirmPw) {
      showToast('New passwords do not match', true);
      return;
    }
    try {
      await authFetch('/profile/settings/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: document.getElementById('curPassword').value,
          new_password: newPw,
          new_password_confirm: confirmPw,
          code: document.getElementById('pwd2faCode').value.trim(),
        }),
      });
      showToast('Password updated');
      e.target.reset();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('paymentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cardRaw = document.getElementById('paymentCardInput').value.replace(/\D/g, '');
    try {
      await authFetch('/profile/payment', {
        method: 'PUT',
        body: JSON.stringify({
          billing_name: document.getElementById('paymentBillingName').value,
          payment_method: document.getElementById('paymentMethod').value,
          card_last4: cardRaw.length >= 4 ? cardRaw.slice(-4) : '',
        }),
      });
      showToast('Payment saved');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  let dangerAction = null;

  function showDangerModal({ title, bullets, extra, onConfirm }) {
    document.getElementById('dangerModalTitle').textContent = title;
    document.getElementById('dangerModalList').innerHTML = bullets.map((b) => `<li>${b}</li>`).join('');
    document.getElementById('dangerModalExtra').textContent = extra || '';
    dangerAction = onConfirm;
    document.getElementById('dangerModal').classList.remove('hidden');
  }

  document.getElementById('dangerModalCancel')?.addEventListener('click', () => {
    document.getElementById('dangerModal').classList.add('hidden');
    dangerAction = null;
  });

  document.getElementById('dangerModalConfirm')?.addEventListener('click', async () => {
    const fn = dangerAction;
    document.getElementById('dangerModal').classList.add('hidden');
    dangerAction = null;
    if (fn) await fn();
  });

  document.getElementById('btnDeactivate')?.addEventListener('click', () => {
    showDangerModal({
      title: 'Deactivate your account?',
      bullets: [
        'You will be logged out immediately on all devices.',
        'Friends cannot message or call you until you reactivate.',
        'Your chats and profile are hidden, not erased.',
        'Support or an admin can restore your account later.',
      ],
      extra: 'This is reversible. You can ask to reactivate your account.',
      onConfirm: async () => {
        await authFetch('/profile/settings/deactivate', { method: 'POST' });
        handleLogout();
      },
    });
  });

  document.getElementById('btnDeleteAccount')?.addEventListener('click', () => {
    showDangerModal({
      title: 'Permanently delete your account?',
      bullets: [
        'All personal messages, call history, and friend links are removed.',
        'Your profile photo, bio, and settings cannot be recovered.',
        'Group memberships and marketplace listings tied to you may be lost.',
        'This action cannot be undone — there is no trash folder.',
      ],
      extra: 'Type DELETE in the next step to proceed. Only continue if you are absolutely sure.',
      onConfirm: async () => {
        const typed = prompt('Type DELETE in capital letters to permanently delete your account:');
        if (typed !== 'DELETE') {
          showToast('Deletion cancelled — you must type DELETE exactly.', true);
          return;
        }
        await authFetch('/profile/settings/delete', {
          method: 'POST',
          body: JSON.stringify({ confirm: 'DELETE' }),
        });
        handleLogout();
      },
    });
  });

  document.getElementById('btnExportData')?.addEventListener('click', async () => {
    const data = await authFetch('/profile/settings/export');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)]));
    a.download = 'my-data.json';
    a.click();
    showToast('Download started');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!isLoggedIn()) {
    redirectToLogin('settings.html');
    return;
  }
  injectWaHeader('Settings');
  injectWaNav('settings');
  refreshNotifBadge();
  bindSettings();
  loadSettings();
});
