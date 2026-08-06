(function () {
  const LINKS = [
    { href: 'index.html', page: 'home', icon: 'fa-home', label: 'Home' },
    { href: 'groups.html', page: 'groups', icon: 'fa-users', label: 'Study Groups' },
    { href: 'marketplace.html', page: 'marketplace', icon: 'fa-store', label: 'Marketplace' },
    { href: 'chat.html', page: 'chat', icon: 'fa-comments', label: 'Chats' },
    { href: 'friends.html', page: 'friends', icon: 'fa-user-plus', label: 'Friends' },
    { href: 'profile.html', page: 'profile', icon: 'fa-user', label: 'Profile' },
  ];
  const LINKS2 = [
    { href: 'saved.html', page: 'saved', icon: 'fa-bookmark', label: 'Saved' },
    { href: 'settings.html', page: 'settings', icon: 'fa-cog', label: 'Settings' },
    { href: 'stories.html', page: 'stories', icon: 'fa-circle', label: 'Status' },
  ];

  function item(link, active) {
    const cls = link.page === active ? 'sidebar-item active' : 'sidebar-item';
    return `<a href="${link.href}" class="${cls}" data-page="${link.page}"><i class="fas ${link.icon}"></i><span>${link.label}</span></a>`;
  }

  window.renderSpindleSidebar = function renderSpindleSidebar(activePage) {
    const page = activePage || document.body.dataset.page || '';

    return (
      LINKS.map((l) => item(l, page)).join('') +
      '<div class="sidebar-divider"></div>' +
      LINKS2.map((l) => item(l, page)).join('') +
      `<div class="sidebar-divider" id="yourGroupsDivider" style="display:none;"></div>
      <div id="yourGroupsSection" style="display:none;">
        <h6 class="px-3 mt-3 mb-2 text-muted" style="font-size:0.85rem;font-weight:600;">YOUR GROUPS</h6>
        <div id="yourGroupsContainer"></div>
      </div>`
    );
  };

  window.loadYourGroups = function loadYourGroups() {
    const token = getToken ? getToken() : localStorage.getItem('token');
    const section = document.getElementById('yourGroupsSection');
    const divider = document.getElementById('yourGroupsDivider');
    if (!token) return;
    if (section) section.style.display = 'block';
    if (divider) divider.style.display = 'block';
    const container = document.getElementById('yourGroupsContainer');
    if (!container) return;

    const base =
      typeof currentUrl !== 'undefined' && currentUrl
        ? currentUrl
        : (typeof getApiBase === 'function' && getApiBase()) || window.location.origin || '';

    fetch(base + '/groups/joined_groups', {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then((data) => {
        container.innerHTML = '';
        const groups = Array.isArray(data) ? data : data.groups || [];
        if (!groups.length) {
          const empty = document.createElement('a');
          empty.href = 'groups.html';
          empty.className = 'sidebar-item d-flex align-items-center text-decoration-none';
          empty.style.cssText =
            'border:1.5px dashed #ccc;border-radius:10px;margin:0.25rem 0.5rem;color:#666;transition:border-color 0.2s,color 0.2s;';
          empty.innerHTML =
            '<i class="fas fa-plus-circle me-2" style="font-size:1.2rem;color:#1877f2;"></i><span style="font-size:0.9rem;font-weight:600;">Join study groups</span>';
          empty.addEventListener('mouseenter', () => {
            empty.style.borderColor = '#1877f2';
            empty.style.color = '#1877f2';
          });
          empty.addEventListener('mouseleave', () => {
            empty.style.borderColor = '#ccc';
            empty.style.color = '#666';
          });
          container.appendChild(empty);
          return;
        }
        groups.forEach(function (g) {
          const item = document.createElement('a');
          item.href = 'groups_feed.html';
          item.className = 'sidebar-item';
          item.innerHTML =
            '<i class="fas fa-circle" style="font-size:0.5rem;color:#42b72a;"></i><span>' +
            (g.name || g.group_name || 'Group') +
            '</span>';
          item.addEventListener('click', function (e) {
            e.preventDefault();
            localStorage.setItem('groupId', g.id || g.group_id);
            window.location.href = 'groups_feed.html';
          });
          container.appendChild(item);
        });
      })
      .catch(function () {
        /* silently ignore */
      });
  };

  function getSidebarOverlay() {
    let overlay = document.getElementById('sidebarOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function closeSidebar() {
    const sidebar = document.querySelector('aside.sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('mobile-open');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  function openSidebar() {
    const sidebar = document.querySelector('aside.sidebar');
    if (!sidebar) return;
    sidebar.classList.add('mobile-open');
    const overlay = getSidebarOverlay();
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function toggleSidebar() {
    const sidebar = document.querySelector('aside.sidebar');
    if (!sidebar) return;
    if (sidebar.classList.contains('mobile-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function createSidebarToggle() {
    if (document.getElementById('sidebarToggleBtn')) return;
    const brandLink = document.querySelector('.navbar-brand');
    if (!brandLink) return;

    const button = document.createElement('button');
    button.id = 'sidebarToggleBtn';
    button.type = 'button';
    button.className = 'sidebar-toggle-btn';
    button.setAttribute('aria-label', 'Toggle navigation');
    button.innerHTML = '<i class="fas fa-bars"></i>';
    brandLink.insertAdjacentElement('beforebegin', button);
    button.addEventListener('click', toggleSidebar);
  }

  function initSidebarToggle() {
    createSidebarToggle();
    const overlay = getSidebarOverlay();
    overlay.addEventListener('click', closeSidebar);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 768) {
        closeSidebar();
      }
    });

    const sidebar = document.querySelector('aside.sidebar');
    if (sidebar) {
      sidebar.addEventListener('click', function (event) {
        if (event.target.closest('.sidebar-item') && window.innerWidth <= 768) {
          closeSidebar();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const aside = document.querySelector('aside.sidebar');
    if (!aside || aside.dataset.spindleKeep) return;

    aside.innerHTML = renderSpindleSidebar(document.body.dataset.page);
    loadYourGroups();
    initSidebarToggle();
  });
})();
