// Ward dashboard: turns every request into patterns the team can act on.
(async function () {
  const { api, loadConfig, minutesText, waitText, toast, connect, escapeHtml, isActive } = window.AskOnce;
  const config = await loadConfig();
  let all = [];
  let pending;

  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

  function render() {
    const valid = all.filter((r) => r.status !== 'cancelled');
    const accepted = valid.filter((r) => r.acceptedAt);
    const escalations = valid.filter((r) => r.level >= 3).length;
    const counts = {};
    for (const r of valid) counts[r.need] = (counts[r.need] || 0) + 1;
    const ranked = Object.keys(config.needs).map((n) => [n, counts[n] || 0]).sort((a, b) => b[1] - a[1]);
    const top = ranked[0] && ranked[0][1] ? config.needs[ranked[0][0]].label : 'None yet';

    const kpis = [
      ['Requests today', String(valid.length)],
      ['Average time to accept', minutesText(avg(accepted.map((r) => r.acceptedAt - r.createdAt)))],
      ['Escalated to nurse in charge', String(escalations)],
      ['Most common need', top],
    ];
    document.getElementById('kpis').innerHTML = kpis.map(([l, v]) => `<div class="kpi"><p>${l}</p><strong>${escapeHtml(v)}</strong></div>`).join('');

    // Requests by hour, in this device's local time.
    const hours = new Map();
    for (const r of valid) {
      const h = new Date(r.createdAt).getHours();
      hours.set(h, (hours.get(h) || 0) + 1);
    }
    const nowH = new Date().getHours();
    const keys = hours.size ? [...hours.keys()] : [nowH];
    const minH = Math.min(...keys, nowH);
    const maxH = Math.max(...keys, nowH);
    const range = [];
    for (let h = minH; h <= maxH; h++) range.push(h);
    const peak = Math.max(1, ...hours.values());
    document.getElementById('hours').innerHTML = range.map((h) => {
      const n = hours.get(h) || 0;
      const isPeak = n === peak && n > 0;
      return `<div class="col ${isPeak ? 'peak' : ''}"><span class="n">${n || ''}</span><div class="barv" style="height:${(n / peak) * 85}%"></div></div>`;
    }).join('');
    document.getElementById('hourLabels').innerHTML = range.map((h) => `<span>${String(h).padStart(2, '0')}</span>`).join('');

    const maxCount = Math.max(1, ...ranked.map((x) => x[1]));
    document.getElementById('needs').innerHTML = ranked.map(([n, c]) =>
      `<div class="needrow role-${config.needs[n].role}"><span>${escapeHtml(config.needs[n].label)}</span>
        <div class="track"><div class="fill" style="width:${(c / maxCount) * 100}%"></div></div><b>${c}</b></div>`).join('');

    const open = all.filter(isActive).sort((a, b) => a.createdAt - b.createdAt);
    document.getElementById('open').innerHTML = open.length
      ? `<table class="table"><thead><tr><th>Bed</th><th>Need</th><th>Status</th><th>Waiting</th></tr></thead><tbody>${open.map((r) => {
          const status = r.status === 'open' ? (r.level === 3 ? 'Escalated' : r.level === 2 ? 'Urgent' : 'Waiting')
            : r.status === 'accepted' ? `${escapeHtml(r.acceptedBy)} on the way` : `${escapeHtml(r.acceptedBy)} with patient`;
          return `<tr><td>${escapeHtml(r.bed)}</td><td>${escapeHtml(config.needs[r.need].label)}</td><td>${status}</td><td>${waitText(r.createdAt)}</td></tr>`;
        }).join('')}</tbody></table>`
      : '<p>No open requests right now.</p>';
  }

  async function reload() {
    all = await api('/api/requests');
    render();
  }

  // Batch bursts of updates into one refresh.
  const refresh = () => { clearTimeout(pending); pending = setTimeout(reload, 300); };

  document.getElementById('seedBtn').addEventListener('click', async () => {
    try { await api('/api/demo/seed', { method: 'POST' }); toast('Sample day loaded.'); } catch (err) { toast(err.message); }
  });
  document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm('Clear every request and bed setting from the demo?')) return;
    try { await api('/api/demo/reset', { method: 'POST' }); toast('Demo reset.'); } catch (err) { toast(err.message); }
  });

  setInterval(render, 5000);
  connect({ onChange: refresh, onConnect: reload, onReset: reload });
})();
