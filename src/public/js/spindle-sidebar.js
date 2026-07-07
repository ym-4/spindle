/** Unified Spindle sidebar — same links on every page. Only replaces `<aside class="sidebar">` inner nav. */
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

  document.addEventListener('DOMContentLoaded', () => {
    const aside = document.querySelector('aside.sidebar');
    if (!aside || aside.dataset.spindleKeep) return;
    
    aside.innerHTML = renderSpindleSidebar(document.body.dataset.page);

    if (typeof loadYourGroups === 'function') {
      loadYourGroups();
    }
  });
})();