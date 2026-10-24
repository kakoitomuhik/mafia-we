let cards = [];
let state = {};
let chats = [];

async function pull() {
  [cards, state, chats] = await Promise.all([
    fetch('/api/cards').then(r => r.json()),
    fetch('/api/state').then(r => r.json()),
    fetch('/api/chat').then(r => r.json())
  ]);
  renderPlayers();
  renderChats();
}

function renderPlayers() {
  const list = document.getElementById('list');
  list.innerHTML = cards.map(c => {
    const st = state[c.id] || { dead: false, personalWinDone: false };
    return `
      <div class="admin__row">
        <div>
          <strong>${c.cipher} · ${c.role}</strong>
          <small>${c.alibiProfession} · цель ${c.goalName}</small>
        </div>
        <button class="btn-dead ${st.dead ? 'on' : ''}" onclick="toggleDead(${c.id}, ${!st.dead})">${st.dead ? 'Мёртв' : 'Жив'}</button>
        <button class="btn-win ${st.personalWinDone ? 'on' : ''}" onclick="toggleWin(${c.id}, ${!st.personalWinDone})">${st.personalWinDone ? 'Победа' : '—'}</button>
      </div>
    `;
  }).join('');
}

function renderChats() {
  const box = document.getElementById('chats');
  const withMsgs = chats.filter(c => c.messages.length);
  if (!withMsgs.length) { box.innerHTML = '<div class="chat__empty">Пока никто не спрашивал</div>'; return; }
  box.innerHTML = withMsgs.map(c => {
    const log = c.messages.map(m => `
      <div class="msg msg--${m.from}">
        ${escapeHtml(m.text)}
        <small>${new Date(m.ts).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'})}</small>
      </div>
    `).join('');
    return `
      <div class="chat-block" data-token="${c.token}">
        <div class="chat-block__head">
          <strong>${c.cipher}</strong> · ${c.role}
          <small>${c.alibiProfession}</small>
        </div>
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
      await fetch(`/api/chat/${token}/reply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      pull();
    };
  });
}

async function toggleDead(id, v) {
  await fetch(`/api/state/${id}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ dead: v }) });
  pull();
}
async function toggleWin(id, v) {
  await fetch(`/api/state/${id}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ personalWinDone: v }) });
  pull();
}
async function resetAll() {
  if (!confirm('Сбросить всё?')) return;
  await fetch('/api/reset', { method: 'POST' });
  pull();
}

document.getElementById('reset').onclick = resetAll;
document.querySelectorAll('.tab').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('tab--active'));
    t.classList.add('tab--active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('tab-' + t.dataset.tab).classList.remove('hidden');
  };
});

const escapeHtml = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

pull();
setInterval(pull, 3000);