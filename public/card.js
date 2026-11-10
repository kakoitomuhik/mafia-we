const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const token = new URLSearchParams(location.search).get('t');
const app = document.getElementById('app');

let card = null;
let userGender = localStorage.getItem('gender_' + token);
let roleRevealed = localStorage.getItem('revealed_' + token) === 'true';
let intervalState = null;
let intervalChat = null;
let lastSnapshot = '';

const IMAGES = {
  "true_numer_m": "01a1a425-a8dd-72d6-8da4-465b8e72eba8.jpg",
  "true_numer_f": "01a1a428-a657-74ac-b124-098eebcbfebc (1).jpg",
  "cultist_m": "01a1a44d-a290-7143-91d8-23e925198ecc.jpg",
  "cultist_f": "01a1a44a-9206-7d07-8501-11d84f3c1f48.jpg",
  "order_m": "01a1a460-c164-7efc-b058-e4b9ad86255c.jpg",
  "order_f": "Polish_20261104_052337346.jpg",
  "archivist_m": "01a1a458-e770-74c0-b7c2-5f46367339e6.jpg",
  "archivist_f": "01a1a459-f956-7062-9d07-f9c1cab27a50.jpg",
  "dissident2_m": "01a1a438-9f59-70f0-a68a-e9828fe1f144.jpg",
  "dissident2_f": "Polish_20261104_045710421.jpg"
};

if (!token) {
  app.innerHTML = '<p style="color:#889; padding:20px; text-align:center; font-size:18px;">Токен не найден.</p>';
} else {
  start().catch(err => {
    console.error('start failed:', err);
    app.innerHTML = '<p style="color:#ff5252; padding:20px; text-align:center; font-size:18px;">Ошибка загрузки данных.</p>';
  });
}

async function api(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

const postJson = (url, data) => api(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {})
});

async function start() {
  card = await api(`/api/cards?t=${encodeURIComponent(token)}`);
  if (!card || !card.role) {
    app.innerHTML = '<p style="color:#889; padding:20px; text-align:center; font-size:18px;">Карта не найдена.</p>';
    return;
  }

  if (!userGender) renderGenderSelect();
  else if (!roleRevealed) renderRevealScreen();
  else {
    await renderCard();
    startIntervals();
  }
}

function renderGenderSelect() {
  app.innerHTML = `
    <div class="card" style="text-align:center; background-image:url('bg-alive.v.png');">
      <div class="card-inner">
        <div class="card__cipher">Идентификация нумера</div>
        <h2 style="margin:20px 0; color:#a8c4ff;">Укажи свой пол</h2>
        <div style="display:flex; gap:15px; justify-content:center;">
          <button onclick="setGender('male')" class="btn-gender">Мужчина</button>
          <button onclick="setGender('female')" class="btn-gender">Женщина</button>
        </div>
        <div style="text-align:right; font-size:10px; color:#445; margin-top:20px; letter-spacing:1px;">Е. Замятин · «Мы»</div>
      </div>
    </div>
  `;
}

function renderRevealScreen() {
  app.innerHTML = `
    <div class="card" style="text-align:center; background-image:url('bg-alive.v.png');">
      <div class="card-inner">
        <div class="card__cipher">Нумер ${escapeHtml(card.randomCipher || card.cipher || '—')}</div>
        <h2 style="margin:30px 0 10px 0; color:#a8c4ff;">Твоя роль готова</h2>
        <p style="color:#9aa8c0; margin-bottom:30px; font-size:15px;">Убедись, что никто не смотрит на твой экран, и нажми кнопку.</p>
        <button onclick="revealRole()" class="btn-gender" style="width:100%;">Показать мою роль</button>
        <div style="text-align:right; font-size:10px; color:#445; margin-top:20px; letter-spacing:1px;">Е. Замятин · «Мы»</div>
      </div>
    </div>
  `;
}

