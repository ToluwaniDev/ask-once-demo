// Staff phone: receives only the requests for this person's role.
(async function () {
  const { ICONS, api, loadConfig, param, waitText, toast, connect, escapeHtml, isActive } = window.AskOnce;
  const app = document.getElementById('app');
  const config = await loadConfig();
  const role = param('role');
  const name = param('name');

  if (!role || !name || !config.roles[role]) return showSignIn();

  const roleClass = role === 'nic' ? 'role-nurse' : `role-${role}`;
  document.body.classList.add(roleClass);
  document.title = `Ask once: ${name}`;
  let requests = new Map();
  let audio = null;

  app.innerHTML = `
    <div class="staff">
      <div class="top">
        <h1>${escapeHtml(name)}</h1>
        <p>${escapeHtml(config.roles[role])}, Ward A. <a href="/staff.html">Change</a></p>
      </div>
      <main id="list" aria-live="polite"></main>
    </div>
    <div class="shift-start" id="shiftStart">
      <h2>Start your shift</h2>
      <p>This lets the phone beep and vibrate when a request arrives.</p>
      <button class="btn btn-go" type="button" id="startBtn">Start shift</button>
    </div>`;
  const list = document.getElementById('list');

  document.getElementById('startBtn').addEventListener('click', () => {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
    document.getElementById('shiftStart').remove();
    beep();
  });

  // Nurse in charge sees nurse requests plus anything escalated to level 3.
  const visible = (r) => (role === 'nic' ? r.role === 'nurse' || r.level >= 3 : r.role === role);

  function beep() {
    if (audio) {
      [0, 0.25].forEach((delay) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.2;
        osc.connect(gain).connect(audio.destination);
        osc.start(audio.currentTime + delay);
        osc.stop(audio.currentTime + delay + 0.15);
      });
    }
    navigator.vibrate?.([200, 100, 200]);
    document.body.classList.remove('alerting');
    void document.body.offsetWidth;
    document.body.classList.add('alerting');
  }

  function tags(r) {
    const t = [];
    if (r.fallsRisk) t.push('<span class="tag tag-falls">Falls risk</span>');
    if (r.level === 2) t.push('<span class="tag tag-urgent">Urgent: sent to the whole team</span>');
    if (r.level === 3) t.push('<span class="tag tag-esc">Escalated: nobody accepted</span>');
    return t.length ? `<div class="tags">${t.join('')}</div>` : '';
  }

  function card(r, mineCard) {
    const need = config.needs[r.need];
    let actions = '';
    if (r.status === 'open') {
      actions = `<button class="btn btn-go" data-act="accept" data-id="${r.id}">Accept</button>`;
    } else if (mineCard && r.status === 'accepted') {
      actions = `<button class="btn btn-blue" data-act="arrive" data-id="${r.id}">I'm at the bedside</button>
        <button class="btn" data-act="done" data-id="${r.id}">Done</button>`;
    } else if (mineCard) {
      actions = `<button class="btn btn-go" data-act="done" data-id="${r.id}">Done</button>`;
    }
    const sub = r.status === 'open' ? `<span class="wait" data-since="${r.createdAt}">${waitText(r.createdAt)}</span>` : '';
    const note = mineCard ? (r.status === 'accepted' ? 'The patient has been told you are coming.' : 'You are with the patient.') : '';
    return `<article class="card role-${r.role} lvl-${r.status === 'open' ? r.level : 1}">
      <div class="head">
        <div class="tile icon">${ICONS[r.need]}</div>
        <div><h3>${escapeHtml(need.label)}</h3><p class="where">Bed ${escapeHtml(r.bed)}${note ? `. ${note}` : ''}</p></div>
        ${sub}
      </div>
      ${r.status === 'open' ? tags(r) : ''}
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </article>`;
  }

  function render() {
    const all = [...requests.values()].filter(isActive);
    const waiting = all.filter((r) => r.status === 'open' && visible(r)).sort((a, b) => b.level - a.level || a.createdAt - b.createdAt);
    const yours = all.filter((r) => r.status !== 'open' && r.acceptedBy === name);
    const taken = all.filter((r) => r.status !== 'open' && r.acceptedBy !== name && visible(r));
    let html = '';
    html += `<h2>Waiting (${waiting.length})</h2>`;
    html += waiting.length ? waiting.map((r) => card(r, false)).join('') : '<p class="empty">Nothing waiting for your role. New requests will buzz this phone.</p>';
    if (yours.length) html += `<h2>Yours (${yours.length})</h2>${yours.map((r) => card(r, true)).join('')}`;
    if (taken.length) {
      html += `<h2>Taken by colleagues</h2>`;
      html += taken.map((r) => `<p class="others">Bed ${escapeHtml(r.bed)}, ${escapeHtml(config.needs[r.need].label)}: ${escapeHtml(r.acceptedBy || '')}</p>`).join('');
    }
    list.innerHTML = html;
    document.title = waiting.length ? `(${waiting.length}) Ask once: ${name}` : `Ask once: ${name}`;
  }

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    btn.disabled = true;
    try {
      await api(`/api/requests/${btn.dataset.id}/${btn.dataset.act}`, { method: 'POST', body: { name, role } });
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });

  function onChange(r) {
    const before = requests.get(r.id);
    requests.set(r.id, r);
    const isNew = !before && r.status === 'open' && visible(r);
    const escalatedToMe = before && r.status === 'open' && r.level > before.level && visible(r);
    if (isNew || escalatedToMe) beep();
    render();
  }

  async function reload() {
    const all = await api('/api/requests?active=1');
    requests = new Map(all.map((r) => [r.id, r]));
    render();
  }

  setInterval(() => {
    document.querySelectorAll('[data-since]').forEach((el) => (el.textContent = waitText(Number(el.dataset.since))));
  }, 1000);

  connect({ onChange, onConnect: reload, onReset: reload });

  function showSignIn() {
    const options = Object.entries(config.roles).map(([key, text]) => `<option value="${key}">${escapeHtml(text)}</option>`).join('');
    app.innerHTML = `<form class="signin" id="signin">
      <h1>Sign in to Ask once</h1>
      <p>Demo sign-in. A real ward would use Trust accounts.</p>
      <label for="name">Your first name</label>
      <input id="name" name="name" required maxlength="40" autocomplete="given-name">
      <label for="role">Your role today</label>
      <select id="role" name="role">${options}</select>
      <button class="btn btn-blue" type="submit">Start receiving requests</button>
    </form>`;
    document.getElementById('signin').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      location.search = new URLSearchParams({ role: data.get('role'), name: data.get('name').trim() }).toString();
    });
  }
})();
