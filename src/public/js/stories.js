function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

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
    grid.innerHTML = stories.map(function(s) {
      var name = esc(s.display_name || s.name);
      var caption = s.caption ? '<p style="margin:0.25rem 0;font-size:0.85rem;color:#666;">' + esc(s.caption) + '</p>' : '';
      var time = new Date(s.created_at).toLocaleString();
      var imgUrl = typeof mediaUrl === 'function' ? mediaUrl(s.media_url) : (s.media_url || '');
      return '<div class="col-md-4 col-lg-3 mb-3"><div class="card h-100"><img src="' + imgUrl + '" class="card-img-top" style="aspect-ratio:9/16;object-fit:cover;" alt="" /><div class="card-body"><h6 class="card-title">' + name + '</h6>' + caption + '<small class="text-muted">' + time + '</small></div></div></div>';
    }).join('');
  } catch (err) {
    console.error('loadStories error:', err);
    if (grid) grid.innerHTML = '<div class="col-12"><div class="alert alert-danger">Failed to load stories.</div></div>';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('storyForm');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      var file = document.getElementById('storyFile').files?.[0];
      if (!file) return showToast('Choose a photo', true);
      var fd = new FormData();
      fd.append('media', file);
      fd.append('caption', document.getElementById('storyCaption').value);
      try {
        var res = await fetch((typeof API_BASE !== 'undefined' ? API_BASE : '') + '/stories', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + (typeof getToken === 'function' ? getToken() : '') },
          body: fd,
        });
        var result = await res.json().catch(function() { return {}; });
        if (!res.ok) return showToast(result.error || 'Upload failed', true);
        showToast('Status posted!');
        document.getElementById('storyForm').reset();
        loadStories();
      } catch (err) {
        console.error('Story upload error:', err);
        showToast('Upload failed', true);
      }
    });
  }
  loadStories();
});
