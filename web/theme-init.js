// Apply the saved theme before CSS paints to avoid a flash on reload.
(() => {
  let preference = 'light';
  try { preference = localStorage.getItem('mission-control:theme') === 'dark' ? 'dark' : 'light'; } catch {}
  document.documentElement.dataset.theme = preference;
})();
