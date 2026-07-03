let searchBar = document.getElementById('marketplaceSearch');
let listingContainer = document.getElementById('listings-container');

searchBar.addEventListener('input', ()=> {
    listingContainer.innerHTML = "";
    let searchQuery = searchBar.value.toLowerCase();
    fetchMethod("http://localhost:3000/marketplace/", (status, data) => {
        if (status === 200) {
            data.forEach(item => {
                if (item.name.toLowerCase().includes(searchQuery)) {
                    addListing(item.seller_id, item.id, item.name, item.description, item.price);
                }
            });
        } else {
            console.error("Failed to load listings:", status, data);
        }
    });
})