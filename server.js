const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Ищем cards.json в нескольких местах, чтобы точно найти
let CARDS_FILE = path.join(__dirname, 'data', 'cards.json');
if (!fs.existsSync(CARDS_FILE)) {
  CARDS_FILE = path.join(__dirname, 'cards.json'); // если лежит в корне
}
if (!fs.existsSync(CARDS_FILE)) {
  CARDS_FILE = path.join(__dirname, 'public', 'cards.json'); // если забыли перенести
}

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
let isMassacre = false;

const PROFESSIONS = [
  "Инженер", "Архитектор", "Учитель", "Бухгалтер",
  "Программист", "Электрик", "Сварщик", "Агроном",
  "Геолог", "Машинист", "Библиотекарь", "Химик"
];

const CIPHER_LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н", "П", "Р", "С", "Т", "Ф"];

const GOALS = {
  1: { img: "poet", name: "Поэт", nameF: "Поэтесса", task: "Расскажи историю, которую оценят 3 человека.", quote: "Я говорю — и стекло трещит." },
  2: { img: "citizen", name: "Порядочный нумер", nameF: "Порядочная нумер", task: "Ни разу не быть выбранным на голосование.", quote: "Чтобы выжить в стеклянном доме — стань стеклом." },
  3: { img: "lawyer", name: "Юрист", nameF: "Юристка", task: "Оправдай того, на кого все думают.", quote: "Люди пишут правила. Люди ошибаются." },
  4: { img: "pacifist", name: "Пацифист", nameF: "Пацифистка", task: "Сделай так, чтобы люди не голосовали хотя бы один раз.", quote: "Любовь важнее закона." },
  5: { img: "propagandist", name: "Агитатор", nameF: "Агитаторша", task: "Сделай так, чтобы за того, кого ты выбрал, проголосовало большинство.", quote: "Толпа — механизм. Найди рычаг." },
  11: { img: "true_numer", name: "Истинный нумер", nameF: "Истинная нумер", task: "Ты должен проголосовать против того, кто тебе симпатичен. Объясни это логически.", quote: "Я помню, что ты мне нравился. Но Система права: ты — ошибка." },
  12: { img: "cultist", name: "Культист Интеграла", nameF: "Культистка Интеграла", task: "Добейся, чтобы в первый же день казнили любого нумера. Поддержи это решение публично.", quote: "Смерть — это не конец. Это оптимизация. Я приношу её во имя Интеграла." },
  13: { img: "order", name: "Порядок", nameF: "Порядок", task: "Сделай минимум 2 замечания тем, кто перебивает других во время обсуждения.", quote: "Хаос начинается с перебивания. Я не позволю Интегралу пасть из-за вашей неэффективности." },
  14: { img: "archivist", name: "Архивариус", nameF: "Архивариус", task: "Узнай и запомни три факта о других игроках. Назови их ведущему в конце игры.", quote: "Я собираю то, что Система пытается стереть. Ваши страхи — это единственное, что осталось настоящим." }
};

