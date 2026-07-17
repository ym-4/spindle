// search.js — search results page

function feedApiBase() {
  if (typeof currentUrl !== 'undefined' && currentUrl) return currentUrl;
  return window.location.origin || '';
}

// Recent searches (localStorage)
const RECENT_KEY = (() => {
  try {
    const u = JSON.parse(localStorage.getItem('pineappleUser'));
    return u?.id ? `spindleRecentSearches_${u.id}` : 'spindleRecentSearches_guest';
  } catch { return 'spindleRecentSearches_guest'; }
})();
const MAX_RECENT = 8;

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
  catch { return []; }
}

function saveRecentSearch(query) {
  if (!query || !query.trim()) return;
  const q = query.trim();
  let recent = getRecentSearches().filter(r => r !== q);
  recent.unshift(q);
  if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

function removeRecentSearch(query) {
  const recent = getRecentSearches().filter(r => r !== query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

// Setup on page load
document.addEventListener('DOMContentLoaded', () => {
    loadHotPosts();
    setupSearchDropdown();

    const params = getUrlParams();

    const input = document.getElementById('searchInput');
    if (input && params.q) input.value = params.q;

    const categoryCheckboxes = document.querySelectorAll('.search-category-checkbox');
    const sortEl = document.getElementById('searchSort');
    const fromEl = document.getElementById('searchDateFrom');
    const toEl = document.getElementById('searchDateTo');

    categoryCheckboxes.forEach((cb) => {
    if (params.categories.includes(cb.value)) cb.checked = true;
    });
    updateCategoryFilterLabel();

    if (sortEl && params.sort) sortEl.value = params.sort;
    if (fromEl && params.date_from) fromEl.value = params.date_from;
    if (toEl && params.date_to) toEl.value = params.date_to;

    // Run search immediately
    if (params.q) runSearch();

    // Search input
    if (window.location.pathname.endsWith('search.html')) {
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const newQuery = input.value.trim();
          if (!newQuery) return;
          const newIsTag = newQuery.startsWith('#');
          const p = new URLSearchParams(window.location.search);
          p.set('q', newQuery);
          newIsTag ? p.set('type', 'tag') : p.delete('type');
          window.history.replaceState({}, '', `?${p.toString()}`);
          runSearch();
        }
      });
    }

    // Category checkboxes rerun on change
    categoryCheckboxes.forEach((cb) => {
    cb.addEventListener('change', () => {
        updateCategoryFilterLabel();
        runSearch();
    });
    });

    // Other filter controls rerun on change
    ['searchSort', 'searchDateFrom', 'searchDateTo'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', runSearch);
    });

    // Clear filters
    document.getElementById('clearSearchFiltersBtn')?.addEventListener('click', () => {
    categoryCheckboxes.forEach((cb) => {
        cb.checked = false;
    });
    updateCategoryFilterLabel();
    if (sortEl) sortEl.value = 'newest';
    if (fromEl) fromEl.value = '';
    if (toEl) toEl.value = '';
    runSearch();
    });
});

function updateCategoryFilterLabel() {
  const label = document.getElementById('categoryFilterLabel');
  if (!label) return;
  const checked = Array.from(document.querySelectorAll('.search-category-checkbox:checked'));
  if (checked.length === 0) label.textContent = 'All categories';
  else if (checked.length === 1) label.textContent = getCategoryLabel(checked[0].value);
  else label.textContent = `${checked.length} categories`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatSearchDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const CATEGORY_LABELS = {
  confession: 'Confession',
  qna: 'Q&A',
  general: 'General Talk',
  events: 'Events',
  news: 'News',
  cca: 'CCA',
  internship: 'Internship',
  SOC: 'SOC',
  ABE: 'ABE',
  SB: 'SB',
  CLS: 'CLS',
  EEE: 'EEE',
  MAD: 'MAD',
  MAE: 'MAE',
  SMA: 'SMA',
};
const CATEGORY_CLASSES = {
  confession: 'category-confession',
  qna: 'category-qna',
  general: 'category-general',
  events: 'category-events',
  news: 'category-news',
  internship: 'category-internship',
  cca: 'category-cca',
  SOC: 'category-SOC',
  ABE: 'category-ABE',
  SB: 'category-SB',
  CLS: 'category-CLS',
  EEE: 'category-EEE',
  MAD: 'category-MAD',
  MAE: 'category-MAE',
  SMA: 'category-SMA',
};

function getCategoryLabel(c) {
  return CATEGORY_LABELS[c] || c || '';
}
function getCategoryClass(c) {
  return CATEGORY_CLASSES[c] || 'category-general';
}

// Read query params from URL
function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  const categoryParam = p.get('category') || '';
  return {
    q: p.get('q') || '',
    type: p.get('type') || '',
    categories: categoryParam ? categoryParam.split(',').filter(Boolean) : [],
    sort: p.get('sort') || 'newest',
    date_from: p.get('date_from') || '',
    date_to: p.get('date_to') || '',
  };
}

