// Shared helpers for every Ask once screen.
(function () {
  const svg = (inner) =>
    `<svg viewBox="-32 -32 64 64" fill="currentColor" stroke="currentColor" aria-hidden="true">${inner}</svg>`;

  const ICONS = {
    toilet: svg('<rect x="-14" y="-26" width="28" height="12" rx="3" stroke="none"/><path d="M-20 -10 H20 Q20 10 0 12 Q-20 10 -20 -10Z" stroke="none"/><rect x="-7" y="10" width="14" height="14" stroke="none"/>'),
    drink: svg('<path d="M-14 -18 H14 L10 24 H-10Z" stroke="none"/><line x1="4" y1="-18" x2="12" y2="-32" stroke-width="4" fill="none"/>'),
    pain: svg('<circle r="24" fill="none" stroke-width="5"/><circle cx="-8" cy="-6" r="3.5" stroke="none"/><circle cx="8" cy="-6" r="3.5" stroke="none"/><path d="M-10 13 Q0 4 10 13" fill="none" stroke-width="5" stroke-linecap="round"/>'),
    comfort: svg('<path d="M-26 -10 Q-26 -20 -16 -18 Q0 -14 16 -18 Q26 -20 26 -10 L26 10 Q26 20 16 18 Q0 14 -16 18 Q-26 20 -26 10Z" stroke="none"/>'),
    move: svg('<circle cx="2" cy="-22" r="6" stroke="none"/><path d="M0 -14 L-4 6 L-12 24 M-4 6 L8 24 M-2 -8 L-14 2 M-1 -8 L12 0" fill="none" stroke-width="5" stroke-linecap="round"/>'),
    talk: svg('<path d="M-24 -18 H24 Q28 -18 28 -14 V8 Q28 12 24 12 H-6 L-16 24 V12 H-24 Q-28 12 -28 8 V-14 Q-28 -18 -24 -18Z" stroke="none"/>'),
    jug: svg('<path d="M-16 -22 H10 L14 24 H-18Z" stroke="none"/><path d="M10 -14 Q26 -12 24 4 Q22 14 13 14" fill="none" stroke-width="5"/>'),
    spill: svg('<path d="M0 -26 Q16 -4 16 6 A16 16 0 0 1 -16 6 Q-16 -4 0 -26Z" stroke="none"/>'),
    tick: svg('<path d="M-16 0 L-5 11 L17 -13" fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'),
    bell: svg('<path d="M-16 10 Q-16 -18 0 -20 Q16 -18 16 10 L20 14 H-20Z" stroke="none"/><circle cy="20" r="4" stroke="none"/>'),
  };

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `The server replied with an error (${res.status}).`);
    return data;
  }

  let configPromise = null;
  const loadConfig = () => (configPromise ??= api('/api/config'));

  const param = (name, fallback = '') => new URLSearchParams(location.search).get(name) || fallback;

  function waitText(fromMs) {
    const s = Math.max(0, Math.floor((Date.now() - fromMs) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function minutesText(ms) {
    if (!Number.isFinite(ms)) return 'No data yet';
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
  }

  const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let toastTimer;
  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3500);
  }

  // Socket with a visible banner if the connection drops, and a reload hook on reconnect.
  function connect({ onChange, onReset, onConnect }) {
    const socket = io();
    const banner = document.createElement('div');
    banner.className = 'offline';
    banner.textContent = 'Reconnecting to Ask once…';
    banner.hidden = true;
    document.body.appendChild(banner);
    socket.on('connect', () => {
      banner.hidden = true;
      onConnect?.();
    });
    socket.on('disconnect', () => (banner.hidden = false));
    socket.on('request:changed', (r) => onChange?.(r));
    socket.on('demo:reset', () => onReset?.());
    return socket;
  }

  const isActive = (r) => r.status === 'open' || r.status === 'accepted' || r.status === 'arrived';

  window.AskOnce = { ICONS, api, loadConfig, param, waitText, minutesText, escapeHtml, toast, connect, isActive };
})();
