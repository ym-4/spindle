/** index.html — require login, wire notifications */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
    const ret = encodeURIComponent('index.html');
    window.location.replace(`home.html?login=1&return=${ret}`);
    return;
  }
  if (typeof injectNotificationsOnly === 'function') {
    injectNotificationsOnly('spindleNotifSlot');
  }
});