function revealRole() {
  roleRevealed = true;
  localStorage.setItem('revealed_' + token, 'true');
  start().catch(err => console.error(err));
}

async function setGender(gender) {
  userGender = gender;
  localStorage.setItem('gender_' + token, gender);
  try { await postJson(`/api/state/${card.id}`, { online: true }); } catch (e) {}
  await start();
}

async function resetGender() {
  try { if (card && card.id) await postJson(`/api/state/${card.id}`, { online: false }); } catch (e) {}
  localStorage.removeItem('gender_' + token);
  localStorage.removeItem('revealed_' + token);
  userGender = null;
  roleRevealed = false;
  renderGenderSelect();
}

function startIntervals() {
  if (intervalState) clearInterval(intervalState);
  if (intervalChat) clearInterval(intervalChat);
  intervalState = setInterval(pollState, 10000);
  intervalChat = setInterval(loadChat, 10000);
}

async function pollState() {
  try {
    const [stateData, voteStatus] = await Promise.all([ api('/api/state'), api('/api/voting-status') ]);
    const st = (stateData.cards && stateData.cards[card.id]) || {};
    const deadCount = Object.values(stateData.cards || {}).filter(s => s && s.dead).length;
    const snapshot = JSON.stringify({ dead: !!st.dead, night: stateData.night, voting: !!voteStatus.isVotingOpen, massacre: !!stateData.isMassacre, deadCount });
    if (snapshot !== lastSnapshot) { lastSnapshot = snapshot; await renderCard(); }
  } catch (e) { console.warn('pollState failed:', e); }
}