function shuffle(array) {
  const arr = [...array];
  let i = arr.length, j;
  while (i !== 0) {
    j = Math.floor(Math.random() * i);
    i--;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function loadCardsFromDisk() {
  try {
    if (!fs.existsSync(CARDS_FILE)) {
      console.error('Файл cards.json НЕ НАЙДЕН по пути:', CARDS_FILE);
      return []; // Возвращаем пустой массив, чтобы сервер НЕ УПАЛ
    }
    const raw = fs.readFileSync(CARDS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error('cards.json должен содержать массив');
      return [];
    }
    return parsed;
  } catch (e) {
    console.error('Не удалось загрузить cards.json:', e.message);
    return []; // Возвращаем пустой массив, чтобы сервер НЕ УПАЛ
  }
}

function getCardsWithProfessions() {
  if (gameCards) return gameCards;
  const allCards = loadCardsFromDisk();
  if (!allCards.length) return [];

  const limit = currentMode;
  const selectedCards = allCards.slice(0, limit);

  const shuffledProfs = shuffle(PROFESSIONS);
  const shuffledLetters = shuffle(CIPHER_LETTERS);

  selectedCards.forEach((card, index) => {
    card.alibiProfession = shuffledProfs[index % shuffledProfs.length];
    const letter = shuffledLetters[index % shuffledLetters.length];
    const number = Math.floor(Math.random() * 999) + 1;
    card.randomCipher = `${letter}-${number}`;

    if (card.role === "Строитель" && GOALS[card.id]) {
      const goal = GOALS[card.id];
      card.imageKey = goal.img;
      card.image = goal.img;
      card.quote = goal.quote;
      card.goalName = goal.name;
      card.goalNameF = goal.nameF;
      card.quest = goal.task;
    } else if (card.role === "Икона сопротивления") {
      card.imageKey = "icon";
      card.image = "icon";
      card.quote = "Я — цитата, которую повторят после меня.";
      card.goalName = "«Икона сопротивления»";
      card.goalNameF = "«Икона сопротивления»";
      card.quest = "Умереть на голосовании. Очков за твою смерть не получает никто.";
    } else if (card.role === "Диссидент") {
      card.imageKey = "dissident2";
      card.image = "dissident2";
    } else if (card.role === "Лидер сопротивления") {
      card.imageKey = "leader";
      card.image = "leader";
    } else if (card.role === "Врач") {
      card.imageKey = "doctor";
      card.image = "doctor";
    } else if (card.role === "Хранитель") {
      card.imageKey = "guardian";
      card.image = "guardian";
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

// --- API ---

app.get('/api/cards', (req, res) => {
  const all = getCardsWithProfessions();
  const t = req.query.t;
  const device = req.query.device;

  if (t) {
    if (device) {
      if (usedTokens[t] && usedTokens[t] !== device) {
        return res.status(403).json({ error: 'used' });
      }
      usedTokens[t] = device;
    }
    const one = all.find(c => c.token === t);
    return one ? res.json(one) : res.status(404).json({ error: 'card not found' });
  }
  res.json(all);
});

app.get('/api/players', (req, res) => {
  const all = getCardsWithProfessions();
  res.json(all.map(c => ({ id: c.id, cipher: c.cipher, randomCipher: c.randomCipher })));
});

app.get('/api/state', (req, res) => {
  res.json({ cards: state, night: currentNight, mode: currentMode, isMassacre });
});

app.post('/api/state/:id', (req, res) => {
  const id = req.params.id;
  if (id === '__proto__' || id === 'constructor' || id === 'prototype') return res.status(400).json({error: 'invalid id'});
  state[id] = { ...(state[id] || {}), ...req.body };
  res.json(state[id]);
});

app.get('/api/chat', (req, res) => {
  res.json(getCardsWithProfessions().map(c => ({
    token: c.token, cipher: c.randomCipher || c.cipher, randomCipher: c.randomCipher,
    role: c.role, alibiProfession: c.alibiProfession, messages: chat[c.token] || []
  })));
});

app.get('/api/chat/:token', (req, res) => res.json(chat[req.params.token] || []));

app.post('/api/chat/:token', (req, res) => {
  const text = (req.body && req.body.text ? String(req.body.text) : '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  const t = req.params.token;
  (chat[t] = chat[t] || []).push({ from: 'player', text, ts: Date.now() });
  res.json({ ok: true });
});

app.post('/api/chat/:token/reply', (req, res) => {
  const text = (req.body && req.body.text ? String(req.body.text) : '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  const t = req.params.token;
  (chat[t] = chat[t] || []).push({ from: 'admin', text, ts: Date.now() });
  res.json({ ok: true });
});

app.get('/api/votes', (req, res) => res.json(votes));

app.post('/api/vote', (req, res) => {
  const { voterId, targetId } = req.body || {};
  if (!voterId || targetId === undefined) return res.status(400).json({ error: 'required' });
  votes[voterId] = targetId === null ? null : Number(targetId);
  res.json({ ok: true, votes });
});

app.post('/api/reset-votes', (req, res) => { votes = {}; res.json({ ok: true }); });
app.get('/api/voting-status', (req, res) => res.json({ isVotingOpen }));
app.post('/api/voting-status', (req, res) => { isVotingOpen = Boolean(req.body && req.body.isVotingOpen); res.json({ isVotingOpen }); });

app.post('/api/set-mode', (req, res) => {
  const mode = Number(req.body && req.body.mode);
  if (![10, 15, 20].includes(mode)) return res.status(400).json({ error: 'invalid mode' });
  currentMode = mode; gameCards = null; usedTokens = {};
  res.json({ mode: currentMode });
});

app.post('/api/next-night', (req, res) => {
  currentNight++;
  const anyDead = Object.values(state).some(s => s && s.dead);
  isMassacre = currentNight === 3 && !anyDead;
  res.json({ night: currentNight, isMassacre });
});

app.post('/api/reset', (req, res) => {
  state = {}; chat = {}; votes = {}; usedTokens = {}; currentNight = 1;
  isVotingOpen = false; isMassacre = false; gameCards = null;
  res.json({ ok: true });
});

// Слушаем порт
app.listen(PORT, () => {
  console.log(`▶ Server running on port ${PORT}`);
});