function pushSearchUrl(params) {
  const p = new URLSearchParams();
  if (params.q) p.set('q', params.q);
  if (params.type) p.set('type', params.type);
  if (params.categories && params.categories.length) p.set('category', params.categories.join(','));
  if (params.sort) p.set('sort', params.sort);
  if (params.date_from) p.set('date_from', params.date_from);
  if (params.date_to) p.set('date_to', params.date_to);
  window.history.replaceState({}, '', `?${p.toString()}`);
}

function runSearch() {
  const params = getUrlParams();
  const q = document.getElementById('searchInput')?.value.trim() || params.q;
  const isTagSearch = q.startsWith('#') || params.type === 'tag';
  const categories = isTagSearch
    ? [] // filters don't apply to tag searches
    : Array.from(document.querySelectorAll('.search-category-checkbox:checked')).map(
        (cb) => cb.value,
      );
  const sort = document.getElementById('searchSort')?.value || 'newest';
  const dateFrom = document.getElementById('searchDateFrom')?.value || '';
  const dateTo = document.getElementById('searchDateTo')?.value || '';
  const type = isTagSearch ? 'tag' : '';

  pushSearchUrl({ q, type, categories, sort, date_from: dateFrom, date_to: dateTo });
  saveRecentSearch(q);

  // Hide filters for tag searching
  const filterCard = document.getElementById('searchFilterCard');
  if (filterCard) filterCard.style.display = isTagSearch ? 'none' : 'block';

  const panel = document.getElementById('searchResultsPanel');
  panel.innerHTML = `
    <div class="post-card text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      ${
        isTagSearch
          ? `Searching for posts tagged <strong>${escapeHtml(q)}</strong>…`
          : `Searching for "<strong>${escapeHtml(q)}</strong>"…`
      }
    </div>`;

  const apiParams = new URLSearchParams({ q });
  if (!isTagSearch && categories.length) apiParams.append('category', categories.join(','));
  if (!isTagSearch && sort) apiParams.append('sort', sort);
  if (!isTagSearch && dateFrom) apiParams.append('date_from', dateFrom);
  if (!isTagSearch && dateTo) apiParams.append('date_to', dateTo);

  fetchMethod(`${feedApiBase()}/search?${apiParams.toString()}`, (status, data) => {
    if (status !== 200) {
      panel.innerHTML = `
        <div class="post-card text-center py-4 text-danger">
          <i class="fas fa-exclamation-circle fa-2x mb-2 d-block"></i>
          Search failed. Please try again.
        </div>`;
      return;
    }
    renderResults(data, q, isTagSearch);
  });
}

