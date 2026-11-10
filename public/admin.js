const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

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

// Вкладки
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

// Заметки
function syncNotes() {
  const el = document.getElementById('global-notes');
  if (!el || document.activeElement === el) return;
  const g = state.cards ? state.cards['global_notes'] : null;
  el.value = (g && g.notes) || '';
}

document.getElementById('save-notes').onclick = async () => {
  const el = document.getElementById('global-notes');
  const btn = document.getElementById('save-notes');
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

// Загрузка
async function pull() {
  try {
    const [c, s, ch, v, vs] = await Promise.all([
      api('/api/cards'), api('/api/state'), api('/api/chat'), api('/api/votes'), api('/api/voting-status')
    ]);
    cards = c || [];
    state = s || { cards: {}, night: 1, mode: 10 };
    chats = ch || [];
    votes = v || {};
    votingStatus = vs.isVotingOpen || false;
    if (!state.cards) state.cards = {};

    document.getElementById('night-label').textContent = `· ночь ${state.night || 1}`;
    document.getElementById('mode-select').value = state.mode || 10;

    renderPlayers();
    renderChats();
    renderVotes();
    updateVoteButton();
    if (!document.getElementById('tab-notes').classList.contains('hidden')) syncNotes();
  } catch (e) {
    console.error('Ошибка загрузки:', e);
  }
}

function updateVoteButton() {
  const btn = document.getElementById('toggle-vote');
  if (!btn) return;
  btn.textContent = votingStatus ? 'Закрыть голосование' : 'Открыть голосование';
  btn.style.borderColor = votingStatus ? '#ff5252' : '#ffd47a';
  btn.style.color = votingStatus ? '#ff9a9a' : '#ffd47a';
}

function renderPlayers() {
  const list = document.getElementById('list');
  if (!list) return;
  if (!cards.length) { list.innerHTML = '<span style="color:#889">Нет данных.</span>'; return; }
  list.innerHTML = cards.map(c => {
    const st = state.cards[c.id] || { dead: false, personalWinDone: false };
    const dot = st.online ? '<span style="color:#69f0ae; margin-right:8px;">●</span>' : '<span style="color:#55617a; margin-right:8px;">○</span>';
    return `
      <div class="admin__row">
        <div>
          <strong>${dot} ${escapeHtml(c.token || c.cipher)} · ${escapeHtml(c.role)}</strong>
          <small>${escapeHtml(c.goalName || '—')}</small>
        </div>
        <button class="btn-dead ${st.dead ? 'on' : ''}" onclick="toggleState(${c.id}, 'dead', ${!st.dead})">${st.dead ? 'Мёртв' : 'Жив'}</button>
        <button class="btn-win ${st.personalWinDone ? 'on' : ''}" onclick="toggleState(${c.id}, 'personalWinDone', ${!st.personalWinDone})">${st.personalWinDone ? 'Победа' : '—'}</button>
      </div>
    `;
  }).join('');
}

async function toggleState(id, field, value) {
  await postJson(`/api/state/${id}`, { [field]: value });
  pull();
}

function renderChats() {
  const box = document.getElementById('chats');
  if (!box) return;
  const withMsgs = chats.filter(c => c.messages && c.messages.length > 0);
  if (!withMsgs.length) { box.innerHTML = '<div class="chat__empty">Пока пусто.</div>'; return; }
  box.innerHTML = withMsgs.map(c => {
    const log = c.messages.map(m => `<div class="msg msg--${m.from}">${escapeHtml(m.text)}</div>`).join('');
    return `
      <div class="chat-block" data-token="${c.token}">
        <div class="chat-block__head"><strong>${escapeHtml(c.cipher)}</strong> · ${escapeHtml(c.role)}</div>
        <div class="chat__log">${log}</div>
        <div class="chat__input">
          <input placeholder="Ответ…" data-inp="${c.token}" />
          <button data-btn="${c.token}">→</button>
        </div>
      </div>
    `;
  }).join('');

  box.querySelectorAll('button[data-btn]').forEach(btn => {
    btn.onclick = async () => {
      const token = btn.dataset.btn;
      const inp = box.querySelector(`input[data-inp="${token}"]`);
      const text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      await postJson(`/api/chat/${token}/reply`, { text });
      pull();
    };
  });
}

function renderVotes() {
  const el = document.getElementById('votes-list');
  if (!el) return;
  if (!cards.length) { el.innerHTML = '<span style="color:#889">Нет данных.</span>'; return; }
  el.innerHTML = cards.map(c => {
    if ((state.cards[c.id] || {}).dead) return '';
    const vote = votes[c.id];
    let text = 'Не голосовал';
    if (vote === null) text = 'Воздержался';
    else if (vote !== undefined) { const t = cards.find(x => x.id === vote); text = t ? `За ${escapeHtml(t.token || t.cipher)}` : 'Неизвестно'; }
    return `
      <div class="admin__row" style="grid-template-columns: 1fr auto;">
        <div><strong>${escapeHtml(c.token || c.cipher)} · ${escapeHtml(c.role)}</strong><small>Голос: <span style="color:#69f0ae;">${text}</span></small></div>
      </div>
    `;
  }).join('');
}

// Кнопки
document.getElementById('refresh').onclick = pull;
document.getElementById('mode-select').onchange = (e) => postJson('/api/set-mode', { mode: parseInt(e.target.value) }).then(pull);
document.getElementById('next-night').onclick = () => api('/api/next-night', { method: 'POST' }).then(pull);
document.getElementById('toggle-vote').onclick = () => postJson('/api/voting-status', { isVotingOpen: !votingStatus }).then(pull);
document.getElementById('reset').onclick = () => { if (confirm('Сбросить игру?')) api('/api/reset', { method: 'POST' }).then(pull); };
document.getElementById('reset-votes').onclick = () => api('/api/reset-votes', { method: 'POST' }).then(pull);

pull();
setInterval(() => { if (!document.hidden) pull(); }, 5000);