async function renderCard() {
  const msgEl = document.getElementById('msg');
  const draft = msgEl ? msgEl.value : '';
  const hadFocus = document.activeElement === msgEl;

  const [stateData, voteStatus] = await Promise.all([ api('/api/state'), api('/api/voting-status') ]);
  const allStates = stateData.cards || {};
  const st = allStates[card.id] || { dead: false, personalWinDone: false };
  const isFemale = userGender === 'female';
  const bgImage = st.dead ? 'bg-dead.v.png' : 'bg-alive.v.png';
  document.documentElement.style.setProperty('--bg-url', `url('${bgImage}')`);

  let sideText = 'ИНТЕГРАЛ', sideClass = 'side--integral';
  if (card.role === 'Диссидент' || card.role === 'Лидер сопротивления') { sideText = 'СОПРОТИВЛЕНИЕ'; sideClass = 'side--resistance'; }

  let displayTask = card.task;
  let displayLegend = card.legend;
  if (typeof card.task === 'object' && card.task !== null) displayTask = isFemale ? card.task.f : card.task.m;
  if (typeof card.legend === 'object' && card.legend !== null) displayLegend = isFemale ? card.legend.f : card.legend.m;

  let displayRole = card.role;
  let displayAlibi = card.alibiProfession;
  let displayGoal = card.goalName;

  if (isFemale) {
    if (card.role === 'Строитель') displayRole = 'Строительница';
    if (card.role === 'Диссидент') displayRole = 'Диссидентка';
    if (card.role === 'Хранитель') displayRole = 'Хранительница';
    if (card.alibiProfession === 'Учитель') displayAlibi = 'Учительница';
    if (card.alibiProfession === 'Сварщик') displayAlibi = 'Сварщица';
    if (card.alibiProfession === 'Программист') displayAlibi = 'Программистка';
    if (card.goalNameF) displayGoal = card.goalNameF;
  }

  if (card.role === 'Икона сопротивления') displayRole = isFemale ? 'Строительница' : 'Строитель';

  const wordDeadFinal = isFemale ? 'дезинтегрирована' : 'дезинтегрирован';
  const wordProfession = isFemale ? 'Специальность' : 'Профессия';

  let goalHtml = '';
  if (card.role === 'Строитель' || card.role === 'Икона сопротивления') {
    goalHtml = `<div class="card__goal"><h3>Цель ${escapeHtml(displayGoal || '')}</h3><p>${escapeHtml(card.quest || 'Выполни свой квест')}</p></div>`;
  } else {
    goalHtml = `<div class="card__goal"><h3>Цель ${escapeHtml(displayGoal || '')}</h3><p>${escapeHtml(displayTask || '')}</p></div>`;
  }

  let massacreCounter = '';
  if (stateData.mode >= 15) {
    if (stateData.night < 3) massacreCounter = `До резни: ${3 - stateData.night} ноч.`;
    else if (stateData.night >= 3 && !stateData.isMassacre) massacreCounter = 'Резня: не состоялась';
    else if (stateData.isMassacre) massacreCounter = '🩸 РЕЗНЯ АКТИВНА';
  }

  app.innerHTML = `
    <div class="card ${st.dead ? 'card--dead' : ''}">
      <div class="card-inner">
        ${!st.dead ? `
          <div class="card__cipher">Нумер ${escapeHtml(card.randomCipher || card.cipher || '—')}</div>
          <div class="card__portrait"><img id="portrait-img" src="" alt="Портрет" style="width:100%; height:100%; object-fit:cover; border-radius:16px;"></div>
          <div class="card__role">${escapeHtml(displayRole || '')}</div>
          <div class="card__side ${sideClass}">${sideText}</div>

          ${stateData.isMassacre && (card.role === 'Диссидент' || card.role === 'Лидер сопротивления') ? `<div style="margin-top:10px; padding:10px; background:rgba(255,0,0,0.2); border:2px solid #ff0000; border-radius:8px; text-align:center; color:#ff5252; font-weight:bold; font-size:14px; animation:pulse 1s infinite;">🩸 РЕЗНЯ: Выберите ДВУХ жертв.</div>` : ''}

          <div class="card__alibi"><strong>${wordProfession}:</strong> ${escapeHtml(displayAlibi || '—')}</div>
          ${goalHtml}
          <div class="card__legend">${escapeHtml(displayLegend || '')}</div>
          <div class="card__quote">«${escapeHtml(card.quote || '')}»</div>

          <div class="card__vote" id="vote-container" style="display:none; margin-top:15px; padding:15px; background:rgba(30,50,80,0.95); border:1px solid #4a7fff; border-radius:12px;">
            <h3 style="color:#7aa7ff; margin-bottom:10px; font-size:16px; text-align:center;">Голосование открыто</h3>
            <div id="vote-targets" style="display:flex; flex-direction:column; gap:8px;"></div>
            <button onclick="castVote(null)" style="margin-top:10px; width:100%; padding:10px; background:rgba(120,170,255,0.1); border:1px solid #4a7fff; border-radius:8px; color:#fff; cursor:pointer; font-size:14px;">Воздержаться</button>
          </div>
        ` : `
          <div class="card__portrait dead-portrait"><img id="portrait-img" class="main-img" src="" alt="Портрет" style="width:100%; height:100%; object-fit:cover; border-radius:16px;"></div>
          <div class="banner-dead"><strong>Ты ${wordDeadFinal}.</strong><br><br>Ты больше не можешь говорить или писать.<br>Но твой голос в Стеклянном зале всё ещё слышен — <strong>ты можешь голосовать.</strong></div>
        `}

        <div class="chat">
          <h4>Связаться с Благодетелем</h4>
          <div class="chat__log" id="log"><div class="chat__empty">Загрузка...</div></div>
          <div class="chat__input"><input id="msg" placeholder="Вопрос…" /><button id="send">Отправить</button></div>
        </div>

        <div style="margin-top:15px; text-align:center;"><button onclick="resetGender()" style="background:none; border:none; color:#55617a; font-size:12px; cursor:pointer; text-decoration:underline;">Сменить пол</button></div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <div style="font-size:11px; color:#ffd47a; font-weight:bold;">${massacreCounter}</div>
          <div style="font-size:10px; color:#445; letter-spacing:1px;">Е. Замятин · «Мы»</div>
        </div>
      </div>
    </div>
  `;

  const newMsgEl = document.getElementById('msg');
  if (newMsgEl) { if (draft) newMsgEl.value = draft; if (hadFocus) newMsgEl.focus(); }

  await loadPortrait(isFemale, st.dead);
  if (voteStatus.isVotingOpen && !st.dead) await renderVoting();

  const btn = document.getElementById('send');
  if (btn) {
    btn.onclick = async () => {
      const inp = document.getElementById('msg');
      const text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      try { await postJson(`/api/chat/${encodeURIComponent(token)}`, { text }); await loadChat(); }
      catch (e) { console.error('send failed:', e); alert('Не удалось отправить сообщение'); }
    };
  }
  await loadChat();
}

