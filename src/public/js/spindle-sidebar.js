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
      `<div class="sidebar-divider"></div>
      <div id="yourGroupsSection">
        <h6 class="px-3 mt-3 mb-2 text-muted" style="font-size:0.85rem;font-weight:600;">YOUR GROUPS</h6>
        <div id="yourGroupsContainer">
          <div class="sidebar-item"><div class="spinner-border spinner-border-sm" role="status"></div></div>
        </div>
        <a href="groups.html" class="sidebar-item"><i class="fas fa-plus-circle"></i><span>See all groups</span></a>
      </div>`
    );
  };

  window.loadSidebarGroups = function loadSidebarGroups() {
    const userId = localStorage.getItem('loggedInUserId');
    const container = document.getElementById('yourGroupsContainer');
    if (!userId || !container) return;
    const base = (typeof currentUrl !== 'undefined' && currentUrl) ? currentUrl : (typeof API_BASE !== 'undefined' ? API_BASE : '');
    if (!base) { container.innerHTML = ''; return; }
    if (typeof fetchMethod !== 'function') { container.innerHTML = ''; return; }
    fetchMethod(base + '/groups/joined_groups/' + userId, (status, data) => {
      if (status !== 200 || !Array.isArray(data)) { container.innerHTML = ''; return; }
      if (data.length === 0) {
        container.innerHTML = '<a href="groups.html" class="sidebar-item"><i class="fas fa-plus-circle"></i><span>Join study groups</span></a>';
        return;
      }
      container.innerHTML = data.map(function(g) {
        var name = (g.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        return '<a href="groups_feed.html?groupId=' + g.id + '" class="sidebar-item" data-group-id="' + g.id + '"><i class="fas fa-circle" style="font-size:0.5rem;color:#1877f2;"></i><span>' + name + '</span></a>';
      }).join('');
      container.querySelectorAll('[data-group-id]').forEach(function(link) {
        link.addEventListener('click', function() {
          localStorage.setItem('groupId', link.dataset.groupId);
        });
      });
    }, 'GET', null, localStorage.getItem('token'));
  };

  document.addEventListener('DOMContentLoaded', () => {
    const aside = document.querySelector('aside.sidebar');
    if (!aside || aside.dataset.spindleKeep) return;
    aside.innerHTML = renderSpindleSidebar(document.body.dataset.page);
    loadSidebarGroups();
  });
})();
