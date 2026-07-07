function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

async function loadStories() {
  const grid = document.getElementById('storiesGrid');
  const empty = document.getElementById('storiesEmpty');
  const { stories } = await authFetch('/stories');
  if (stories.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = stories
    .map(
      (s) => `
    <article class="wa-story-card">
      <img src="${mediaUrl(s.media_url)}" alt="" />
      <div style="padding: 0.5rem">
        <strong>${esc(s.display_name || s.name)}</strong>
        ${s.caption ? `<p style="margin:0.25rem 0;font-size:0.8rem">${esc(s.caption)}</p>` : ''}
        <small style="color:var(--wa-muted)">${new Date(s.created_at).toLocaleString()}</small>
      </div>
    </article>`,
    )
    .join('');
}

document.getElementById('storyForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = document.getElementById('storyFile').files?.[0];
  if (!file) return showToast('Choose a photo', true);
  const fd = new FormData();
  fd.append('media', file);
  fd.append('caption', document.getElementById('storyCaption').value);
  const res = await fetch(`${API_BASE}/stories`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return showToast(data.error || 'Upload failed', true);
  showToast('Status posted!');
  document.getElementById('storyForm').reset();
  loadStories();
});

document.addEventListener('DOMContentLoaded', () => {
  if (!isLoggedIn()) {
    redirectToLogin('stories.html');
    return;
  }
  injectWaHeader('Status');
  injectWaNav('stories');
  refreshNotifBadge();
  loadStories();
});
