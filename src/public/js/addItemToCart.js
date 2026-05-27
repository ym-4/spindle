function addToCart(seller_id, item_id, user_id, amount) {
    let data = {seller_id : seller_id, item_id : item_id, amount : amount};
    fetchMethod(`http://localhost:3000/cart/add/${user_id}`, (status, data) => {console.log(status, data)}, "POST", data);
};
