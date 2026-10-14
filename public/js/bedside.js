// Bedside screen: the patient's tablet.
(async function () {
  const { ICONS, api, loadConfig, param, toast, connect, escapeHtml, isActive } = window.AskOnce;
  const bed = param('bed', '12');
  const PRIMARY = ['toilet', 'drink', 'pain', 'comfort', 'move', 'talk'];
  const SECONDARY = ['jug', 'spill'];

  const main = document.getElementById('main');
  const heading = document.getElementById('heading');
  document.getElementById('bedLabel').textContent = `Bed ${bed}`;
  document.title = `Ask once: bed ${bed}`;

  const config = await loadConfig();
  let settings = await api(`/api/beds/${encodeURIComponent(bed)}`);
  let mine = new Map(); // this bed's active requests
  let view = 'grid';
  let thanksTimer;

  const label = (need) => config.needs[need].label;

  function speak(text) {
    if (!settings.readAloud || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    speechSynthesis.speak(u);
  }

  function applySettings() {
    document.body.classList.toggle('large', settings.largeText);
    const flags = [];
    if (settings.fallsRisk) flags.push('Falls risk');
    if (settings.largeText) flags.push('Large text');
    if (settings.readAloud) flags.push('Read aloud');
    document.getElementById('flags').textContent = flags.join(', ');
  }

  function needButton(need) {
    const role = config.needs[need].role;
    return `<button class="need role-${role}" type="button" data-need="${need}">
      <span class="icon">${ICONS[need]}</span>${escapeHtml(label(need))}</button>`;
  }

  function messageFor(r) {
    if (r.status === 'open') {
      return {
        title: 'Help is on its way',
        text: r.level > 1 ? `You asked for: ${label(r.need)}. The whole team has been told.` : `You asked for: ${label(r.need)}.`,
      };
    }
    if (r.status === 'accepted') return { title: `${r.acceptedBy} is coming`, text: `You asked for: ${label(r.need)}.` };
    return { title: 'Help is here', text: `${label(r.need)}.` };
  }

  function render() {
    clearTimeout(thanksTimer);
    if (view === 'thanks') {
      heading.textContent = 'Thank you';
      main.innerHTML = '<p class="thanks">All done. Tap the screen whenever you need something.</p>';
      thanksTimer = setTimeout(() => { view = 'grid'; render(); }, 3500);
      return;
    }
    if (view === 'status' && mine.size) {
      heading.textContent = 'Your requests';
      const cards = [...mine.values()].map((r) => {
        const m = messageFor(r);
        const actions = [];
        if (r.status === 'open') actions.push(`<button class="btn" data-act="cancel" data-id="${r.id}">Cancel request</button>`);
        if (r.status !== 'arrived') actions.push(`<button class="btn btn-blue" data-act="arrive" data-id="${r.id}">Staff: I'm here</button>`);
        else actions.push(`<button class="btn btn-go" data-act="done" data-id="${r.id}">Staff: Done</button>`);
        return `<article class="status ${r.status === 'open' ? 'is-open' : ''}">
          <div class="badge icon">${r.status === 'open' ? ICONS[r.need] : ICONS.tick}</div>
          <div><h2>${escapeHtml(m.title)}</h2><p>${escapeHtml(m.text)}</p></div>
          <div class="actions">${actions.join('')}</div></article>`;
      });
      main.innerHTML = `<div class="status-list">${cards.join('')}</div>
        <button class="pending-link" type="button" data-act="grid">Ask for something else</button>`;
      return;
    }
    view = 'grid';
    heading.textContent = 'What do you need?';
    const pending = mine.size
      ? `<button class="pending-link" type="button" data-act="status">See your ${mine.size === 1 ? 'request' : `${mine.size} requests`}</button>`
      : '';
    main.innerHTML = `${pending}<div class="needs">${PRIMARY.map(needButton).join('')}</div>
      <div class="needs-small">${SECONDARY.map(needButton).join('')}</div>`;
  }

  async function ask(need) {
    main.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      const r = await api('/api/requests', { method: 'POST', body: { bed, need } });
      mine.set(r.id, r);
      view = 'status';
      render();
      speak(`You asked for ${label(need)}. Help is on its way.`);
    } catch (err) {
      toast(err.message);
      render();
    }
  }

  main.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.need) return ask(btn.dataset.need);
    const { act, id } = btn.dataset;
    if (act === 'grid' || act === 'status') { view = act; return render(); }
    try {
      btn.disabled = true;
      await api(`/api/requests/${id}/${act}`, { method: 'POST', body: {} });
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });

  function onChange(r) {
    if (r.bed !== bed) return;
    const before = mine.get(r.id);
    if (isActive(r)) {
      mine.set(r.id, r);
      if (before && before.status !== r.status) speak(messageFor(r).title);
      if (view !== 'thanks') render();
    } else if (before) {
      mine.delete(r.id);
      if (r.status === 'done') speak('All done. Thank you.');
      view = mine.size ? view : 'thanks';
      render();
    }
  }

  async function reload() {
    const list = await api(`/api/requests?bed=${encodeURIComponent(bed)}&active=1`);
    mine = new Map(list.map((r) => [r.id, r]));
    if (mine.size && view === 'grid') view = 'status';
    if (!mine.size && view === 'status') view = 'grid';
    render();
  }

  // Staff-only setup dialog.
  const dialog = document.getElementById('setup');
  document.getElementById('setupBtn').addEventListener('click', () => {
    for (const key of ['fallsRisk', 'largeText', 'readAloud']) document.getElementById(key).checked = settings[key];
    dialog.showModal();
  });
  document.getElementById('setupCancel').addEventListener('click', () => dialog.close());
  document.getElementById('setupSave').addEventListener('click', async () => {
    try {
      settings = await api(`/api/beds/${encodeURIComponent(bed)}`, {
        method: 'PUT',
        body: {
          fallsRisk: document.getElementById('fallsRisk').checked,
          largeText: document.getElementById('largeText').checked,
          readAloud: document.getElementById('readAloud').checked,
        },
      });
      applySettings();
      dialog.close();
      toast('Settings saved for this bed.');
    } catch (err) {
      toast(err.message);
    }
  });

  applySettings();
  render();
  connect({
    onChange,
    onConnect: reload,
    onReset: async () => {
      settings = await api(`/api/beds/${encodeURIComponent(bed)}`);
      applySettings();
      view = 'grid';
      reload();
    },
  });
})();