function renderResults(results, query, isTagSearch = false) {
  const panel = document.getElementById('searchResultsPanel');
  panel.innerHTML = '';

  // Check if any filters are active
  const hasCategories =
    Array.from(document.querySelectorAll('.search-category-checkbox:checked')).length > 0;
  const hasDateFrom = !!document.getElementById('searchDateFrom')?.value;
  const hasDateTo = !!document.getElementById('searchDateTo')?.value;
  const isFiltered = isTagSearch || hasCategories || hasDateFrom || hasDateTo;

  const header = document.createElement('div');
  header.className = 'text-muted mb-2 px-1';
  header.style.fontSize = '0.9rem';

  const displayedCount = isFiltered
    ? results.filter((r) => r.result_type === 'post' || r.result_type === 'comment').length
    : results.length;

  if (isTagSearch) {
    const tagName = query.startsWith('#') ? query : `#${query}`;
    header.innerHTML = `<i class="fas fa-hashtag me-1"></i> ${displayedCount} post${displayedCount !== 1 ? 's' : ''} tagged <strong>${escapeHtml(tagName)}</strong>`;
  } else {
    header.innerHTML = `<i class="fas fa-search me-1"></i> ${displayedCount} result${displayedCount !== 1 ? 's' : ''} for "<strong>${escapeHtml(query)}</strong>"`;
  }
  panel.appendChild(header);

  if (!displayedCount) {
    const emptyMsg = isTagSearch
      ? `No posts found with tag <strong>${escapeHtml(query)}</strong>`
      : `No results found for "<strong>${escapeHtml(query)}</strong>"`;
    panel.innerHTML += `
      <div class="post-card text-center py-4 text-muted">
        <i class="${isTagSearch ? 'fas fa-hashtag' : 'fas fa-search'} fa-2x mb-2 d-block"></i>
        ${emptyMsg}
      </div>`;
    return;
  }

  results.forEach((result) => {
    if (result.result_type === 'post') {
      panel.appendChild(buildPostResult(result));
    } else if (result.result_type === 'comment') {
      panel.appendChild(buildCommentResult(result));
    } else if (!isFiltered && result.result_type === 'group') {
      // Only show groups when no filters are active
      panel.appendChild(buildGroupResult(result));
    } else if (!isFiltered && result.result_type === 'user') {
      // Only show users when no filters are active
      panel.appendChild(buildUserResult(result));
    }
  });
}

function buildPostResult(post) {
  const el = document.createElement('div');
  el.className = 'post-card';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">${post.author_name ? post.author_name.charAt(0).toUpperCase() : 'U'}</div>
      <div class="post-author">
        <div class="post-author-name">${escapeHtml(post.author_name || 'User')}</div>
        <div class="post-timestamp">${formatSearchDate(post.created_at)}</div>
      </div>
      <span class="post-category ${getCategoryClass(post.category)}">${getCategoryLabel(post.category)}</span>
    </div>
    <div class="fw-bold mb-1">${escapeHtml(post.title || '')}</div>
    <div class="post-content text-muted" style="font-size:0.9rem;">
      ${escapeHtml((post.content || '').replace(/<[^>]*>/g, '').substring(0, 150))}${(post.content || '').length > 150 ? '…' : ''}
    </div>`;
  el.addEventListener('click', () => {
    window.location.href = `posts.html?id=${post.id}`;
  });
  return el;
}

function buildCommentResult(comment) {
  const el = document.createElement('div');
  el.className = 'post-card';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar" style="background:var(--text-secondary);">
        ${comment.author_name ? comment.author_name.charAt(0).toUpperCase() : 'U'}
      </div>
      <div class="post-author">
        <div class="post-author-name">${escapeHtml(comment.author_name || 'User')}</div>
        <div class="post-timestamp">${formatSearchDate(comment.created_at)} · comment</div>
      </div>
      <span class="post-category" style="background:#f0f7ff;color:#1a5fb4;border-radius:12px;padding:0.2rem 0.6rem;font-size:0.75rem;font-weight:600;">Comment</span>
    </div>
    <div class="text-muted small mb-1">
      <i class="fas fa-reply me-1"></i> On post: <strong>${escapeHtml(comment.description || '')}</strong>
    </div>
    <div class="post-content" style="font-size:0.9rem;">
      ${escapeHtml((comment.content || '').substring(0, 200))}${(comment.content || '').length > 200 ? '…' : ''}
    </div>`;

  el.addEventListener('click', () => {
    window.location.href = `posts.html?id=${comment.post_id}#comment-${comment.id}`;
  });
  return el;
}

