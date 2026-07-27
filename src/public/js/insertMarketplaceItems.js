/* global fetchMethod, bootstrap, removeFromCart, addToCart */

// Escape user-submitted text before it's dropped into innerHTML.
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function qualityBadgeClass(rawQuality) {
  const q = String(rawQuality || '')
    .trim()
    .toLowerCase();
  if (q === 'new' || q === 'brand new' || q === 'brandnew') return 'new';
  if (q === 'like new' || q === 'likenew') return 'likenew';
  if (q === 'good') return 'good';
  if (q === 'fair') return 'fair';
  return 'default';
}

// mode: 'browse' (marketplace grid — qty + Add to Cart) or 'owner' (my
// listings — Edit / Mark as Sold / Delete). Kept as one function since the
// media/body markup (image, badge, title, price, tags, meetup) is identical
// either way; only the footer and the sold-overlay differ.
function addListing({
  seller_id,
  id,
  name,
  description,
  price,
  quality,
  meetup,
  images,
  tags,
  status,
  mode = 'browse',
}) {
  const container = document.getElementById('listings-container');

  const card = document.createElement('div');
  card.className = 'spindle-card';
  card.dataset.sellerId = seller_id;
  card.dataset.id = id;

  const isSold = (status || 'active') === 'sold';

  const badgeMarkup = quality
    ? `<span class="spindle-badge spindle-badge--${qualityBadgeClass(quality)}">${escapeHtml(quality)}</span>`
    : '';
  const soldOverlayMarkup = isSold ? `<div class="spindle-sold-overlay">Sold</div>` : '';
  const meetupMarkup = meetup
    ? `<p class="spindle-card-meetup"><i class="fas fa-map-marker-alt"></i>${escapeHtml(meetup)}</p>`
    : '';
  const thumbnailSrc =
    images && images.length > 0 ? images[0].image_url : '../uploads/marketplace-uploads/1.png';
  const tagsMarkup =
    tags && tags.length > 0
      ? `<div class="spindle-card-tags">${tags.map((t) => `<span class="spindle-tag-badge">${escapeHtml(t.name)}</span>`).join('')}</div>`
      : '';

  const footerMarkup =
    mode === 'owner'
      ? `
    <div class="spindle-card-footer spindle-card-footer--owner">
      <a href="create_listing.html?id=${encodeURIComponent(id)}" class="btn btn-sm btn-outline-secondary spindle-owner-btn">
        <i class="fas fa-pen"></i> Edit
      </a>
      <button type="button" class="btn btn-sm btn-outline-dark spindle-owner-btn spindle-status-btn">
        <i class="fas fa-tag"></i> ${isSold ? 'Relist' : 'Mark as Sold'}
      </button>
      <button type="button" class="btn btn-sm btn-outline-danger spindle-owner-btn spindle-delete-btn">
        <i class="fas fa-trash"></i> Delete
      </button>
    </div>
  `
      : `
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

  card.innerHTML = `
    <a class="spindle-card-link" href="item.html?id=${encodeURIComponent(id)}">
      <div class="spindle-card-media">
        <img src="${escapeHtml(thumbnailSrc)}" alt="">
        ${badgeMarkup}
        ${soldOverlayMarkup}
      </div>
      <div class="spindle-card-body">
        <h3 class="spindle-card-title">${escapeHtml(name)}</h3>
        <p class="spindle-card-price">$${Number(price).toFixed(2)}</p>
        ${tagsMarkup}
        ${meetupMarkup}
      </div>
    </a>
    ${footerMarkup}
  `;

  if (mode === 'owner') {
    card.querySelector('.spindle-status-btn').addEventListener('click', () => {
      const nextStatus = isSold ? 'active' : 'sold';
      if (
        nextStatus === 'sold' &&
        !confirm(`Mark "${name}" as sold? It'll be hidden from the marketplace.`)
      )
        return;

      fetch(`http://localhost:3000/marketplace/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
        .then(async (res) => {
          if (!res.ok) {
            console.error('Status update failed', await res.text());
            return;
          }
          container.innerHTML = '';
          loadUserListings();
        })
        .catch((err) => console.error('Status update error:', err));
    });

    card.querySelector('.spindle-delete-btn').addEventListener('click', () => {
      if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
      fetch(`http://localhost:3000/marketplace/${id}`, { method: 'DELETE' })
        .then(async (res) => {
          if (!res.ok) {
            console.error('Delete failed', await res.text());
            return;
          }
          card.remove();
        })
        .catch((err) => console.error('Delete error:', err));
    });
  } else {
    const qtyInput = card.querySelector('.qty-input');

    card.querySelectorAll('.spindle-qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = Number(btn.dataset.step);
        const next = Number(qtyInput.value) + step;
        qtyInput.value = Math.min(99, Math.max(1, next));
      });
    });

    card.querySelector('.add-to-cart-btn').addEventListener('click', () => {
      const amount = qtyInput.value;
      addToCart(seller_id, id, localStorage.loggedInUserId, amount);
    });
  }

  container.appendChild(card);
}

