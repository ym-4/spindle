// item-page.js — loads a single marketplace listing by id (?id=) and renders it

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function qualityMeta(rawQuality) {
  const q = String(rawQuality || '').trim().toLowerCase();
  if (q === 'new') return { className: 'new' };
  if (q === 'like new' || q === 'likenew') return { className: 'likenew' };
  if (q === 'good') return { className: 'good' };
  if (q === 'fair') return { className: 'fair' };
  return { className: 'default' };
}

function renderItem(item) {
  document.getElementById('itemLoaded').classList.remove('d-none');
  document.getElementById('itemNotFound').classList.add('d-none');

  const itemImageEl = document.getElementById('itemImage');
  itemImageEl.alt = escapeHtml(item.name);
  if (item.images && item.images.length > 0) {
    itemImageEl.src = item.images[0].image_url;
  }
  document.getElementById('itemTitle').textContent = item.name;
  document.getElementById('itemPrice').textContent = `$${Number(item.price).toFixed(2)}`;

  const itemTagsEl = document.getElementById('itemTags');
  if (item.tags && item.tags.length > 0) {
    itemTagsEl.innerHTML = item.tags
      .map((t) => `<span class="item-tag-badge">${escapeHtml(t.name)}</span>`)
      .join('');
  } else {
    itemTagsEl.innerHTML = '';
  }
  document.getElementById('itemDescription').textContent =
    item.description || 'No description provided.';
  document.getElementById('itemMeetup').textContent =
    item.meetup || 'Not specified — ask the seller before you commit.';
  document.getElementById('itemSeller').textContent = `Student #${item.seller_id}`;
  document.getElementById('breadcrumbTitle').textContent = item.name;
  document.title = `${item.name} · Spindle`;

  const qualityEl = document.getElementById('itemQuality');
  if (item.quality) {
    const meta = qualityMeta(item.quality);
    qualityEl.textContent = item.quality;
    qualityEl.className = `quality-pill quality-pill--${meta.className}`;
    qualityEl.classList.remove('d-none');
  } else {
    qualityEl.classList.add('d-none');
  }

  const addBtn = document.getElementById('addToCartBtn');
  addBtn.dataset.sellerId = item.seller_id;
  addBtn.dataset.itemId = item.id;
}

function showNotFound() {
  document.getElementById('itemLoaded').classList.add('d-none');
  document.getElementById('itemNotFound').classList.remove('d-none');
}

function loadItem() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    showNotFound();
    return;
  }

  fetchMethod(`http://localhost:3000/marketplace/${id}`, (status, data) => {
    if (status === 200 && data && data.id) {
      renderItem(data);
    } else {
      showNotFound();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadItem();

  const qtyInput = document.getElementById('qtyInput');

  document.getElementById('qtyMinus').addEventListener('click', () => {
    qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
  });

  document.getElementById('qtyPlus').addEventListener('click', () => {
    qtyInput.value = Math.min(99, Number(qtyInput.value) + 1);
  });

  document.getElementById('addToCartBtn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const sellerId = btn.dataset.sellerId;
    const itemId = btn.dataset.itemId;
    const amount = qtyInput.value;
    if (!itemId) return;
    addToCart(sellerId, itemId, localStorage.loggedInUserId, amount);
  });
});