function buildGroupResult(group) {
  const el = document.createElement('div');
  el.className = 'post-card';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar" style="background:var(--secondary-color);">
        <i class="fas fa-users" style="font-size:1rem;"></i>
      </div>
      <div class="post-author">
        <div class="post-author-name">${escapeHtml(group.title)}</div>
        <div class="post-timestamp">Study Group · by ${escapeHtml(group.author_name)}</div>
      </div>
      <span class="post-category category-general">Group</span>
    </div>
    <div class="post-content text-muted" style="font-size:0.9rem;">
      ${escapeHtml(group.description || 'No description available.')}
    </div>`;
  el.addEventListener('click', () => {
    window.location.href = `groups.html?id=${group.id}`;
  });
  return el;
}

function buildUserResult(user) {
  const el = document.createElement('div');
  el.className = 'post-card';
  el.style.cursor = 'pointer';
  el.innerHTML = `
    <div class="post-header">
      <div class="post-avatar">${escapeHtml(user.title.charAt(0).toUpperCase())}</div>
      <div class="post-author">
        <div class="post-author-name">${escapeHtml(user.title)}</div>
        <div class="post-timestamp">User</div>
      </div>
      <span class="post-category" style="background:#f0f0f0;color:#555;">Profile</span>
    </div>`;
  el.addEventListener('click', () => {
    window.location.href = `profile.html?id=${user.id}`;
  });
  return el;
}

function setupSearchDropdown() {
  const input    = document.getElementById('searchInput');
  const dropdown = document.getElementById('searchDropdown');
  if (!input || !dropdown) return;

  let debounce;

  function showDropdown() {
    dropdown.style.display = 'block';
    input.closest('.navbar-search')?.classList.add('open');
  }

  function hideDropdown() {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    input.closest('.navbar-search')?.classList.remove('open');
  }

  function renderRecentSearches() {
    const recent = getRecentSearches();
    dropdown.innerHTML = '';
    if (!recent.length) { hideDropdown(); return; }

    const section = document.createElement('div');
    section.className = 'search-dropdown-section';

    const label = document.createElement('div');
    label.className = 'search-dropdown-label';
    label.textContent = 'Recent searches';
    section.appendChild(label);

    recent.forEach(q => {
      const item = document.createElement('button');
      item.className = 'search-dropdown-item';
      item.innerHTML = `
        <i class="fas fa-clock"></i>
        <span class="flex-grow-1">${escapeHtml(q)}</span>
        <button class="remove-recent" title="Remove" data-q="${escapeHtml(q)}">
          <i class="fas fa-times"></i>
        </button>`;

      // Click item text > search
      item.addEventListener('click', (e) => {
        if (e.target.closest('.remove-recent')) return;
        doSearch(q);
      });

      // Remove button
      item.querySelector('.remove-recent').addEventListener('click', (e) => {
        e.stopPropagation();
        removeRecentSearch(q);
        renderRecentSearches();
        if (!getRecentSearches().length) hideDropdown();
      });

      section.appendChild(item);
    });

    dropdown.appendChild(section);
    showDropdown();
  }

  function doSearch(query) {
    saveRecentSearch(query);
    hideDropdown();
    if (window.location.pathname.endsWith('search.html')) {
      input.value = query;
      const isTag = query.startsWith('#');
      const p = new URLSearchParams(window.location.search);
      p.set('q', query);
      isTag ? p.set('type', 'tag') : p.delete('type');
      window.history.replaceState({}, '', `?${p.toString()}`);
      runSearch();
    } else {
      const isTag = query.startsWith('#');
      const p = new URLSearchParams({ q: query });
      if (isTag) p.set('type', 'tag');
      window.location.href = `search.html?${p.toString()}`;
    }
  }

  function renderSuggestions(query) {
    const cleanQuery = query.replace(/^#/, '');

    fetchMethod(
      `${feedApiBase()}/posts/tags/search?q=${encodeURIComponent(cleanQuery)}`,
      (status, tags) => {
        dropdown.innerHTML = '';
        const section = document.createElement('div');
        section.className = 'search-dropdown-section';

        // typed query 
        const searchLabel = document.createElement('div');
        searchLabel.className = 'search-dropdown-label';
        section.appendChild(searchLabel);

        appendSuggItem(section, 'fa-search', query, null, () => doSearch(query));

        // Matching tags 
        if (status === 200 && Array.isArray(tags) && tags.length) {
          const divider = document.createElement('div');
          divider.className = 'search-dropdown-divider';
          section.appendChild(divider);

          const tagLabel = document.createElement('div');
          tagLabel.className = 'search-dropdown-label';
          tagLabel.textContent = 'Tags';
          section.appendChild(tagLabel);

          tags.slice(0, 5).forEach(tag => {
            appendSuggItem(
              section,
              'fa-hashtag',
              `#${tag.name}`,
              `${tag.usage_count} post${tag.usage_count !== 1 ? 's' : ''}`,
              () => doSearch(`#${tag.name}`)
            );
          });
        }

        // Matching recent searches 
        const recentMatches = getRecentSearches()
          .filter(r => r.toLowerCase().includes(cleanQuery.toLowerCase()) && r !== query)
          .slice(0, 3);

        if (recentMatches.length) {
          const divider2 = document.createElement('div');
          divider2.className = 'search-dropdown-divider';
          section.appendChild(divider2);

          const recentLabel = document.createElement('div');
          recentLabel.className = 'search-dropdown-label';
          recentLabel.textContent = 'Recent';
          section.appendChild(recentLabel);

          recentMatches.forEach(r => {
            appendSuggItem(section, 'fa-clock', r, null, () => doSearch(r));
          });
        }

        dropdown.appendChild(section);
        showDropdown();
      }
    );
  }

  function appendSuggItem(parent, icon, label, meta, onClick) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'search-dropdown-item';
    item.innerHTML = `
      <i class="fas ${icon}"></i>
      <span class="flex-grow-1">${escapeHtml(label)}</span>
      ${meta ? `<span class="text-muted ms-auto" style="font-size:0.75rem;">${escapeHtml(meta)}</span>` : ''}`;
    item.addEventListener('click', onClick);
    parent.appendChild(item);
  }

  // Focus > show recent searches
  input.addEventListener('focus', () => {
    const query = input.value.trim();
    if (!query) renderRecentSearches();
    else renderSuggestions(query);
  });

  // Typing > show suggestions
  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearTimeout(debounce);
    if (!query) { renderRecentSearches(); return; }
    debounce = setTimeout(() => renderSuggestions(query), 250);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!input.closest('.navbar-search').contains(e.target)) {
      hideDropdown();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideDropdown(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = input.value.trim();
      if (query) doSearch(query);
    }
  });
}

