function addToCart(seller_id, item_id, user_id, amount) {
  let data = { seller_id: seller_id, item_id: item_id, amount: amount };
  fetchMethod(
    `http://localhost:3000/cart/add/${user_id}`,
    (status, data) => {
      console.log(status, data);
      updateCartBadge();
    },
    'POST',
    data,
  );
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count-badge');
  if (!badge) return;

  const userId = localStorage.loggedInUserId;
  if (!userId) {
    badge.classList.add('d-none');
    return;
  }

  fetchMethod(`http://localhost:3000/cart/${userId}`, (status, data) => {
    if (status !== 200 || !Array.isArray(data)) {
      badge.classList.add('d-none');
      return;
    }

    const totalCount = data.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    if (totalCount > 0) {
      badge.textContent = totalCount > 99 ? '99+' : totalCount;
      badge.classList.remove('d-none');
    } else {
      badge.classList.add('d-none');
    }
  });
}

document.addEventListener('DOMContentLoaded', updateCartBadge);

function removeFromCart(item_id, user_id) {
  let data = {};
  fetchMethod(
    `http://localhost:3000/cart/remove/${item_id}/${user_id}`,
    (status, data) => {
      console.log(status, data);
      updateCartBadge();
    },
    'DELETE',
    data,
  );
}

function editCart(item_id, user_id, new_amount) {
  let data = { new_amount: new_amount };
  fetchMethod(
    `http://localhost:3000/cart/edit/${item_id}/${user_id}`,
    (status, data) => {
      console.log(status, data);
      updateCartBadge();
    },
    'PUT',
    data,
  );
}

function clearCart(user_id) {
  let data = {};
  fetchMethod(
    `http://localhost:3000/cart/clear/${user_id}`,
    (status, data) => {
      console.log(status, data);
      updateCartBadge();
    },
    'DELETE',
    data,
  );
}

document.addEventListener('DOMContentLoaded', () => {
  const clearBtn = document.getElementById('clear-cart-btn');
  if (!clearBtn) return;

  clearBtn.addEventListener('click', () => {
    if (!confirm("Clear your entire cart? This can't be undone.")) return;
    clearCart(localStorage.loggedInUserId);
    location.reload();
  });
});
