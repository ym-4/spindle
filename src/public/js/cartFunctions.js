function addToCart(seller_id, item_id, user_id, amount) {
  let data = { seller_id: seller_id, item_id: item_id, amount: amount };
  fetchMethod(
    `http://localhost:3000/cart/add/${user_id}`,
    (status, data) => {
      console.log(status, data);
    },
    'POST',
    data,
  );
}

function removeFromCart(item_id, user_id) {
  let data = {};
  fetchMethod(
    `http://localhost:3000/cart/remove/${item_id}/${user_id}`,
    (status, data) => {
      console.log(status, data);
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
    },
    'DELETE',
    data,
  );
}
