(() => {
  const root = document.documentElement;
  const key = 'quiet-theme';
  const choices = ['system', 'light', 'dark'];
  let theme = root.getAttribute('data-theme') || 'system';
  let control;

  function apply() {
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    if (control) control.querySelector(`[value="${theme}"]`).checked = true;
  }

  function restore() {
    try {
      const saved = localStorage.getItem(key);
      if (choices.includes(saved)) theme = saved;
    } catch {}
    apply();
  }

  restore();
  addEventListener('DOMContentLoaded', () => {
    control = document.getElementById('theme-control');
    apply();
    control.hidden = false;
    control.addEventListener('change', (event) => {
      theme = event.target.value;
      try { localStorage.setItem(key, theme); } catch {}
      apply();
    });
  });
  addEventListener('pageshow', restore);
})();
