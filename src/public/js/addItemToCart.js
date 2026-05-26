function addToCart(seller_id, item_id, user_id, amount) {
    console.log(seller_id, item_id, user_id, amount);

    let data = {seller_id : seller_id, item_id : item_id, amount : amount};
    
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