// Fetch all marketplace items

const container = document.getElementById('listings-container');
const emptyState = document.getElementById('no-listings-state');

const LISTINGS_PER_PAGE = 10;

// Applies the shared SpindleFilters state (search text, price range, tags) if
// present. Falls back to returning everything unfiltered if filters.js hasn't
// loaded on this page, so this stays safe to call from anywhere.
function applySpindleFilters(data) {
  if (typeof SpindleFilters === 'undefined') return data;
  return data.filter((item) => SpindleFilters.matches(item));
}

// The public marketplace never shows sold items — that's a fixed business
// rule, not something the shopper can toggle, so it's applied here directly
// rather than through SpindleFilters (which only holds user-chosen filters).
function hideSoldItems(data) {
  return data.filter((item) => (item.status || 'active') !== 'sold');
}

async function loadListings() {
  // Update Page Navigation Bar
  fetchMethod('http://localhost:3000/marketplace/', (status, data) => {
    const filtered = applySpindleFilters(hideSoldItems(data));
    let totalListings = filtered.length;
    let totalPages = Math.ceil(totalListings / LISTINGS_PER_PAGE);

    const controls = document.getElementById('pagination-controls');
    const nextItem = document.getElementById('next-page-item');

    // Clear old page-number buttons first
    controls.querySelectorAll('.page-num').forEach((el) => el.remove());

    for (let i = 1; i <= totalPages; i++) {
      const li = document.createElement('li');
      li.className = `page-item page-num ${i === currentPage ? 'active' : ''}`;
      li.innerHTML = `<button class="page-link">${i}</button>`;
      li.querySelector('button').addEventListener('click', () => {
        currentPage = i;
        container.innerHTML = '';
        loadListings();
      });
      nextItem.before(li);
    }
  });

  // Fetch and Load Listings
  fetchMethod('http://localhost:3000/marketplace/', (status, data) => {
    if (status === 200) {
      const filtered = applySpindleFilters(hideSoldItems(data));

      if (filtered.length == 0 || !filtered) {
        emptyState.classList.remove('d-none');
      } else {
        emptyState.classList.add('d-none');

        for (
          let i = (currentPage - 1) * LISTINGS_PER_PAGE;
          i < LISTINGS_PER_PAGE * currentPage;
          i++
        ) {
          if (!data[i]) continue;
          addListing(
            data[i].seller_id,
            data[i].id,
            data[i].name,
            data[i].description,
            data[i].price,
            data[i].quality,
            data[i].meetup,
            data[i].images,
            data[i].tags,
          );
        }
      }
    } else {
      console.error('Failed to load listings:', status, data);
    }
  });
}

// Fetch users Listings
async function loadUserListings() {
  // Update Page Navigation Bar
  fetchMethod('http://localhost:3000/marketplace/', (status, data) => {
    const userListings = applySpindleFilters(
      data.filter((item) => item.seller_id == localStorage.loggedInUserId),
    );
    let totalListings = userListings.length;
    let totalPages = Math.ceil(totalListings / LISTINGS_PER_PAGE);

    const controls = document.getElementById('pagination-controls');
    const nextItem = document.getElementById('next-page-item');

    // Clear old page-number buttons first
    controls.querySelectorAll('.page-num').forEach((el) => el.remove());

    for (let i = 1; i <= totalPages; i++) {
      const li = document.createElement('li');
      li.className = `page-item page-num ${i === currentPage ? 'active' : ''}`;
      li.innerHTML = `<button class="page-link">${i}</button>`;
      li.querySelector('button').addEventListener('click', () => {
        currentPage = i;
        container.innerHTML = '';
        loadUserListings();
      });
      nextItem.before(li);
    }
  });

  // Fetch and Load Listings
  fetchMethod('http://localhost:3000/marketplace/', (status, data) => {
    if (status === 200) {
      const userListings = applySpindleFilters(
        data.filter((item) => item.seller_id == localStorage.loggedInUserId),
      );

      if (userListings.length == 0) {
        emptyState.classList.remove('d-none');
      } else {
        emptyState.classList.add('d-none');

        for (
          let i = (currentPage - 1) * LISTINGS_PER_PAGE;
          i < LISTINGS_PER_PAGE * currentPage;
          i++
        ) {
          if (!userListings[i]) continue;
          addListing({ ...userListings[i], mode: 'owner' });
        }
      }
    } else {
      console.error('Failed to load listings:', status, data);
    }
  });
}

