function addListing(seller_id, id, name, description, price) {
  const container = document.getElementById('listings-container');

  const card = document.createElement('div');
  card.innerHTML = `
   <div class="card h-100 mb-4" data-seller-id="${seller_id}" data-id="${id}">
      <img class="card-img-top" src="https://placehold.co/450x350" alt="..." />
      <div class="card-body p-4">
        <div class="text-center">
          <h5 class="fw-bolder">${name}</h5>
          <p class="card-text">${description}</p>
          $${Number(price).toFixed(2)}
        </div>
      </div>
      <div class="card-footer p-4 pt-0 border-top-0 bg-transparent">
        <div class="text-center">
          <button class="btn btn-outline-dark mt-auto add-to-cart-btn"
            data-bs-toggle="modal" data-bs-target="#addedToCartModal">
            Add to cart
          </button>
          <div class="input-group justify-content-center mt-3">
            <input type="number" class="form-control text-center qty-input"
              value="1" min="1" max="99" style="max-width: 60px;" />
          </div>
        </div>
      </div>
    </div>
  `;

  card.querySelector(".add-to-cart-btn").addEventListener("click", () => {
    let amount = card.querySelector(".qty-input").value;
    addToCart(seller_id, id, localStorage.loggedInUserId, amount);
  });
  container.appendChild(card);
}

// Fetch all marketplace items
async function loadListings() {
  const container = document.getElementById('listings-container');
  if (!container) return;
  container.innerHTML = '<div class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading listings...</div>';
  fetchMethod(`${getApiBase()}/marketplace/`, (status, data) => {
    if (status === 200 && Array.isArray(data) && data.length > 0) {
      container.innerHTML = '';
      data.forEach(item => {
        addListing(item.seller_id, item.id, item.name, item.description, item.price);
      });
    } else if (status === 200) {
      container.innerHTML = '<div class="text-center text-muted py-5"><i class="fas fa-store fa-2x mb-2 d-block"></i>No listings available yet.</div>';
    } else {
      console.error("Failed to load listings:", status, data);
      container.innerHTML = '<div class="text-center text-danger py-5"><i class="fas fa-exclamation-circle fa-2x mb-2 d-block"></i>Could not load listings. Please try again later.</div>';
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
          <img src="https://placehold.co/150x120" class="img-fluid rounded-start" alt="${name}" />
        </div>
        <div class="col-md-6">
          <div class="card-body">
            <h5 class="card-title">${name}</h5>
            <p class="card-text text-muted">${description}</p>
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

  card.querySelector(".remove-btn").addEventListener("click", () => {
    removeFromCart(id, localStorage.loggedInUserId);
    location.reload();
  });

  card.querySelector('.edit-btn').addEventListener("click", () => {
    const modal = document.getElementById("editCartModal");

    // Pre-fill the quantity input with the current quantity
    modal.querySelector("#editQuantity").value = quantity;

    // Save button handler
    modal.querySelector("#editSaveBtn").onclick = () => {
      const newQuantity = parseInt(modal.querySelector("#editQuantity").value);
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

  inputs.forEach(card => {
    const price = parseFloat(card.textContent.replace('$', ''));
    const quantity = Number(document.querySelector('.card-quantity').innerHTML);
    console.log(quantity);
    subtotal += price * quantity;
  });

  document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('total').textContent = `$${subtotal.toFixed(2)}`;
}

async function loadCart() {
  const container = document.querySelector('.cart-container');
  fetchMethod(`${getApiBase()}/cart/${localStorage.loggedInUserId}`, (status, data) => {
    if (status === 200 && Array.isArray(data) && data.length > 0) {
      data.forEach(item => {
        fetchMethod(`${getApiBase()}/marketplace/${item.item_id}`, (cartStatus, cartData) => {
          if (cartStatus == 200) {
            addCartItem(cartData.seller_id, cartData.id, cartData.name, cartData.description, cartData.price, item.amount)
          }
        }, "GET");
      });
    } else if (status === 200) {
      if (container) container.innerHTML = '<div class="text-center text-muted py-5"><i class="fas fa-shopping-cart fa-2x mb-2 d-block"></i>Your cart is empty.</div>';
    } else {
      console.error("Failed to load cart:", status, data);
    }
  });

  const checkoutButton = document.querySelector('.checkout-btn');
  if (checkoutButton) {
    checkoutButton.addEventListener("click", () => {
      clearCart(localStorage.loggedInUserId);
      location.reload();
    })
  }
}

// Insert the correct items based on the name of the document ;-D
if (document.title.startsWith("Marketplace")) {
  loadListings();
} else if (document.title == "Cart") {
  loadCart();
}
