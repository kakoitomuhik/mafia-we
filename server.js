const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(__dirname + '/public'));

// --- КАРТЫ С ПОЛНЫМИ ТЕКСТАМИ ---
const CARDS = [
  { 
    id: 1, token: "7f3a9c21", role: "Строитель", image: "poet", 
    goalName: "Поэт", goalNameF: "Поэтесса", 
    quote: "Я говорю — и стекло трещит.", 
    quest: "Расскажи историю, которую оценят 3 человека.", 
    legend: { m: "Ты — поэт. Твои слова живут дольше тебя.", f: "Ты — поэтесса. Твои слова живут дольше тебя." } 
  },
  { 
    id: 2, token: "2d8e4b17", role: "Строитель", image: "propagandist", 
    goalName: "Агитатор", goalNameF: "Агитаторша", 
    quote: "Толпа — механизм. Найди рычаг.", 
    quest: "Сделай так, чтобы за того, кого ты выбрал, проголосовало большинство.", 
    legend: { m: "Ты — агитатор. Ты умеешь управлять толпой.", f: "Ты — агитаторша. Ты умеешь управлять толпой." } 
  },
  { 
    id: 3, token: "9a1c6f52", role: "Строитель", image: "lawyer", 
    goalName: "Юрист", goalNameF: "Юристка", 
    quote: "Люди пишут правила. Люди ошибаются.", 
    quest: "Оправдай того, на кого все думают.", 
    legend: { m: "Ты — юрист. Ты знаешь правила и как их обходить.", f: "Ты — юристка. Ты знаешь правила и как их обходить." } 
  },
  { 
    id: 4, token: "4e7b2d98", role: "Строитель", image: "citizen", 
    goalName: "Порядочный нумер", goalNameF: "Порядочная нумер", 
    quote: "Чтобы выжить в стеклянном доме — стань стеклом.", 
    quest: "Ни разу не быть выбранным на голосование.", 
    legend: { m: "Ты — порядочный гражданин. Ты просто хочешь жить.", f: "Ты — порядочная гражданка. Ты просто хочешь жить." } 
  },
  { 
    id: 5, token: "6c3f8a41", role: "Строитель", image: "pacifist", 
    goalName: "Пацифист", goalNameF: "Пацифистка", 
    quote: "Любовь важнее закона.", 
    quest: "Сделай так, чтобы люди не голосовали хотя бы один раз.", 
    legend: { m: "Ты — пацифист. Ты против насилия.", f: "Ты — пацифистка. Ты против насилия." } 
  },
  { 
    id: 6, token: "1b5d9e73", role: "Икона сопротивления", image: "icon",
    goalName: "«Икона сопротивления»", goalNameF: "«Икона сопротивления»", 
    quote: "Я — цитата, которую повторят после меня.",
    quest: "Умереть на голосовании. Очков за твою смерть не получает никто.",
    legend: { m: "Тебе всё равно, за кого умирать. Ты хочешь стать символом.", f: "Тебе всё равно, за кого умирать. Ты хочешь стать символом." } 
  },
  { 
    id: 7, token: "8a2e4f16", role: "Диссидент", image: "dissident2",
    goalName: "«Неуловимый»", goalNameF: "«Неуловимая»", 
    quote: "Я просто ускоряю процесс.",
    quest: "Продержись до конца игры, не попав под казнь.",
    legend: { m: "Каждую ночь ты предлагаешь Лидеру сопротивления, кого убить.", f: "Каждую ночь ты предлагаешь Лидеру сопротивления, кого убить." } 
  },
  { 
    id: 8, token: "3f7c1b85", role: "Лидер сопротивления", image: "leader",
    goalName: "«Устранение»", goalNameF: "«Устранение»", 
    quote: "Они думают, что ловят меня.",
    quest: "Убей Хранителя — ночью или голосованием.",
    legend: { m: "Каждую ночь делаешь выбор, кого убить (не обязательно из предложенных).", f: "Каждую ночь делаешь выбор, кого убить (не обязательно из предложенных)." } 
  },
  { 
    id: 9, token: "5e9a2d64", role: "Врач", image: "doctor",
    goalName: "«Хранитель Иконы»", goalNameF: "«Хранительница Иконы»", 
    quote: "Интеграл — это люди.",
    quest: "Икона сопротивления должна выжить до конца игры.",
    legend: { m: "Каждую ночь ты выбираешь одного игрока и спасаешь его от смерти.", f: "Каждую ночь ты выбираешь одного игрока и спасаешь её от смерти." } 
  },
  { 
    id: 10, token: "2c8f6e39", role: "Хранитель", image: "guardian",
    goalName: "«Смерть лидеру»", goalNameF: "«Смерть лидеру»", 
    quote: "Я нахожу сбои.",
    quest: "Добейся казни Лидера сопротивления на дневном голосовании.",
    legend: { m: "Каждую ночь ты проверяешь нумер. Если он диссидент — Благодетель кивает, если нет — машет головой.", f: "Каждую ночь ты проверяешь нумер. Если она диссидентка — Благодетель кивает, если нет — машет головой." } 
  }
];

