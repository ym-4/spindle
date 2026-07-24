// Shared filter state used by both the search bar (searchBar-Marketplace.js) and
// the listing loaders (insertMarketplaceItems.js). Must load BEFORE both of those
// files so `SpindleFilters` and `refreshFilteredListings` exist when they're used.

const SpindleFilters = {
  searchQuery: '',
  minPrice: null,
  maxPrice: null,
  tags: new Set(), // lowercased tag names
  status: 'all', // 'all' | 'active' | 'sold' — only used on my_listings.html

  // Returns true if a marketplace item satisfies every active filter (AND across
  // categories, OR within the tags category — matching any one selected tag counts).
  matches(item) {
    const matchesSearch = !this.searchQuery || item.name.toLowerCase().includes(this.searchQuery);

    const price = Number(item.price);
    const matchesMin = this.minPrice == null || price >= this.minPrice;
    const matchesMax = this.maxPrice == null || price <= this.maxPrice;

    const itemTagNames = (item.tags || []).map((t) => t.name.toLowerCase());
    const matchesTags =
      this.tags.size === 0 || [...this.tags].some((tag) => itemTagNames.includes(tag));

    const itemStatus = item.status || 'active';
    const matchesStatus = this.status === 'all' || itemStatus === this.status;

    return matchesSearch && matchesMin && matchesMax && matchesTags && matchesStatus;
  },

  reset() {
    this.searchQuery = '';
    this.minPrice = null;
    this.maxPrice = null;
    this.tags.clear();
    this.status = 'all';
  },
};

// Re-renders whichever listing page we're on, always resetting back to page 1 —
// otherwise you could get stuck on e.g. page 3 when filtering leaves only 1 page.
function refreshFilteredListings() {
  currentPage = 1;
  const container = document.getElementById('listings-container');
  if (container) container.innerHTML = '';

  updateFilterCountBadge();

  if (document.title === 'Marketplace') {
    loadListings();
  } else if (document.title === 'Marketplace - Your Listings') {
    loadUserListings();
  }
}

// Shows a small count badge on the "Filters" button so it's obvious filters are
// active even after the dropdown is closed.
function updateFilterCountBadge() {
  const badge = document.getElementById('filter-active-count');
  if (!badge) return;

  let count = 0;
  if (SpindleFilters.minPrice != null) count++;
  if (SpindleFilters.maxPrice != null) count++;
  count += SpindleFilters.tags.size;
  if (SpindleFilters.status !== 'all') count++;

  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove('d-none');
  } else {
    badge.classList.add('d-none');
  }
}

// Basic debounce so typing in the price fields doesn't re-filter on every keystroke.
function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function renderTagFilterChips(tags) {
  const container = document.getElementById('tag-filter-chips');
  if (!container) return;

  container.innerHTML = '';

  tags.forEach((tag) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'spindle-filter-chip';
    chip.textContent = tag.name;
    chip.dataset.tagName = tag.name.toLowerCase();

    chip.addEventListener('click', () => {
      const tagName = chip.dataset.tagName;
      if (SpindleFilters.tags.has(tagName)) {
        SpindleFilters.tags.delete(tagName);
        chip.classList.remove('active');
      } else {
        SpindleFilters.tags.add(tagName);
        chip.classList.add('active');
      }
      refreshFilteredListings();
    });

    container.appendChild(chip);
  });
}

function initMarketplaceFilters() {
  const minPriceInput = document.getElementById('filter-min-price');
  const maxPriceInput = document.getElementById('filter-max-price');
  const clearBtn = document.getElementById('filter-clear-btn');
  const statusSelect = document.getElementById('filter-status-select'); // only present on my_listings.html

  // Filter panel isn't on every page (e.g. cart.html) — bail out quietly if absent.
  if (!minPriceInput || !maxPriceInput || !clearBtn) return;

  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      SpindleFilters.status = statusSelect.value;
      refreshFilteredListings();
    });
  }

  const onPriceChange = debounce(() => {
    const min = minPriceInput.value.trim();
    const max = maxPriceInput.value.trim();

    SpindleFilters.minPrice = min === '' ? null : Number(min);
    SpindleFilters.maxPrice = max === '' ? null : Number(max);

    refreshFilteredListings();
  });

  minPriceInput.addEventListener('input', onPriceChange);
  maxPriceInput.addEventListener('input', onPriceChange);

  clearBtn.addEventListener('click', () => {
    SpindleFilters.reset();
    minPriceInput.value = '';
    maxPriceInput.value = '';

    document.querySelectorAll('.spindle-filter-chip.active').forEach((chip) => {
      chip.classList.remove('active');
    });

    const searchBar = document.getElementById('marketplaceSearch');
    if (searchBar) searchBar.value = '';

    if (statusSelect) statusSelect.value = 'all';

    refreshFilteredListings();

    // data-bs-auto-close="outside" keeps the dropdown open on inside clicks (so
    // toggling tag chips doesn't close the menu) — but after Clear, closing it
    // feels more natural since there's nothing left to keep tweaking.
    const toggleBtn = document.getElementById('filterDropdownBtn');
    if (toggleBtn && window.bootstrap) {
      const dropdown = bootstrap.Dropdown.getOrCreateInstance(toggleBtn);
      dropdown.hide();
    }
  });

  // Populate tag chips from the server (Tags.router.js mounted at /tags, route is /tags -> /tags/tags)
  fetchMethod('http://localhost:3000/tags/tags', (status, data) => {
    if (status === 200 && Array.isArray(data)) {
      renderTagFilterChips(data);
    } else {
      console.error('Failed to load tags for filters:', status, data);
    }
  });
}

document.addEventListener('DOMContentLoaded', initMarketplaceFilters);