async function loadPortrait(isFemale, isDead) {
  const imgEl = document.getElementById('portrait-img');
  if (!imgEl) return;
  const genderSuffix = isFemale ? '_f' : '_m';
  const base = card.image || card.imageKey || '';
  const key = base + genderSuffix;

  if (card.role === 'Хранитель') {
    const txt = isFemale ? 'hranitel_f.txt' : 'hranitel_m.txt';
    try { const res = await fetch(`/${txt}`); if (!res.ok) throw new Error('not found'); imgEl.src = await res.text(); }
    catch { imgEl.src = `/${IMAGES[key] || `${base}${genderSuffix}.png`}`; }
  } else {
    imgEl.src = `/${IMAGES[key] || `${base}${genderSuffix}.png`}`;
  }
}

async function renderVoting() {
  const container = document.getElementById('vote-container');
  const targets = document.getElementById('vote-targets');
  if (!container || !targets) return;
  container.style.display = 'block';
  try {
    const [players, currentVotes, stateData] = await Promise.all([ api('/api/players'), api('/api/votes'), api('/api/state') ]);
    const allStates = stateData.cards || {};
    const live = players.filter(p => p.id !== card.id && !(allStates[p.id] || {}).dead);
    const myVote = currentVotes[card.id];
    targets.innerHTML = live.map(p => {
      const isSelected = myVote === p.id;
      return `<button onclick="castVote(${Number(p.id)})" style="padding:10px; background:${isSelected ? 'rgba(80,255,160,0.5)' : 'rgba(120,170,255,0.2)'}; border:1px solid ${isSelected ? '#69f0ae' : '#7aa7ff'}; border-radius:8px; color:#fff; cursor:pointer; font-size:14px; text-align:left;">${escapeHtml(p.randomCipher || p.cipher || '—')} ${isSelected ? '✓' : ''}</button>`;
    }).join('');
  } catch (e) { console.warn('renderVoting failed:', e); container.style.display = 'none'; }
}

async function castVote(targetId) {
  if (!confirm(targetId ? 'Подтвердить ваш голос?' : 'Вы уверены, что хотите воздержаться?')) return;
  try { await postJson('/api/vote', { voterId: card.id, targetId: targetId === null ? null : Number(targetId) }); await renderCard(); }
  catch (e) { console.error('castVote failed:', e); alert('Не удалось проголосовать: ' + e.message); }
}

async function loadChat() {
  const log = document.getElementById('log');
  if (!log) return;
  try {
    const msgs = await api(`/api/chat/${encodeURIComponent(token)}`);
    if (!Array.isArray(msgs)) return;
    const wasAtBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
    if (msgs.length > 0) log.innerHTML = msgs.map(m => `<div class="msg msg--${escapeHtml(m.from)}">${escapeHtml(m.text)}</div>`).join('');
    else log.innerHTML = '<div class="chat__empty">Пока пусто</div>';
    if (wasAtBottom) log.scrollTop = log.scrollHeight;
  } catch (e) { console.warn('loadChat failed:', e); }
}