let state = {};
let chat = {};
let votes = {};
let currentNight = 1;
let isVotingOpen = false;

app.get('/api/cards', (req, res) => {
  const t = req.query.t;
  if (t) {
    const card = CARDS.find(c => c.token === t);
    if (card) {
      card.alibiProfession = "Гражданин"; // Если хотите случайную профессию, скажите, вернем генератор
      card.randomCipher = "А-" + Math.floor(Math.random() * 999);
      return res.json(card);
    }
    return res.status(404).json({ error: 'not found' });
  }
  res.json(CARDS);
});

app.get('/api/state', (req, res) => res.json({ cards: state, night: currentNight, mode: 10, isMassacre: false }));
app.post('/api/state/:id', (req, res) => { state[req.params.id] = { ...(state[req.params.id] || {}), ...req.body }; res.json(state[req.params.id]); });

app.get('/api/chat', (req, res) => res.json(CARDS.map(c => ({ token: c.token, cipher: c.randomCipher || c.token, role: c.role, alibiProfession: "Гражданин", messages: chat[c.token] || [] }))));
app.get('/api/chat/:token', (req, res) => res.json(chat[req.params.token] || []));
app.post('/api/chat/:token', (req, res) => { const t = req.params.token; (chat[t] = chat[t] || []).push({ from: 'player', text: req.body.text, ts: Date.now() }); res.json({ ok: true }); });
app.post('/api/chat/:token/reply', (req, res) => { const t = req.params.token; (chat[t] = chat[t] || []).push({ from: 'admin', text: req.body.text, ts: Date.now() }); res.json({ ok: true }); });

app.get('/api/votes', (req, res) => res.json(votes));
app.post('/api/vote', (req, res) => { if (req.body.voterId) votes[req.body.voterId] = req.body.targetId; res.json({ ok: true, votes }); });
app.post('/api/reset-votes', (req, res) => { votes = {}; res.json({ ok: true }); });
app.get('/api/voting-status', (req, res) => res.json({ isVotingOpen }));
app.post('/api/voting-status', (req, res) => { isVotingOpen = Boolean(req.body.isVotingOpen); res.json({ isVotingOpen }); });

app.post('/api/set-mode', (req, res) => res.json({ mode: 10 }));
app.post('/api/next-night', (req, res) => { currentNight++; res.json({ night: currentNight, isMassacre: false }); });
app.post('/api/reset', (req, res) => { state = {}; chat = {}; votes = {}; currentNight = 1; isVotingOpen = false; res.json({ ok: true }); });

app.listen(PORT, () => console.log('Server running on port ' + PORT));const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(__dirname + '/public'));

