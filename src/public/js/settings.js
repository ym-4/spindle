function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || 'light';
  localStorage.setItem('spindle-theme', theme || 'light');
}

function showToast(msg, isError) {
  var toast = document.getElementById('settingsToast');
  var body = document.getElementById('settingsToastBody');
  if (!toast || !body) return;
  body.textContent = msg;
  toast.className =
    'toast align-items-center text-white border-0 ' + (isError ? 'bg-danger' : 'bg-success');
  var bs = bootstrap?.Toast || window.Toast;
  if (bs) {
    var t = new bs(toast);
    t.show();
  }
}

function saveFeedback(id) {
  var el = document.getElementById(id);
  if (el) {
    el.style.display = 'block';
    setTimeout(function () {
      el.style.display = 'none';
    }, 2500);
  }
}

document.addEventListener('click', function (e) {
  var btn = e.target.closest('.set-accordion-header');
  if (!btn) return;
  var targetId = btn.getAttribute('data-target');
  var body = document.getElementById(targetId);
  if (!body) return;
  var expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', !expanded);
  body.classList.toggle('open');
});

function showConfirmModal(title, bodyText, onOk) {
  document.getElementById('confirmModalTitle').textContent = title;
  document.getElementById('confirmModalBody').textContent = bodyText;
  document.getElementById('confirmModal').classList.remove('hidden');
var okBtn = document.getElementById('confirmModalOk');
var cancelBtn = document.getElementById('confirmModalCancel');
var okHandler = function () {
  document.getElementById('confirmModal').classList.add('hidden');
  okBtn.removeEventListener('click', okHandler);
  cancelBtn.removeEventListener('click', cancelHandler);
  onOk();
};
var cancelHandler = function () {
  document.getElementById('confirmModal').classList.add('hidden');
  okBtn.removeEventListener('click', okHandler);
  cancelBtn.removeEventListener('click', cancelHandler);
};
okBtn.addEventListener('click', okHandler);
cancelBtn.addEventListener('click', cancelHandler);
}

