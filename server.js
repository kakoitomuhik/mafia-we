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

function shuffle(array) {
  const arr = [...array];
  let currentIndex = arr.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
  }
  return arr;
}

function loadCardsFromDisk() {
  try {
    const raw = fs.readFileSync(CARDS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error('cards.json должен содержать массив');
      return null;
    }
    return parsed;
  } catch (e) {
    console.error('Не удалось загрузить cards.json:', e.message);
    return null;
  }
}

function getCardsWithProfessions() {
  if (gameCards) return gameCards;

  const allCards = loadCardsFromDisk();
  if (!allCards) return [];

  // Берём нужное количество карт по индексу, а не по id
  const selectedCards = currentMode === 10
    ? allCards.slice(0, 10)
    : allCards.slice(0, 15);

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
      card.quote = goal.quote;
      card.goalName = goal.name;
      card.goalNameF = goal.nameF;
      card.quest = goal.task;
    } else if (card.role === "Икона сопротивления") {
      card.imageKey = "icon";
      card.quote = "Я — цитата, которую повторят после меня.";
      card.goalName = "«Икона сопротивления»";
      card.goalNameF = "«Икона сопротивления»";
      card.quest = "Умереть на голосовании. Очков за твою смерть не получает никто.";
    } else if (card.role === "Диссидент") {
      card.imageKey = "dissident2";
    } else if (card.role === "Лидер сопротивления") {
      card.imageKey = "leader";
    } else if (card.role === "Врач") {
      card.imageKey = "doctor";
    } else if (card.role === "Хранитель") {
      card.imageKey = "guardian";
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

// ---------- Карты ----------
app.get('/api/cards', (req, res) => {
  res.json(getCardsWithProfessions());
});

// ---------- Состояние игры ----------
app.get('/api/state', (req, res) => {
  res.json({ cards: state, night: currentNight, mode: currentMode });
});

app.post('/api/state/:id', (req, res) => {
  const id = req.params.id;
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'invalid body' });
  }
  state[id] = { ...(state[id] || {}), ...req.body };
  res.json(state[id]);
});

// ---------- Чат ----------
// ВНИМАНИЕ: эндпоинт отдаёт роли всех карт. Использовать только для админки.
// Если клиент-игрок обращается к /api/chat — роль утекает. Рекомендую защитить.
app.get('/api/chat', (req, res) => {
  // Простейшая защита: только при наличии заголовка X-Admin-Token.
  // Если у вас другая схема авторизации — замените проверку.
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken && req.headers['x-admin-token'] !== adminToken) {
    return res.status(403).json({ error: 'forbidden' });
  }
  res.json(getCardsWithProfessions().map(c => ({
    token: c.token,
    cipher: c.randomCipher || c.cipher,
    role: c.role,
    alibiProfession: c.alibiProfession,
    messages: chat[c.token] || []
  })));
});

app.get('/api/chat/:token', (req, res) => {
  res.json(chat[req.params.token] || []);
});

app.post('/api/chat/:token', (req, res) => {
  const text = (req.body && req.body.text ? String(req.body.text) : '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  (chat[req.params.token] = chat[req.params.token] || []).push({
    from: 'player', text, ts: Date.now()
  });
  res.json({ ok: true });
});

app.post('/api/chat/:token/reply', (req, res) => {
  const text = (req.body && req.body.text ? String(req.body.text) : '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  (chat[req.params.token] = chat[req.params.token] || []).push({
    from: 'admin', text, ts: Date.now()
  });
  res.json({ ok: true });
});

// ---------- Голосование ----------
app.get('/api/votes', (req, res) => res.json(votes));

app.post('/api/vote', (req, res) => {
  const { voterId, targetId } = req.body || {};
  if (!voterId || !targetId) {
    return res.status(400).json({ error: 'voterId and targetId required' });
  }
  votes[voterId] = targetId;
  res.json({ ok: true, votes });
});

app.post('/api/reset-votes', (req, res) => {
  votes = {};
  res.json({ ok: true });
});

app.get('/api/voting-status', (req, res) => res.json({ isVotingOpen }));

app.post('/api/voting-status', (req, res) => {
  if (!req.body || typeof req.body.isVotingOpen === 'undefined') {
    return res.status(400).json({ error: 'isVotingOpen required' });
  }
  isVotingOpen = Boolean(req.body.isVotingOpen);
  res.json({ isVotingOpen });
});

// ---------- Управление игрой ----------
app.post('/api/set-mode', (req, res) => {
  const mode = Number(req.body && req.body.mode);
  if (![10, 15].includes(mode)) {
    return res.status(400).json({ error: 'mode must be 10 or 15' });
  }
  currentMode = mode;
  gameCards = null;
  res.json({ mode: currentMode });
});

app.post('/api/next-night', (req, res) => {
  currentNight++;
  res.json({ night: currentNight });
});

app.post('/api/reset', (req, res) => {
  state = {};
  chat = {};
  votes = {};
  currentNight = 1;
  isVotingOpen = false;
  gameCards = null;
  // currentMode намеренно не сбрасываем — режим выбирает ведущий.
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});