// Hot Posts
function loadHotPosts() {
  fetchMethod(`${API_BASE}/posts`, (status, data) => {
    const container = document.getElementById('top5Container');
    if (!container) return;

    if (status !== 200 || !data.length) {
      container.innerHTML = `
        <div class="list-group-item text-muted small text-center py-3">
          No posts yet.
        </div>`;
      return;
    }

    const top3 = data
      .slice()
      .sort((a, b) => b.like_count - a.like_count || b.comment_count - a.comment_count)
      .slice(0, 3);

    container.innerHTML = '';

    top3.forEach((post, index) => {
      const item = document.createElement('a');
      item.href = `posts.html?id=${post.id}`;
      item.className = 'list-group-item list-group-item-action py-2';
      item.innerHTML = `
        <div class="text-muted mb-1" style="font-size:0.75rem;">Trending #${index + 1}</div>
        <div class="fw-bold" style="font-size:0.9rem;">${escapeHtml(post.title)}</div>
      `;
      container.appendChild(item);
    });
  });
}


// Recently viewed posts (localStorage)
const RECENTLY_VIEWED_LIMIT = 10; 

function recentlyViewedKey() {
  const userId = localStorage.getItem('loggedInUserId');
  return userId ? `recentlyViewedPosts_${userId}` : null;
}

function recordRecentlyViewed(post) {
  const key = recentlyViewedKey();
  if (!key || !post?.id) return; // not logged in, or no recents

  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    list = [];
  }

  list = list.filter((p) => parseInt(p.id) !== parseInt(post.id));
  list.unshift({
    id: post.id,
    title: post.title || 'Untitled post',
    category: post.category || null,
    viewed_at: Date.now(),
  });

  list = list.slice(0, RECENTLY_VIEWED_LIMIT);
  localStorage.setItem(key, JSON.stringify(list));
}

function getRecentlyViewed(limit = 3) {
  const key = recentlyViewedKey();
  if (!key) return [];

  try {
    const list = JSON.parse(localStorage.getItem(key)) || [];
    return list.slice(0, limit);
  } catch (e) {
    return [];
  }
}