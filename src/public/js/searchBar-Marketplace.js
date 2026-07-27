// Wires the text search box into the shared SpindleFilters state (see
// marketplace-filters.js). Price + tag filters are handled by that same file;
// this just keeps the search box's own "type to filter by name" behavior,
// plus the little clear (×) button that shows once there's text.

let searchBar = document.getElementById('marketplaceSearch');

function marketplaceSearchInput() {
  const clearBtn = document.getElementById('search-clear-btn');

  searchBar.addEventListener('input', () => {
    SpindleFilters.searchQuery = searchBar.value.toLowerCase();

    if (clearBtn) {
      clearBtn.classList.toggle('d-none', searchBar.value === '');
    }

    refreshFilteredListings();
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchBar.value = '';
      SpindleFilters.searchQuery = '';
      clearBtn.classList.add('d-none');
      refreshFilteredListings();
    });
  }
}

// Insert the correct items based on the name of the document ;-D
if (document.title == 'Marketplace' || document.title == 'Marketplace - Your Listings') {
  marketplaceSearchInput();
}
