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

  card.querySelector(".add-to-cart-btn").addEventListener("click", () => addToCart(seller_id, id)); 
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

loadListings();
