// Corridor screen: bed numbers and icons only, no names or details shown to visitors.
(async function () {
  const { ICONS, api, loadConfig, waitText, connect, escapeHtml, isActive } = window.AskOnce;
  const tiles = document.getElementById('tiles');
  const config = await loadConfig();
  let requests = new Map();

  function stateText(r) {
    if (r.status === 'arrived') return 'Staff with patient';
    if (r.status === 'accepted') return 'Staff on the way';
    if (r.level === 3) return 'Nurse in charge alerted';
    if (r.level === 2) return 'Urgent';
    return 'Waiting';
  }

  function render() {
    const active = [...requests.values()].filter(isActive).sort((a, b) => a.createdAt - b.createdAt);
    const waiting = active.filter((r) => r.status === 'open').length;
    document.getElementById('title').textContent = waiting ? `Ward A: ${waiting} waiting` : 'Ward A: no one waiting';
    if (!active.length) {
      tiles.innerHTML = '<p class="quiet">No requests waiting. New ones appear here instantly.</p>';
      return;
    }
    tiles.innerHTML = active.map((r) => {
      const lvl = r.status === 'open' ? r.level : 1;
      return `<article class="ctile role-${r.role} lvl-${lvl} ${r.status === 'arrived' ? 'is-arrived' : ''}" aria-label="Bed ${escapeHtml(r.bed)}, ${escapeHtml(config.needs[r.need].label)}">
        <div class="tile"><span class="icon">${ICONS[r.need]}</span></div>
        <div class="body">
          <div class="bedno">Bed ${escapeHtml(r.bed)}</div>
          <div class="wait" data-since="${r.createdAt}">${waitText(r.createdAt)}</div>
          <div class="state">${stateText(r)}</div>
        </div></article>`;
    }).join('');
  }

  function tick() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    document.querySelectorAll('[data-since]').forEach((el) => (el.textContent = waitText(Number(el.dataset.since))));
  }

  async function reload() {
    const all = await api('/api/requests?active=1');
    requests = new Map(all.map((r) => [r.id, r]));
    render();
  }

  setInterval(tick, 1000);
  tick();
  connect({
    onChange: (r) => { requests.set(r.id, r); render(); },
    onConnect: reload,
    onReset: reload,
  });
})();
