const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

const roleLabel = (role) => role === "Икона сопротивления" ? "Строитель (Икона)" : role;

const fmtTime = (ts) => {
  if (!ts) return '';
  try { return new Date(ts).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};

async function api(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const body = await res.json(); if (body && body.error) msg += `: ${body.error}`; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

const postJson = (url, data) => api(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {})
});

let cards = [];
let state = { cards: {}, night: 1, mode: 10 };
let chats = [];
let votes = {};
let votingStatus = false;
let pulling = false;

async function pull() {
  if (pulling) return;
  pulling = true;
  try {
    const [c, s, ch, v, vs] = await Promise.all([
      api('/api/cards'), api('/api/state'), api('/api/chat'), api('/api/votes'), api('/api/voting-status')
    ]);
    cards = Array.isArray(c) ? c : [];
    state = s && typeof s === 'object' ? s : { cards: {}, night: 1, mode: 10 };
    chats = Array.isArray(ch) ? ch : [];
    votes = v && typeof v === 'object' ? v : {};
    votingStatus = Boolean(vs && vs.isVotingOpen);
    if (!state.cards || typeof state.cards !== 'object') state.cards = {};

    renderHeader();
    renderPlayers();
    renderChats();
    renderVotes();
    renderVotingButton();
    syncNotesField();
  } catch (e) {
    console.error('pull failed:', e);
  } finally {
    pulling = false;
  }
}

function renderHeader() {
  const label = document.getElementById('night-label');
  if (label) label.textContent = `· ночь ${state.night || 1}`;
  const modeSel = document.getElementById('mode-select');
  if (modeSel) modeSel.value = String(state.mode || 10);
}

function renderVotingButton() {
  const btn = document.getElementById('toggle-vote');
  if (!btn) return;
  btn.style.borderColor = votingStatus ? '#ff5252' : '#ffd47a';
  btn.style.color = votingStatus ? '#ff9a9a' : '#ffd47a';
  btn.textContent = votingStatus ? 'Закрыть голосование' : 'Открыть голосование';
}

function renderPlayers() {
  const list = document.getElementById('list');
  if (!list) return;
  if (!cards.length) {
    list.innerHTML = '<span style="color:#889">Нет данных. Нажмите "Сбросить игру".</span>';
    return;
  }

  list.innerHTML = cards.map((c) => {
    const st = state.cards[c.id] || { dead: false, personalWinDone: false };
    const dot = st.online ? '<span style="color:#69f0ae; margin-right:8px;">●</span>' : '<span style="color:#55617a; margin-right:8px;">○</span>';
    return `
      <div class="admin__row">
        <div>
          <strong>${dot} ${escapeHtml(c.randomCipher || c.cipher || '—')} · ${escapeHtml(roleLabel(c.role))}</strong>
          <small>${escapeHtml(c.alibiProfession || '—')}</small>
        </div>
        <button class="btn-dead ${st.dead ? 'on' : ''}" onclick="toggleDead(${Number(c.id)}, ${!st.dead})">
          ${st.dead ? 'Мёртв' : 'Жив'}
        </button>
        <button class="btn-win ${st.personalWinDone ? 'on' : ''}" onclick="toggleWin(${Number(c.id)}, ${!st.personalWinDone})">
          ${st.personalWinDone ? 'Победа' : '—'}
        </button>
      </div>
    `;
  }).join('');
}

async function toggleState(id, field, value) {
  try {
    await postJson(`/api/state/${Number(id)}`, { [field]: value });
    await pull();
  } catch (e) { alert('Ошибка обновления: ' + e.message); }
}

function toggleDead(id, v) { return toggleState(id, 'dead', v); }
function toggleWin(id, v)  { return toggleState(id, 'personalWinDone', v); }

function renderChats() {
  const box = document.getElementById('chats');
  if (!box) return;
  const withMsgs = chats.filter((c) => Array.isArray(c.messages) && c.messages.length > 0);
  if (!withMsgs.length) {
    box.innerHTML = '<div class="chat__empty" style="color:#7a879e; padding:20px; text-align:center;">Пока никто не задал вопросов.</div>';
    return;
  }

  const drafts = {};
  box.querySelectorAll('input[data-inp]').forEach((inp) => { drafts[inp.dataset.inp] = inp.value; });
  const focusedToken = document.activeElement?.dataset?.inp || null;

  box.innerHTML = withMsgs.map((c) => {
    const token = String(c.token || '');
    const log = c.messages.map((m) => `<div class="msg msg--${escapeHtml(m.from)}">${escapeHtml(m.text)}<small>${fmtTime(m.ts)}</small></div>`).join('');
    return `
      <div class="chat-block" data-token="${escapeHtml(token)}">
        <div class="chat-block__head"><strong>${escapeHtml(c.cipher || '—')}</strong> · ${escapeHtml(c.role)}<small>${escapeHtml(c.alibiProfession || '')}</small></div>
        <div class="chat__log">${log}</div>
        <div class="chat__input">
          <input placeholder="Ответ…" data-inp="${escapeHtml(token)}" />
          <button data-btn="${escapeHtml(token)}">→</button>
        </div>
      </div>
    `;
  }).join('');

  Object.entries(drafts).forEach(([token, val]) => {
    const inp = box.querySelector(`input[data-inp="${CSS.escape(token)}"]`);
    if (inp) inp.value = val;
  });
  if (focusedToken) {
    const inp = box.querySelector(`input[data-inp="${CSS.escape(focusedToken)}"]`);
    if (inp) inp.focus();
  }

  box.querySelectorAll('button[data-btn]').forEach((btn) => {
    btn.onclick = async () => {
      const block = btn.closest('.chat-block');
      const inp = block?.querySelector('input');
      if (!inp) return;
      const text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      try { await postJson(`/api/chat/${encodeURIComponent(btn.dataset.btn)}/reply`, { text }); await pull(); }
      catch (e) { alert('Ошибка отправки: ' + e.message); }
    };
  });
}