// --- КАРТЫ ЗАШИТЫ ПРЯМО В КОД ---
const CARDS = [
  { id: 1, token: "7f3a9c21", role: "Строитель", image: "poet", goalName: "Поэт", quote: "Я говорю — и стекло трещит.", quest: "Расскажи историю, которую оценят 3 человека." },
  { id: 2, token: "2d8e4b17", role: "Строитель", image: "propagandist", goalName: "Агитатор", quote: "Толпа — механизм. Найди рычаг.", quest: "Сделай так, чтобы за того, кого ты выбрал, проголосовало большинство." },
  { id: 3, token: "9a1c6f52", role: "Строитель", image: "lawyer", goalName: "Юрист", quote: "Люди пишут правила. Люди ошибаются.", quest: "Оправдай того, на кого все думают." },
  { id: 4, token: "4e7b2d98", role: "Строитель", image: "citizen", goalName: "Порядочный нумер", quote: "Чтобы выжить в стеклянном доме — стань стеклом.", quest: "Ни разу не быть выбранным на голосование." },
  { id: 5, token: "6c3f8a41", role: "Строитель", image: "pacifist", goalName: "Пацифист", quote: "Любовь важнее закона.", quest: "Сделай так, чтобы люди не голосовали хотя бы один раз." },
  { id: 6, token: "1b5d9e73", role: "Икона сопротивления", image: "icon", goalName: "«Икона сопротивления»", quote: "Я — цитата, которую повторят после меня.", quest: "Умереть на голосовании." },
  { id: 7, token: "8a2e4f16", role: "Диссидент", image: "dissident2", goalName: "«Неуловимый»", quote: "Я просто ускоряю процесс.", quest: "Продержись до конца игры, не попав под казнь." },
  { id: 8, token: "3f7c1b85", role: "Лидер сопротивления", image: "leader", goalName: "«Устранение»", quote: "Они думают, что ловят меня.", quest: "Убей Хранителя." },
  { id: 9, token: "5e9a2d64", role: "Врач", image: "doctor", goalName: "«Хранитель Иконы»", quote: "Интеграл — это люди.", quest: "Икона должна выжить." },
  { id: 10, token: "2c8f6e39", role: "Хранитель", image: "guardian", goalName: "«Смерть лидеру»", quote: "Я нахожу сбои.", quest: "Добейся казни Лидера." }
];

let state = {};
let chat = {};
let votes = {};
let currentNight = 1;
let isVotingOpen = false;

app.get('/api/cards', (req, res) => {
  const t = req.query.t;
  if (t) {
    const card = CARDS.find(c => c.token === t);
    if (card) {
      // Добавляем поля, которых не хватает для красоты
      card.alibiProfession = "Гражданин";
      card.randomCipher = "А-" + Math.floor(Math.random() * 999);
      return res.json(card);
    }
    return res.status(404).json({ error: 'not found' });
  }
  res.json(CARDS);
});

app.get('/api/state', (req, res) => res.json({ cards: state, night: currentNight, mode: 10, isMassacre: false }));
app.post('/api/state/:id', (req, res) => { state[req.params.id] = { ...(state[req.params.id] || {}), ...req.body }; res.json(state[req.params.id]); });

app.get('/api/chat', (req, res) => res.json(CARDS.map(c => ({ token: c.token, cipher: c.randomCipher || c.token, role: c.role, alibiProfession: "Гражданин", messages: chat[c.token] || [] }))));
app.get('/api/chat/:token', (req, res) => res.json(chat[req.params.token] || []));
app.post('/api/chat/:token', (req, res) => { const t = req.params.token; (chat[t] = chat[t] || []).push({ from: 'player', text: req.body.text, ts: Date.now() }); res.json({ ok: true }); });
app.post('/api/chat/:token/reply', (req, res) => { const t = req.params.token; (chat[t] = chat[t] || []).push({ from: 'admin', text: req.body.text, ts: Date.now() }); res.json({ ok: true }); });

app.get('/api/votes', (req, res) => res.json(votes));
app.post('/api/vote', (req, res) => { if (req.body.voterId) votes[req.body.voterId] = req.body.targetId; res.json({ ok: true, votes }); });
app.post('/api/reset-votes', (req, res) => { votes = {}; res.json({ ok: true }); });
app.get('/api/voting-status', (req, res) => res.json({ isVotingOpen }));
app.post('/api/voting-status', (req, res) => { isVotingOpen = Boolean(req.body.isVotingOpen); res.json({ isVotingOpen }); });

app.post('/api/set-mode', (req, res) => res.json({ mode: 10 }));
app.post('/api/next-night', (req, res) => { currentNight++; res.json({ night: currentNight, isMassacre: false }); });
app.post('/api/reset', (req, res) => { state = {}; chat = {}; votes = {}; currentNight = 1; isVotingOpen = false; res.json({ ok: true }); });

app.listen(PORT, () => console.log('Server running on port ' + PORT));