const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const CARDS_FILE = path.join(__dirname, 'public', 'cards.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let state = {}; 
let chat = {}; 
let votes = {}; 
let usedTokens = {}; 
let currentNight = 1;
let currentMode = 10; 
let gameCards = null;
let isVotingOpen = false;

const PROFESSIONS = [
  "Инженер", "Архитектор", "Учитель", "Бухгалтер", 
  "Программист", "Электрик", "Сварщик", "Агроном", 
  "Геолог", "Машинист", "Библиотекарь", "Химик"
];

const CIPHER_LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н", "П", "Р", "С", "Т", "Ф"];

const GOALS = [
  { img: "poet", name: "Поэт", nameF: "Поэтесса", task: "Расскажи историю, которую оценят 3 человека.", quote: "Я говорю — и стекло трещит." },
  { img: "citizen", name: "Порядочный нумер", nameF: "Порядочная нумер", task: "Ни разу не быть выбранным на голосование.", quote: "Чтобы выжить в стеклянном доме — стань стеклом." },
  { img: "lawyer", name: "Юрист", nameF: "Юристка", task: "Оправдай того, на кого все думают.", quote: "Люди пишут правила. Люди ошибаются." },
  { img: "pacifist", name: "Пацифист", nameF: "Пацифистка", task: "Сделай так, чтобы люди не голосовали хотя бы один раз.", quote: "Любовь важнее закона." },
  { img: "propagandist", name: "Агитатор", nameF: "Агитаторша", task: "Сделай так, чтобы за того, кого ты выбрал, проголосовало большинство.", quote: "Толпа — механизм. Найди рычаг." }
];

function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function getCardsWithProfessions() {
  if (gameCards) return gameCards; 

  let allCards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
  let selectedCards = [];
  
  if (currentMode === 10) selectedCards = allCards.filter(c => c.id <= 10); 
  else if (currentMode === 15) selectedCards = allCards.slice(0, 15);
  else selectedCards = allCards.slice(0, 20);

  const shuffledProfs = shuffle([...PROFESSIONS]);
  const shuffledLetters = shuffle([...CIPHER_LETTERS]);
  const shuffledGoals = shuffle([...GOALS]);

  let goalIndex = 0;

  selectedCards.forEach((card, index) => {
    card.alibiProfession = shuffledProfs[index % shuffledProfs.length];
    const letter = shuffledLetters[index % shuffledLetters.length];
    const number = Math.floor(Math.random() * 999) + 1;
    card.randomCipher = `${letter}-${number}`;
    
    if (card.role === "Строитель") {
      const goal = shuffledGoals[goalIndex % shuffledGoals.length];
      goalIndex++;
      card.image = goal.img;
      card.quote = goal.quote;
      card.goalName = goal.name;
      card.goalNameF = goal.nameF;
      card.quest = goal.task;
    } else if (card.role === "Икона сопротивления") {
      card.image = "icon";
      card.quote = "Я — цитата, которую повторят после меня.";
      card.goalName = "«Икона сопротивления»";
      card.goalNameF = "«Икона сопротивления»";
      card.quest = "Умереть на голосовании. Очков за твою смерть не получает никто.";
    }
  });

  const candidates = selectedCards.filter(c => c.role === "Строитель");
  if (candidates.length > 0) {
    const chosenOne = candidates[Math.floor(Math.random() * candidates.length)];
    chosenOne.isAvenger = true;
  }

  gameCards = selectedCards;
  return gameCards;
}

app.get('/api/cards', (req, res) => {
  const token = req.query.t;
  const deviceId = req.query.device;

  if (token && deviceId) {
    if (usedTokens[token] && usedTokens[token] !== deviceId) {
      return res.status(403).json({ error: 'used' });
    }
    usedTokens[token] = deviceId;
  }
  res.json(getCardsWithProfessions());
});

app.get('/api/state', (_, res) => res.json({ cards: state, night: currentNight, mode: currentMode }));
app.post('/api/state/:id', (req, res) => {
  const id = req.params.id;
  state[id] = { ...(state[id] || {}), ...req.body };
  res.json(state[id]);
});

app.get('/api/chat', (_, res) => {
  const summary = getCardsWithProfessions().map(c => ({
    token: c.token, 
    cipher: c.randomCipher || c.cipher, 
    role: c.role, 
    alibiProfession: c.alibiProfession,
    messages: chat[c.token] || []
  }));
  res.json(summary);
});

app.get('/api/chat/:token', (req, res) => res.json(chat[req.params.token] || []));
app.post('/api/chat/:token', (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  const t = req.params.token;
  (chat[t] = chat[t] || []).push({ from: 'player', text, ts: Date.now() });
  res.json({ ok: true });
});
app.post('/api/chat/:token/reply', (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  const t = req.params.token;
  (chat[t] = chat[t] || []).push({ from: 'admin', text, ts: Date.now() });
  res.json({ ok: true });
});

app.get('/api/votes', (_, res) => res.json(votes));
app.post('/api/vote', (req, res) => {
  const { voterId, targetId } = req.body;
  if (voterId) votes[voterId] = targetId;
  res.json({ ok: true, votes });
});
app.post('/api/reset-votes', (_, res) => {
  votes = {};
  res.json({ ok: true });
});

app.get('/api/voting-status', (_, res) => res.json({ isVotingOpen }));
app.post('/api/voting-status', (req, res) => {
  isVotingOpen = req.body.isVotingOpen;
  res.json({ isVotingOpen });
});

app.post('/api/set-mode', (req, res) => {
  currentMode = req.body.mode;
  res.json({ mode: currentMode });
});

app.post('/api/next-night', (_, res) => {
  currentNight++;
  res.json({ night: currentNight });
});

app.post('/api/reset', (_, res) => {
  state = {}; chat = {}; votes = {}; usedTokens = {}; currentNight = 1;
  isVotingOpen = false;
  gameCards = null; 
  res.json({ ok: true });
});

// ВАЖНО: Слушаем 0.0.0.0, чтобы хостинг видел сервер
app.listen(PORT, '0.0.0.0', () => console.log(`▶  Server running on port ${PORT}`));