function renderVotes() {
  const el = document.getElementById('votes-list');
  if (!el) return;
  if (!cards.length) { el.innerHTML = '<span style="color:#889">Нет данных.</span>'; return; }

  el.innerHTML = cards.map((c) => {
    if ((state.cards[c.id] || {}).dead) return '';
    const vote = votes[c.id];
    let text = 'Не голосовал';
    if (vote === null) text = 'Воздержался';
    else if (vote !== undefined) {
      const t = cards.find((x) => x.id === vote);
      text = t ? `За ${escapeHtml(t.randomCipher || t.cipher || '—')}` : 'Неизвестно';
    }
    return `
      <div class="admin__row" style="grid-template-columns:1fr auto;">
        <div><strong>${escapeHtml(c.randomCipher || c.cipher || '—')} · ${escapeHtml(roleLabel(c.role))}</strong><small>Голос: <span style="color:#69f0ae;">${text}</span></small></div>
      </div>
    `;
  }).join('');
}

function syncNotesField() {
  const notesEl = document.getElementById('global-notes');
  if (!notesEl) return;
  if (document.activeElement === notesEl) return;
  const g = state.cards['global_notes'];
  notesEl.value = (g && g.notes) || '';
}

async function saveNotes() {
  const el = document.getElementById('global-notes');
  const btn = document.getElementById('save-notes');
  if (!el) return;
  try {
    await postJson('/api/state/global_notes', { notes: el.value });
    if (!state.cards['global_notes']) state.cards['global_notes'] = {};
    state.cards['global_notes'].notes = el.value;
    if (btn) { btn.textContent = 'Сохранено!'; setTimeout(() => (btn.textContent = 'Сохранить заметки'), 1500); }
  } catch (e) { alert('Ошибка сохранения: ' + e.message); }
}

function initTabs() {
  document.querySelectorAll('.tab').forEach((t) => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('tab--active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
      t.classList.add('tab--active');
      const panel = document.getElementById('tab-' + t.dataset.tab);
      if (panel) panel.classList.remove('hidden');
      if (t.dataset.tab === 'chats') renderChats();
      if (t.dataset.tab === 'votes') renderVotes();
      if (t.dataset.tab === 'notes') syncNotesField();
    };
  });
}

function initButtons() {
  document.getElementById('refresh').onclick = () => pull();

  document.getElementById('mode-select').onchange = async (e) => {
    const mode = parseInt(e.target.value, 10);
    try { await postJson('/api/set-mode', { mode }); await pull(); } catch (err) { alert('Ошибка режима: ' + err.message); }
  };

  document.getElementById('next-night').onclick = async () => {
    try {
      const data = await api('/api/next-night', { method: 'POST' });
      if (data && data.isMassacre) alert('ВНИМАНИЕ! РЕЗНЯ!');
      await pull();
    } catch (e) { alert('Ошибка ночи: ' + e.message); }
  };

  document.getElementById('toggle-vote').onclick = async () => {
    const newVal = !votingStatus;
    votingStatus = newVal;
    renderVotingButton();
    try { await postJson('/api/voting-status', { isVotingOpen: newVal }); await pull(); } catch (e) { alert('Ошибка голосования: ' + e.message); }
  };

  document.getElementById('reset').onclick = async () => {
    if (!confirm('Сбросить игру и раздать новые роли?')) return;
    try { await api('/api/reset', { method: 'POST' }); await pull(); } catch (e) { alert('Ошибка сброса: ' + e.message); }
  };

  document.getElementById('reset-votes').onclick = async () => {
    try { await api('/api/reset-votes', { method: 'POST' }); votes = {}; renderVotes(); } catch (e) { alert('Ошибка сброса голосов: ' + e.message); }
  };

  document.getElementById('save-notes').onclick = saveNotes;
}

initTabs();
initButtons();
pull();
setInterval(() => { if (!document.hidden) pull(); }, 3000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });