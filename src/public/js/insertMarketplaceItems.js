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
  fetchMethod("http://localhost:3000/marketplace/", (status, data) => {
    if (status === 200) {
      data.forEach(item => {
        addListing(item.seller_id, item.id, item.name, item.description, item.price);
      });
    } else {
      console.error("Failed to load listings:", status, data);
    }
  });
}

function addCartItem(seller_id, id, name, description, price, quantity = 1) {
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
          <div class="input-group justify-content-center mt-3">
            <input type="number" class="form-control text-center qty-input"
              value="1" min="1" max="99" style="max-width: 60px;" />
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(card);
  updateSummary();
}

function updateSummary() {
  const inputs = document.querySelectorAll('.card-price');
  let subtotal = 0;

  inputs.forEach(card => {
    const price = parseFloat(card.textContent.replace('$', ''));
    subtotal += price;
  });

  document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById('total').textContent = `$${subtotal.toFixed(2)}`;
}

async function loadCart() {
  fetchMethod(`http://localhost:3000/cart/${localStorage.loggedInUserId}`, (status, data) => {
    if (status === 200) {
      data.forEach(item => {
        fetchMethod(`http://localhost:3000/marketplace/${item.item_id}`, (cartStatus, cartData) => {
          if (status == 200) {
            addCartItem(cartData.seller_id, cartData.id, cartData.name, cartData.description, cartData.price, cartData.quantity)
          }
        }, "GET");
      });
    } else {
      console.error("Failed to load cart:", status, data);
    }
  });
}

// Insert the correct items based on the name of the document ;-D
if (document.title == "Marketplace") {
  loadListings();
} else if (document.title == "Cart") {
  loadCart();
}
