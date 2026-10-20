// Thin line icons (24×24, stroke = currentColor).
const P = {
  seed: '<path d="M12 2.2c5.3 3.6 6.6 12.4 0 19.6C5.4 14.6 6.7 5.8 12 2.2z"/><path d="M12 5.4c1.5 4.6 1.5 9.4 0 13.4"/>',
  palm: '<path d="M12.3 22c.6-4.6.4-8.8-.7-12.6"/><path d="M11.6 9.4c-2.6-2.6-5.6-3-8.6-1.4"/><path d="M11.6 9.4c2.8-2.6 6-2.8 9.2-1"/><path d="M11.6 9.4c-1.2-3.2-3.2-5.2-6.2-5.8"/><path d="M11.6 9.4c1.4-3.2 3.6-5 6.6-5.4"/><path d="M11.6 9.4c-2.2-.4-4.6.6-6.2 3"/><path d="M11.6 9.4c2.4-.2 4.6 1 6 3.4"/>',
  palmDates: '<path d="M12.3 22c.6-4.6.4-8.8-.7-12.6"/><path d="M11.6 9.4c-2.6-2.6-5.6-3-8.6-1.4"/><path d="M11.6 9.4c2.8-2.6 6-2.8 9.2-1"/><path d="M11.6 9.4c-1.2-3.2-3.2-5.2-6.2-5.8"/><path d="M11.6 9.4c1.4-3.2 3.6-5 6.6-5.4"/><circle cx="9.4" cy="12.6" r=".9"/><circle cx="8.4" cy="14.4" r=".9"/><circle cx="10.2" cy="14.6" r=".9"/><circle cx="14.4" cy="12.8" r=".9"/><circle cx="15.2" cy="14.6" r=".9"/>',
  sprout: '<path d="M12 21v-8"/><path d="M12 13c-4 0-6-2.2-6.4-6.2 4 0 6.4 2.2 6.4 6.2z"/><path d="M12 11.4c0-4 2.4-6.4 6.4-6.6 0 4-2.4 6.6-6.4 6.6z"/>',
  sapling: '<path d="M12 21c.2-2.6.1-4.8-.3-7"/><path d="M11.7 14c-2.8-3-5.8-3.6-8.6-2.2"/><path d="M11.7 14c3-3 6-3.4 8.8-1.8"/><path d="M11.7 14c-.8-3.6-.2-6.6 2-9"/><path d="M11.7 14c-2-2.2-2.8-5-2.2-8"/><path d="M8 21h8"/>',
  drop: '<path d="M12 3c3.6 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.4-6.4 6-11z"/><path d="M9.2 14.6a3 3 0 0 0 2.4 2.8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/><path d="M4.6 7.4h14.8M4.6 16.6h14.8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>',
  ruler: '<rect x="8" y="2.5" width="8" height="19" rx="1.2"/><path d="M8 6h3M8 9.5h2M8 13h3M8 16.5h2"/>',
  bag: '<path d="M5 8h14l-1.1 12.2a1 1 0 0 1-1 .8H7.1a1 1 0 0 1-1-.8L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.4-3.8 4-5.6 7.5-5.6s6.1 1.8 7.5 5.6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"/><path d="M7.4 14.5h9.2"/>',
  gem: '<path d="M6.5 4h11l3.5 5-9 11-9-11z"/><path d="M3 9h18"/><path d="M12 20 8.5 9l3.5-5 3.5 5z"/>',
  basket: '<path d="M3.5 10h17l-1.6 9.2a1.6 1.6 0 0 1-1.6 1.3H6.7a1.6 1.6 0 0 1-1.6-1.3L3.5 10z"/><path d="M8 10 11 4M16 10l-3-6"/><path d="M5 14h14M6 17.5h12"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z"/><path d="M5 19 13 11"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;

export function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}
