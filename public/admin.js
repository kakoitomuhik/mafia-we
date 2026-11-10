const escapeHtml = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

const roleLabel = (role) => role === "Икона сопротивления" ? "Строитель (Икона)" : role;

async function api(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error('HTTP ' + res.status);
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

// 1. Инициализация вкладок
document.querySelectorAll('.tab').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('tab--active'));
    t.classList.add('tab--active');
    
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById('tab-' + t.dataset.tab);
    if (panel) panel.classList.remove('hidden');

    if (t.dataset.tab === 'chats') renderChats();
    if (t.dataset.tab === 'votes') renderVotes();
    if (t.dataset.tab === 'notes') syncNotes();
  };
});

// 2. Заметки
function syncNotes() {
  const notesEl = document.getElementById('global-notes');
  if (!notesEl) return;
  if (document.activeElement === notesEl) return;
  const g = state.cards ? state.cards['global_notes'] : null;
  notesEl.value = (g && g.notes) || '';
}

document.getElementById('save-notes').onclick = async () => {
  const el = document.getElementById('global-notes');
  const btn = document.getElementById('save-notes');
  if (!el) return;
  btn.textContent = 'Сохранение...';
  try {
    await postJson('/api/state/global_notes', { notes: el.value });
    if (!state.cards) state.cards = {};
    if (!state.cards['global_notes']) state.cards['global_notes'] = {};
    state.cards['global_notes'].notes = el.value;
    btn.textContent = 'Сохранено!';
    setTimeout(() => btn.textContent = 'Сохранить заметки', 1500);
  } catch (e) {
    btn.textContent = 'Ошибка!';
    setTimeout(() => btn.textContent = 'Сохранить заметки', 2000);
  }
};

// 3. Загрузка
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
    if (!state.cards) state.cards = {};

    document.getElementById('night-label').textContent = `· ночь ${state.night || 1}`;
    document.getElementById('mode-select').value = state.mode || 10;

    renderPlayers();
    renderChats();
    renderVotes();
    renderVotingButton();
    if (!document.getElementById('tab-notes').classList.contains('hidden')) syncNotes();
  } catch (e) {
    console.error('pull failed:', e);
  } finally {
    pulling = false;
  }
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
    list.innerHTML = '<span style="color:#889">Нет данных.</span>';
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
        <button class="btn-dead ${st.dead ? 'on' : ''}" onclick="toggleDead(${Number(c.id)}, ${!st.dead})">${st.dead ? 'Мёртв' : 'Жив'}</button>
        <button class="btn-win ${st.personalWinDone ? 'on' : ''}" onclick="toggleWin(${Number(c.id)}, ${!st.personalWinDone})">${st.personalWinDone ? 'Победа' : '—'}</button>
      </div>
    `;
  }).join('');
}

async function toggleState(id, field, value) {
  try { await postJson(`/api/state/${Number(id)}`, { [field]: value }); await pull(); } catch (e) { alert('Ошибка: ' + e.message); }
}
function toggleDead(id, v) { return toggleState(id, 'dead', v); }
function toggleWin(id, v)  { return toggleState(id, 'personalWinDone', v); }

function renderChats() {
  const box = document.getElementById('chats');
  if (!box) return;
  const withMsgs = chats.filter((c) => Array.isArray(c.messages) && c.messages.length > 0);
  if (!withMsgs.length) {
    box.innerHTML = '<div class="chat__empty" style="color:#7a879e; padding:20px; text-align:center;">Нет вопросов.</div>';
    return;
  }
  const drafts = {};
  box.querySelectorAll('input[data-inp]').forEach((inp) => { drafts[inp.dataset.inp] = inp.value; });
  const focusedToken = document.activeElement?.dataset?.inp || null;

  box.innerHTML = withMsgs.map((c) => {
    const token = String(c.token || '');
    const log = c.messages.map((m) => `<div class="msg msg--${escapeHtml(m.from)}">${escapeHtml(m.text)}</div>`).join('');
    return `
      <div class="chat-block" data-token="${escapeHtml(token)}">
        <div class="chat-block__head"><strong>${escapeHtml(c.cipher || '—')}</strong> · ${escapeHtml(c.role)}</div>
        <div class="chat__log">${log}</div>
        <div class="chat__input">
          <input placeholder="Ответ…" data-inp="${escapeHtml(token)}" />
          <button data-btn="${escapeHtml(token)}">→</button>
        </div>
      </div>
    `;
  }).join('');

  Object.entries(drafts).forEach(([token, val]) => { const inp = box.querySelector(`input[data-inp="${CSS.escape(token)}"]`); if (inp) inp.value = val; });
  if (focusedToken) { const inp = box.querySelector(`input[data-inp="${CSS.escape(focusedToken)}"]`); if (inp) inp.focus(); }

  box.querySelectorAll('button[data-btn]').forEach((btn) => {
    btn.onclick = async () => {
      const block = btn.closest('.chat-block');
      const inp = block?.querySelector('input');
      if (!inp) return;
      const text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      try { await postJson(`/api/chat/${encodeURIComponent(btn.dataset.btn)}/reply`, { text }); await pull(); }
      catch (e) { alert('Ошибка: ' + e.message); }
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
    else if (vote !== undefined) { const t = cards.find((x) => x.id === vote); text = t ? `За ${escapeHtml(t.randomCipher || t.cipher || '—')}` : 'Неизвестно'; }
    return `
      <div class="admin__row" style="grid-template-columns:1fr auto;">
        <div><strong>${escapeHtml(c.randomCipher || c.cipher || '—')} · ${escapeHtml(roleLabel(c.role))}</strong><small>Голос: <span style="color:#69f0ae;">${text}</span></small></div>
      </div>
    `;
  }).join('');
}

// 4. Кнопки
document.getElementById('refresh').onclick = () => pull();
document.getElementById('mode-select').onchange = async (e) => { await postJson('/api/set-mode', { mode: parseInt(e.target.value, 10) }); await pull(); };
document.getElementById('next-night').onclick = async () => { const data = await api('/api/next-night', { method: 'POST' }); if (data.isMassacre) alert('ВНИМАНИЕ! РЕЗНЯ!'); await pull(); };
document.getElementById('toggle-vote').onclick = async () => { await postJson('/api/voting-status', { isVotingOpen: !votingStatus }); await pull(); };
document.getElementById('reset').onclick = async () => { if (!confirm('Сбросить игру?')) return; await api('/api/reset', { method: 'POST' }); await pull(); };
document.getElementById('reset-votes').onclick = async () => { await api('/api/reset-votes', { method: 'POST' }); votes = {}; renderVotes(); };

pull();
setInterval(() => { if (!document.hidden) pull(); }, 5000);