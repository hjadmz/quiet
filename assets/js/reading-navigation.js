'use strict';

(() => {
  const toc = document.querySelector('.post > .toc');
  const article = toc?.closest('article');
  if (!article || !CSS.supports('inset-block-end', '1px')) return;

  const prose = article.querySelector('.post-content');
  const button = toc.querySelector('.toc-toggle');
  const list = toc.querySelector('ul');
  const label = button.querySelector('.toc-section');
  const percent = button.querySelector('.toc-percent');
  const ring = button.querySelector('.toc-ring-fill');
  const sections = [...list.querySelectorAll('a')].map((link) => {
    const id = link.getAttribute('href').slice(1);
    return { link, heading: document.getElementById(id), title: link.textContent.trim() };
  }).filter(({ heading }) => heading?.matches('.post-content h2')).reverse();
  if (sections.length < 2) return;

  const roomForControl = window.matchMedia('(min-height: 20rem)');
  let active;
  let lastProgress;
  let frame;

  function update() {
    frame = undefined;
    if (button.hidden) return;
    const { top, bottom, left, right } = article.getBoundingClientRect();
    const control = toc.getBoundingClientRect();
    const clearance = control.left < right && control.right > left
      ? Math.max(0, innerHeight - control.top) : 0;
    const distance = Math.max(1, bottom - top - innerHeight + clearance);
    const progress = Math.floor(100 * Math.min(1, Math.max(0, -top / distance)));
    if (lastProgress !== progress) {
      ring.setAttribute('stroke-dasharray', `${progress} 100`);
      percent.textContent = ` · ${progress}% through article`;
      lastProgress = progress;
    }
    // Use a line near the top, so a heading does not become current the
    // moment it peeks into view at the bottom of the page.
    const readingLine = Math.min(128, Math.max(48, innerHeight * 0.15));
    const current = progress === 100
      ? sections[0]
      : sections.find(({ heading }) => heading.getBoundingClientRect().top <= readingLine);
    if (current === active) return;
    active?.link.removeAttribute('aria-current');
    current?.link.setAttribute('aria-current', 'location');
    label.textContent = current?.title || 'Introduction';
    active = current;
  }

  function scheduleUpdate() {
    if (frame === undefined) frame = requestAnimationFrame(update);
  }

  function setOpen(open) {
    list.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open && active) {
      // Keep the current item in view without moving the page or focus.
      const item = active.link.getBoundingClientRect();
      const panel = list.getBoundingClientRect();
      if (item.top < panel.top || item.bottom > panel.bottom) list.scrollTop += item.top - panel.top;
    }
  }

  function syncPlacement() {
    const enhanced = roomForControl.matches && prose.offsetHeight > innerHeight;
    if (enhanced === !button.hidden) return;
    if (enhanced) {
      button.hidden = false;
      if (list.contains(document.activeElement)) button.focus({ preventScroll: true });
    }
    toc.classList.toggle('toc-enhanced', enhanced);
    setOpen(!enhanced);
    if (!enhanced && document.activeElement === button) sections[sections.length - 1].link.focus({ preventScroll: true });
    button.hidden = !enhanced;
    scheduleUpdate();
  }

  button.addEventListener('click', () => setOpen(list.hidden));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || button.hidden || list.hidden) return;
    setOpen(false);
    button.focus({ preventScroll: true });
  });
  document.addEventListener('click', (event) => {
    if (!button.hidden && !list.hidden && !toc.contains(event.target)) {
      if (list.contains(document.activeElement)) button.focus({ preventScroll: true });
      setOpen(false);
    }
  });
  toc.addEventListener('focusout', (event) => {
    if (!button.hidden && event.relatedTarget && !toc.contains(event.relatedTarget)) setOpen(false);
  });
  for (const { heading, link } of sections) {
    link.addEventListener('click', (event) => {
      if (button.hidden || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      setOpen(false);
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      // Leave fragment navigation and browser history to the native link.
    });
  }

  syncPlacement();
  roomForControl.addEventListener?.('change', syncPlacement);
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', () => { syncPlacement(); scheduleUpdate(); });
  window.addEventListener('pageshow', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate, { once: true });
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => {
    syncPlacement();
    scheduleUpdate();
  }).observe(prose);
})();