async function loadSettings() {
  try {
    var data = await authFetch('/profile/settings');
    var s = data.settings || {};
    document.getElementById('accDisplayName').value = s.display_name || s.name || '';
    document.getElementById('accEmail').value = s.email || '';
    var phoneEl = document.getElementById('accPhone');
    if (phoneEl) phoneEl.value = s.phone || '';
    document.getElementById('accLanguage').value = s.language || 'en';
    document.getElementById('accTimezone').value = s.timezone || 'Asia/Singapore';
    document.getElementById('sec2fa').checked = !!s.two_factor_enabled;
    document.getElementById('secLoginNotify').checked = s.login_notifications !== false;
    document.getElementById('appTheme').value = s.theme || 'light';
    document.getElementById('appCompact').checked = !!s.compact_mode;
    document.getElementById('appFontSize').value = s.font_size || 'medium';
    document.getElementById('privPublic').checked = s.public_profile !== false;
    document.getElementById('privTracking').checked = s.activity_tracking !== false;
    document.getElementById('paymentBillingName').value = s.billing_name || '';
    document.getElementById('paymentMethod').value = s.payment_method || '';
    if (s.card_last4) {
      document.getElementById('paymentCardInput').placeholder =
        '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ' +
        s.card_last4;
    }
    applyTheme(s.theme);

    if (s.last_display_name_change) {
      var daysSince = (Date.now() - new Date(s.last_display_name_change).getTime()) / 86400000;
      if (daysSince < 7) {
        var nextDate = new Date(s.last_display_name_change);
        nextDate.setDate(nextDate.getDate() + 7);
        var el = document.getElementById('displayNameLimitMsg');
        el.textContent = 'You can change your display name again on ' + nextDate.toLocaleDateString();
        el.style.display = 'block';
        document.getElementById('accDisplayName').disabled = true;
      }
    }

    loadSessions();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function loadSessions() {
  var list = document.getElementById('sessionsList');
  if (!list) return;
  try {
    var data = await authFetch('/profile/settings/sessions');
    var sessions = data.sessions || [];
    list.innerHTML =
      sessions.length === 0
        ? '<li class="list-group-item text-muted small">No linked devices</li>'
        : sessions
            .map(function (s) {
              return (
                '<li class="list-group-item d-flex justify-content-between align-items-center py-2"><span><strong>' +
                (s.device_label || 'Device') +
                '</strong><br /><small class="text-muted">' +
                new Date(s.last_active).toLocaleString() +
                '</small></span><button type="button" class="btn btn-outline-danger btn-sm" data-revoke="' +
                s.id +
                '">Revoke</button></li>'
              );
            })
            .join('');
    list.querySelectorAll('[data-revoke]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await authFetch('/profile/settings/sessions/' + btn.dataset.revoke, { method: 'DELETE' });
          showToast('Device revoked');
          var sid = getStoredUser()?.sessionId;
          if (!sid && getToken()) {
            try {
              sid = JSON.parse(atob(getToken().split('.')[1])).sessionId;
            } catch {}
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
  } catch (e) {
    showToast(e.message, true);
  }
}

function bindSettings() {
  // Account save — show password confirmation first
  var accountChanges = {};

  document.getElementById('btnSaveAccount').addEventListener('click', function () {
    accountChanges = {
      display_name: document.getElementById('accDisplayName').value,
      email: document.getElementById('accEmail').value,
      phone: document.getElementById('accPhone').value,
      language: document.getElementById('accLanguage').value,
      timezone: document.getElementById('accTimezone').value,
    };
    document.getElementById('accPasswordConfirm').style.display = 'block';
    document.getElementById('accConfirmPassword').value = '';
    document.getElementById('accConfirmPassword').focus();
  });

  document.getElementById('btnSaveAccountCancel').addEventListener('click', function () {
    document.getElementById('accPasswordConfirm').style.display = 'none';
  });

  document.getElementById('btnSaveAccountConfirm').addEventListener('click', async function () {
    var pw = document.getElementById('accConfirmPassword').value;
    if (!pw) { showToast('Please enter your current password.', true); return; }
    try {
      await authFetch('/profile/settings/account', {
        method: 'PUT',
        body: JSON.stringify(Object.assign({ current_password: pw }, accountChanges)),
      });
      document.getElementById('accPasswordConfirm').style.display = 'none';
      saveFeedback('accSaveFeedback');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // Change email button
  document.getElementById('btnChangeEmail')?.addEventListener('click', function () {
    var inp = document.getElementById('accEmail');
    inp.readOnly = !inp.readOnly;
    if (!inp.readOnly) inp.focus();
    this.textContent = inp.readOnly ? 'Change' : 'Done';
  });

  // Theme
  document.getElementById('appTheme').addEventListener('change', function () {
    applyTheme(this.value);
    authFetch('/profile/settings/appearance', {
      method: 'PUT',
      body: JSON.stringify({ theme: this.value }),
    }).catch(function () {});
  });
  document.getElementById('appFontSize').addEventListener('change', function () {
    authFetch('/profile/settings/appearance', {
      method: 'PUT',
      body: JSON.stringify({ font_size: this.value }),
    }).catch(function () {});
  });
  document.getElementById('appCompact').addEventListener('change', function () {
    authFetch('/profile/settings/appearance', {
      method: 'PUT',
      body: JSON.stringify({ compact_mode: this.checked }),
    }).catch(function () {});
  });

  // 2FA / login notify
  document.getElementById('sec2fa').addEventListener('change', function () {
    authFetch('/profile/settings/security', {
      method: 'PUT',
      body: JSON.stringify({ two_factor_enabled: this.checked }),
    }).catch(function () {});
  });
  document.getElementById('secLoginNotify').addEventListener('change', function () {
    authFetch('/profile/settings/security', {
      method: 'PUT',
      body: JSON.stringify({ login_notifications: this.checked }),
    }).catch(function () {});
  });

  // Privacy
  document.getElementById('privPublic').addEventListener('change', function () {
    authFetch('/profile/settings/privacy', {
      method: 'PUT',
      body: JSON.stringify({ public_profile: this.checked }),
    }).catch(function () {});
  });
  document.getElementById('privTracking').addEventListener('change', function () {
    authFetch('/profile/settings/privacy', {
      method: 'PUT',
      body: JSON.stringify({ activity_tracking: this.checked }),
    }).catch(function () {});
  });

  // Password
  document.getElementById('btnRequestPwdCode').addEventListener('click', async function () {
    try {
      var data = await authFetch('/profile/settings/password/request-code', { method: 'POST' });
      showToast('Code sent' + (data.previewCode ? ' (dev: ' + data.previewCode + ')' : ''));
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('btnUpdatePassword').addEventListener('click', function () {
    var newPw = document.getElementById('newPassword').value;
    var confirmPw = document.getElementById('newPasswordConfirm').value;
    if (!newPw || !confirmPw) {
      showToast('Please fill in new password fields.', true);
      return;
    }
    if (newPw !== confirmPw) {
      showToast('Passwords do not match', true);
      return;
    }
    showConfirmModal('Change password?', 'Are you sure you want to change your password?', async function () {
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
        document.getElementById('curPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('newPasswordConfirm').value = '';
        document.getElementById('pwd2faCode').value = '';
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });

  // Payment
  document.getElementById('btnSavePayment').addEventListener('click', async function () {
    var cardRaw = document.getElementById('paymentCardInput').value.replace(/\D/g, '');
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

  // Danger modal
  var dangerAction = null;
  function showDangerModal(opts) {
    document.getElementById('dangerModalTitle').textContent = opts.title;
    document.getElementById('dangerModalList').innerHTML = opts.bullets
      .map(function (b) {
        return '<li>' + b + '</li>';
      })
      .join('');
    document.getElementById('dangerModalExtra').textContent = opts.extra || '';
    dangerAction = opts.onConfirm;
    document.getElementById('dangerModal').classList.remove('hidden');
  }
  document.getElementById('dangerModalCancel').addEventListener('click', function () {
    document.getElementById('dangerModal').classList.add('hidden');
    dangerAction = null;
  });
  document.getElementById('dangerModalConfirm').addEventListener('click', async function () {
    var fn = dangerAction;
    document.getElementById('dangerModal').classList.add('hidden');
    dangerAction = null;
    if (fn) await fn();
  });

  document.getElementById('btnDeactivate').addEventListener('click', function () {
    showDangerModal({
      title: 'Deactivate your account?',
      bullets: [
        'You will be logged out on all devices.',
        'Friends cannot message you until you reactivate.',
        'Your profile is hidden, not erased.',
        'An admin can restore your account.',
      ],
      extra: 'This is reversible.',
      onConfirm: async function () {
        await authFetch('/profile/settings/deactivate', { method: 'POST' });
        handleLogout();
      },
    });
  });

  document.getElementById('btnDeleteAccount').addEventListener('click', function () {
    showDangerModal({
      title: 'Permanently delete your account?',
      bullets: [
        'All messages, calls, and friend links are removed.',
        'Your profile cannot be recovered.',
        'This cannot be undone.',
      ],
      extra: 'Type DELETE in the next prompt to confirm.',
      onConfirm: async function () {
        var typed = prompt('Type DELETE to permanently delete your account:');
        if (typed !== 'DELETE') {
          showToast('Deletion cancelled.', true);
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

  document.getElementById('btnExportData').addEventListener('click', async function () {
    try {
      var data = await authFetch('/profile/settings/export');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)]));
      a.download = 'my-data.json';
      a.click();
      showToast('Download started');
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

function handleLogout() {
  clearAuth();
  window.location.href = 'home.html';
}

document.addEventListener('DOMContentLoaded', function () {
  if (!isLoggedIn()) {
    redirectToLogin('settings.html');
    return;
  }
  if (document.getElementById('waHeaderSlot')) injectWaHeader('Settings');
  if (document.getElementById('waNavSlot')) injectWaNav('settings');
  refreshNotifBadge();
  bindSettings();
  loadSettings();
});