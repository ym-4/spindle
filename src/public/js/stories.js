function esc(t) {
  var d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

async function loadStories() {
  var grid = document.getElementById('storiesGrid');
  var empty = document.getElementById('storiesEmpty');
  if (!grid) return;
  try {
    var data = await authFetch('/stories');
    var stories = data.stories || [];
    if (stories.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    grid.innerHTML = stories.map(function (s) {
      return '<div class="col-sm-6 col-md-4 col-lg-3"><div class="card shadow-sm h-100"><img src="' + mediaUrl(s.media_url) + '" class="card-img-top" style="height:200px;object-fit:cover;" alt="" /><div class="card-body p-2"><strong>' + esc(s.display_name || s.name) + '</strong>' + (s.caption ? '<p class="small mb-1 mt-1">' + esc(s.caption) + '</p>' : '') + '<small class="text-muted">' + new Date(s.created_at).toLocaleString() + '</small></div></div></div>';
    }).join('');
  } catch (e) { /* ignore */ }
}

document.getElementById('storyForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  var file = document.getElementById('storyFile').files?.[0];
  if (!file) { alert('Please choose a photo.'); return; }
  var fd = new FormData();
  fd.append('media', file);
  fd.append('caption', document.getElementById('storyCaption').value);
  var res = await fetch(API_BASE + '/stories', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + getToken() },
    body: fd,
  });
  var data = await res.json().catch(function () { return {}; });
  if (!res.ok) { alert(data.error || 'Upload failed'); return; }
  alert('Status posted!');
  document.getElementById('storyForm').reset();
  loadStories();
});

document.addEventListener('DOMContentLoaded', function () {
  if (!isLoggedIn()) { redirectToLogin('stories.html'); return; }
  refreshNotifBadge();
  loadStories();
});
