/* global loadListings, addListing, loadUserListings */

let searchBar = document.getElementById('marketplaceSearch');
let listingContainer = document.getElementById('listings-container');

function marketplaceSearch() {
  searchBar.addEventListener('input', () => {
    listingContainer.innerHTML = '';
    let searchQuery = searchBar.value.toLowerCase();

    // If search query is nothing, load listings as usual
    if (searchQuery == '') {
      loadListings();
      return;
    }

    fetchMethod('http://localhost:3000/marketplace/', (status, data) => {
      const emptyState = document.getElementById('no-listings-state');

      if (status === 200) {
        let nothingFound = true;

        data.forEach((item) => {
          if (item.name.toLowerCase().includes(searchQuery)) {
            nothingFound = false;
            addListing(item.seller_id, item.id, item.name, item.description, item.price);
          }
        });

        if (nothingFound) {
          emptyState.classList.remove('d-none');
        } else {
          emptyState.classList.add('d-none');
        }
      } else {
        console.error('Failed to load listings:', status, data);
      }
    });
  });
}

function yourListingsSearch() {
  searchBar.addEventListener('input', () => {
    listingContainer.innerHTML = '';
    let searchQuery = searchBar.value.toLowerCase();

    // If search query is nothing, load listings as usual
    if (searchQuery == '') {
      loadUserListings();
      return;
    }

    fetchMethod('http://localhost:3000/marketplace/', (status, data) => {
      const emptyState = document.getElementById('no-listings-state');

      if (status === 200) {
        let nothingFound = true;

        data.forEach((item) => {
          if (
            item.name.toLowerCase().includes(searchQuery) &&
            item.seller_id == localStorage.loggedInUserId
          ) {
            nothingFound = false;
            addListing(item.seller_id, item.id, item.name, item.description, item.price);
          }
        });

        if (nothingFound) {
          emptyState.classList.remove('d-none');
        } else {
          emptyState.classList.add('d-none');
        }
      } else {
        console.error('Failed to load listings:', status, data);
      }
    });
  });
}

// Insert the correct items based on the name of the document ;-D
if (document.title == 'Marketplace') {
  marketplaceSearch();
} else if (document.title == 'Marketplace - Your Listings') {
  yourListingsSearch();
}
