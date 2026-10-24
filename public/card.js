const token = new URLSearchParams(location.search).get('t');

let card = null;
let state = { dead: false, personalWinDone: false };

async function load() {
  if (!token) {
    document.getElementById('app').innerHTML = '<p style="padding:20px;color:#889">Токен не найден. Отсканируй QR.</p>';
    return;
  }
  const cards = await (await fetch('/api/cards')).json();
  card = cards.find(c => c.token === token);
  if (!card) {
    document.getElementById('app').innerHTML = '<p style="padding:20px;color:#889">Карта не найдена.</p>';
    return;
  }
  await pullState();
  render();
  setInterval(pullState, 2000);
  setInterval(renderChat, 2000);
  bindChat();
}

async function pullState() {
  const all = await (await fetch('/api/state')).json();
  state = all[card.id] || { dead: false, personalWinDone: false };
  render();
}

function render() {
  if (!card) return;
  const isDead = state.dead;
  const win = state.personalWinDone;
  document.getElementById('app').innerHTML = `
    <div class="card ${isDead ? 'card--dead' : ''}">
      <div class="card__cipher">Нумер ${card.cipher}</div>
      <div class="card__portrait">Портрет</div>
      <div class="card__role">${card.role}</div>
      <div class="card__side">${card.side}</div>
      <div class="card__alibi"><strong>Прикрытие:</strong> ${card.alibiProfession}</div>
      <div class="card__goal">
        <h3>Цель ${card.goalName}</h3>
        <p>${card.task}</p>
      </div>
      <div class="card__legend">${card.legend}</div>
      <div class="card__quote">«${card.quote}»</div>
      ${isDead ? '<div class="banner-dead"><strong>Ты выведен из игры.</strong><br>Не говоришь, не пишешь. Но голосовать можешь.</div>' : ''}
      ${win ? '<div class="banner-win">Личная цель выполнена.</div>' : ''}
      <div class="chat">
        <h4>Спросить Благодетеля</h4>
        <div class="chat__log" id="log"></div>
        <div class="chat__input">
          <input id="msg" placeholder="Вопрос по правилам…" />
          <button id="send">Отправить</button>
        </div>
      </div>
      <div class="card__footnote">ИНТЕГРАЛ</div>
    </div>
  `;
  bindChat();
  renderChat();
}

async function renderChat() {
  const log = document.getElementById('log');
  if (!log) return;
  const msgs = await (await fetch(`/api/chat/${token}`)).json();
  if (!msgs.length) { log.innerHTML = '<div class="chat__empty">Пока пусто</div>'; return; }
  log.innerHTML = msgs.map(m => `
    <div class="msg msg--${m.from}">
      ${escapeHtml(m.text)}
      <small>${new Date(m.ts).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'})}</small>
    </div>
  `).join('');
  log.scrollTop = log.scrollHeight;
}

function bindChat() {
  const btn = document.getElementById('send');
  const inp = document.getElementById('msg');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  const send = async () => {
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    await fetch(`/api/chat/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    renderChat();
  };
  btn.onclick = send;
  inp.onkeydown = e => { if (e.key === 'Enter') send(); };
}

const escapeHtml = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

load();