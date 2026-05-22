function addListing(sellerEmail, name, description, price) {
  const container = document.getElementById('listings-container');

  const card = document.createElement('div');
  card.innerHTML = `
    <div class="card h-100">
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
          <button class="btn btn-outline-dark mt-auto" data-bs-toggle="modal" data-bs-target="#addedToCartModal">Add to cart</button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(card);
}