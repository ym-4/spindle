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

function addListing(seller_id, id, name, description, price, quality, meetup, images, tags) {
  const container = document.getElementById('listings-container');

  const card = document.createElement('div');
  card.className = 'spindle-card';
  card.dataset.sellerId = seller_id;
  card.dataset.id = id;

  const badgeMarkup = quality
    ? `<span class="spindle-badge spindle-badge--${qualityBadgeClass(quality)}">${escapeHtml(quality)}</span>`
    : '';
  const meetupMarkup = meetup
    ? `<p class="spindle-card-meetup"><i class="fas fa-map-marker-alt"></i>${escapeHtml(meetup)}</p>`
    : '';
  const thumbnailSrc = images && images.length > 0 ? images[0].image_url : '../uploads/marketplace-uploads/1.png';
  const tagsMarkup = tags && tags.length > 0
    ? `<div class="spindle-card-tags">${tags.map((t) => `<span class="spindle-tag-badge">${escapeHtml(t.name)}</span>`).join('')}</div>`
    : '';

  card.innerHTML = `
    <a class="spindle-card-link" href="item.html?id=${encodeURIComponent(id)}">
      <div class="spindle-card-media">
        <img src="${escapeHtml(thumbnailSrc)}" alt="">
        ${badgeMarkup}
      </div>
      <div class="spindle-card-body">
        <h3 class="spindle-card-title">${escapeHtml(name)}</h3>
        <p class="spindle-card-price">$${Number(price).toFixed(2)}</p>
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
    const amount = qtyInput.value;
    addToCart(seller_id, id, localStorage.loggedInUserId, amount);
  });

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

async function loadListings() {
  // Update Page Navigation Bar
  fetchMethod('http://localhost:3000/marketplace/', (status, data) => {
    const filtered = applySpindleFilters(data);
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
      const filtered = applySpindleFilters(data);

      if (filtered.length == 0 || !filtered) {
        emptyState.classList.remove('d-none');
      } else {
        emptyState.classList.add('d-none');

        for (i = (currentPage - 1) * LISTINGS_PER_PAGE; i < LISTINGS_PER_PAGE * currentPage; i++) {
          if (!filtered[i]) continue;
          addListing(
            filtered[i].seller_id,
            filtered[i].id,
            filtered[i].name,
            filtered[i].description,
            filtered[i].price,
            filtered[i].quality,
            filtered[i].meetup,
            filtered[i].images,
            filtered[i].tags,
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

        for (let i = (currentPage - 1) * LISTINGS_PER_PAGE; i < LISTINGS_PER_PAGE * currentPage; i++) {
          if (!userListings[i]) continue;
          addListing(
            userListings[i].seller_id,
            userListings[i].id,
            userListings[i].name,
            userListings[i].description,
            userListings[i].price,
            userListings[i].quality,
            userListings[i].meetup,
            userListings[i].images,
            userListings[i].tags,
          );
        }
      }
    } else {
      console.error('Failed to load listings:', status, data);
    }
  });
}

function addCartItem(seller_id, id, name, description, price, quantity) {
  const container = document.querySelector('.cart-container');
  const card = document.createElement('div');
  card.setAttribute('data-seller-id', seller_id);
  card.setAttribute('data-id', id);
  card.innerHTML = `
    <div class="card mb-3">
      <div class="row g-0 align-items-center">
        <div class="col-md-3">
          <img src="https://placehold.co/150x120" class="img-fluid rounded-start" alt="${escapeHtml(name)}" />
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
      const newQuantity = parseInt(modal.querySelector('#editQuantity').value);
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

    if (data.length == 0 || !data) {
      emptyState.classList.remove('d-none');
    } else {
      emptyState.classList.add('d-none');
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

  loadUserListings();
}
