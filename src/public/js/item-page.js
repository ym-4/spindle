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
  loadRecommendedItems(item.id);
}

// Builds a card identical in markup to the marketplace grid's spindle-card,
// so recommended items look and behave the same as the main listings.
function renderRecommendedCard(item) {
  const container = document.getElementById('recommended-container');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'spindle-card';
  card.dataset.sellerId = item.seller_id;
  card.dataset.id = item.id;

  const badgeMarkup = item.quality
    ? `<span class="spindle-badge spindle-badge--${qualityMeta(item.quality).className}">${escapeHtml(item.quality)}</span>`
    : '';
  const meetupMarkup = item.meetup
    ? `<p class="spindle-card-meetup"><i class="fas fa-map-marker-alt"></i>${escapeHtml(item.meetup)}</p>`
    : '';
  const thumbnailSrc = item.images && item.images.length > 0 ? item.images[0].image_url : '../marketplace-uploads/1.png';
  const tagsMarkup = item.tags && item.tags.length > 0
    ? `<div class="spindle-card-tags">${item.tags.map((t) => `<span class="spindle-tag-badge">${escapeHtml(t.name)}</span>`).join('')}</div>`
    : '';

  card.innerHTML = `
    <a class="spindle-card-link" href="item.html?id=${encodeURIComponent(item.id)}">
      <div class="spindle-card-media">
        <img src="${escapeHtml(thumbnailSrc)}" alt="">
        ${badgeMarkup}
      </div>
      <div class="spindle-card-body">
        <h3 class="spindle-card-title">${escapeHtml(item.name)}</h3>
        <p class="spindle-card-price">$${Number(item.price).toFixed(2)}</p>
        ${tagsMarkup}
        ${meetupMarkup}
      </div>
    </a>
    <div class="spindle-card-footer">
      <div class="spindle-qty">
        <button type="button" class="spindle-qty-btn" data-step="-1" aria-label="Decrease quantity">−</button>
        <input type="number" class="form-control qty-input spindle-qty-input" value="1" min="1" max="99" />
        <button type="button" class="spindle-qty-btn" data-step="1" aria-label="Increase quantity">+</button>
      </div>
      <button class="spindle-add-btn add-to-cart-btn" data-bs-toggle="modal" data-bs-target="#addedToCartModal" type="button" aria-label="Add to cart">
        <i class="fas fa-cart-plus"></i>
      </button>
    </div>
  `;

  const qtyInput = card.querySelector('.qty-input');

  card.querySelectorAll('.spindle-qty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.dataset.step);
      const next = Number(qtyInput.value) + step;
      qtyInput.value = Math.min(99, Math.max(1, next));
    });
  });

  card.querySelector('.add-to-cart-btn').addEventListener('click', () => {
    addToCart(item.seller_id, item.id, localStorage.loggedInUserId, qtyInput.value);
  });

  container.appendChild(card);
}

function loadRecommendedItems(itemId) {
  fetchMethod(`http://localhost:3000/marketplace/${itemId}/recommended`, (status, data) => {
    const container = document.getElementById('recommended-container');
    const section = document.getElementById('recommended-section');
    if (!container || !section) return;

    container.innerHTML = '';

    if (status === 200 && Array.isArray(data) && data.length > 0) {
      section.classList.remove('d-none');
      data.forEach((recItem) => renderRecommendedCard(recItem));
    } else {
      section.classList.add('d-none');
    }
  });
}

// Builds a card identical in markup to the marketplace grid's spindle-card,
// so recommended items look and behave the same as the main listings.
function renderRecommendedCard(item) {
  const container = document.getElementById('recommended-container');
  if (!container) return;

  const card = document.createElement('div');
  card.className = 'spindle-card';
  card.dataset.sellerId = item.seller_id;
  card.dataset.id = item.id;

  const badgeMarkup = item.quality
    ? `<span class="spindle-badge spindle-badge--${qualityMeta(item.quality).className}">${escapeHtml(item.quality)}</span>`
    : '';
  const meetupMarkup = item.meetup
    ? `<p class="spindle-card-meetup"><i class="fas fa-map-marker-alt"></i>${escapeHtml(item.meetup)}</p>`
    : '';
  const thumbnailSrc = item.images && item.images.length > 0 ? item.images[0].image_url : '../marketplace-uploads/1.png';
  const tagsMarkup = item.tags && item.tags.length > 0
    ? `<div class="spindle-card-tags">${item.tags.map((t) => `<span class="spindle-tag-badge">${escapeHtml(t.name)}</span>`).join('')}</div>`
    : '';

  card.innerHTML = `
    <a class="spindle-card-link" href="item.html?id=${encodeURIComponent(item.id)}">
      <div class="spindle-card-media">
        <img src="${escapeHtml(thumbnailSrc)}" alt="">
        ${badgeMarkup}
      </div>
      <div class="spindle-card-body">
        <h3 class="spindle-card-title">${escapeHtml(item.name)}</h3>
        <p class="spindle-card-price">$${Number(item.price).toFixed(2)}</p>
        ${tagsMarkup}
        ${meetupMarkup}
      </div>
    </a>
    <div class="spindle-card-footer">
      <div class="spindle-qty">
        <button type="button" class="spindle-qty-btn" data-step="-1" aria-label="Decrease quantity">−</button>
        <input type="number" class="form-control qty-input spindle-qty-input" value="1" min="1" max="99" />
        <button type="button" class="spindle-qty-btn" data-step="1" aria-label="Increase quantity">+</button>
      </div>
      <button class="spindle-add-btn add-to-cart-btn" data-bs-toggle="modal" data-bs-target="#addedToCartModal" type="button" aria-label="Add to cart">
        <i class="fas fa-cart-plus"></i>
      </button>
    </div>
  `;

  const qtyInput = card.querySelector('.qty-input');

  card.querySelectorAll('.spindle-qty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = Number(btn.dataset.step);
      const next = Number(qtyInput.value) + step;
      qtyInput.value = Math.min(99, Math.max(1, next));
    });
  });

  card.querySelector('.add-to-cart-btn').addEventListener('click', () => {
    addToCart(item.seller_id, item.id, localStorage.loggedInUserId, qtyInput.value);
  });

  container.appendChild(card);
}

function loadRecommendedItems(itemId) {
  fetchMethod(`http://localhost:3000/marketplace/${itemId}/recommended`, (status, data) => {
    const container = document.getElementById('recommended-container');
    const section = document.getElementById('recommended-section');
    if (!container || !section) return;

    container.innerHTML = '';

    if (status === 200 && Array.isArray(data) && data.length > 0) {
      section.classList.remove('d-none');
      data.forEach((recItem) => renderRecommendedCard(recItem));
    } else {
      section.classList.add('d-none');
    }
  });
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