function addCartItem(seller_id, id, name, description, price, quantity, images) {
  const thumbnailSrc =
    images && images.length > 0 ? images[0].image_url : '../uploads/marketplace-uploads/1.png';
  const container = document.querySelector('.cart-container');
  const card = document.createElement('div');
  card.setAttribute('data-seller-id', seller_id);
  card.setAttribute('data-id', id);
  card.innerHTML = `
    <div class="card mb-3">
      <div class="row g-0 align-items-center">
        <div class="col-md-3">
          <img src="${escapeHtml(thumbnailSrc)}" class="img-fluid rounded-start" alt="${escapeHtml(name)}" />
        </div>
        <div class="col-md-6">
          <div class="card-body">
            <h5 class="card-title">${escapeHtml(name)}</h5>
            <p class="card-text text-muted">${escapeHtml(description)}</p>
            <p class="card-price fw-bold">$${Number(price).toFixed(2)}</p>
          </div>
        </div>
        <div class="col-md-3 text-center">
          <button class="btn btn-outline-danger btn-sm remove-btn">Remove</button>
          <button class="btn btn-outline-secondary btn-sm edit-btn d-block mt-2 mx-auto">Edit</button>
          <div class="card-quantity-container">
            <div class="input-group justify-content-center mt-3 card-quantity">
              ${quantity}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  card.querySelector('.remove-btn').addEventListener('click', () => {
    removeFromCart(id, localStorage.loggedInUserId);
    location.reload();
  });

  card.querySelector('.edit-btn').addEventListener('click', () => {
    const modal = document.getElementById('editCartModal');

    // Pre-fill the quantity input with the current quantity
    modal.querySelector('#editQuantity').value = quantity;

    // Save button handler
    modal.querySelector('#editSaveBtn').onclick = () => {
      let newQuantity = parseInt(modal.querySelector('#editQuantity').value);
      if (newQuantity < 1) {
        newQuantity = 1;
      }
      editCart(id, localStorage.loggedInUserId, newQuantity);

      bootstrap.Modal.getInstance(modal).hide();
      location.reload();
    };

    new bootstrap.Modal(modal).show();
  });

  container.appendChild(card);
  updateSummary();
}

function updateSummary() {
  const inputs = document.querySelectorAll('.card-price');
  let subtotal = 0;

  inputs.forEach((card) => {
    const price = parseFloat(card.textContent.replace('$', ''));
    const quantity = Number(document.querySelector('.card-quantity').innerHTML);
    subtotal += price * quantity;
  });

  document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('total').textContent = `$${subtotal.toFixed(2)}`;
}

async function loadCart() {
  fetchMethod(`http://localhost:3000/cart/${localStorage.loggedInUserId}`, (status, data) => {
    const emptyState = document.getElementById('empty-cart-state');
    const clearBtn = document.getElementById('clear-cart-btn');

    if (data.length == 0 || !data) {
      emptyState.classList.remove('d-none');
      if (clearBtn) clearBtn.classList.add('d-none');
    } else {
      emptyState.classList.add('d-none');
      if (clearBtn) clearBtn.classList.remove('d-none');
    }

    if (status === 200) {
      data.forEach((item) => {
        fetchMethod(
          `http://localhost:3000/marketplace/${item.item_id}`,
          (cartStatus, cartData) => {
            if (status == 200) {
              addCartItem(
                cartData.seller_id,
                cartData.id,
                cartData.name,
                cartData.description,
                cartData.price,
                item.amount,
                cartData.images,
              );
            }
          },
          'GET',
        );
      });
    } else {
      console.error('Failed to load cart:', status, data);
    }
  });
}

let currentPage = 1;

// Insert the correct items based on the name of the document ;-D
if (document.title == 'Marketplace') {
  loadListings();
} else if (document.title == 'Cart') {
  loadCart();
} else if (document.title == 'Marketplace - Your Listings') {
  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      container.innerHTML = '';
      loadListings();
    }
  });
  document.getElementById('next-page-btn').addEventListener('click', () => {
    currentPage++;
    container.innerHTML = '';
    loadListings();
  });

  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      container.innerHTML = '';
      loadListings();
    }
  });
  document.getElementById('next-page-btn').addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      container.innerHTML = '';
      loadListings();
    }
  });
}
