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
let usedTokens = {}; 
let currentNight = 1;
let currentMode = 10; 
let gameCards = null; // Память для карт (чтобы квесты не менялись)

const PROFESSIONS = [
  "Инженер", "Архитектор", "Учитель", "Бухгалтер", 
  "Программист", "Электрик", "Сварщик", "Агроном", 
  "Геолог", "Машинист", "Библиотекарь", "Химик"
];

const CIPHER_LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н", "П", "Р", "С", "Т", "Ф"];

const QUESTS = [
  "«Смутьян»: Добейся, чтобы против тебя проголосовало 0 человек.",
  "«Молчун»: Промолчи всю игру (только жесты).",
  "«Хроникёр»: Запиши и перескажи ведущему 3 самых громких обвинения за день.",
  "«Дипломат»: Договорись с любым игроком о негласном союзе (сообщи ведущему в чат).",
  "«Свидетель»: Угадай роль любого выбывшего игрока и отправь ответ в чат ведущему.",
  "«Судья»: Добейся, чтобы в первый день казнили того, за кого ты проголосовал.",
  "«Аналитик»: Правильно назови Лидера сопротивления (отправь в чат ведущему).",
  "«Шептун»: Угадай, кто мафия, и отправь его имя в чат ведущему.",
  "«Игрок»: На первом голосовании проголосуй за того, кто окажется мирным.",
  "«Смельчак»: Выдвинь на казнь самого активного игрока за столом.",
  "«Тень»: В течение дня соглашайся со всеми, но проголосуй против большинства.",
  "«Поэт»: Отправь ведущему в чат короткий стих (2 строчки) о стеклянных стенах.",
  "«Шпион»: Узнай профессию (алиби) любого игрока и отправь её в чат ведущему.",
  "«Наблюдатель»: Отправь в чат ведущему имя самого тихого игрока за столом.",
  "«Инженер»: Отправь в чат ведущему «план ремонта Интеграла».",
  "«Хранитель времени»: Проживи до конца игры, не нарушив правил."
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
  if (gameCards) return gameCards; // Если уже сгенерировали — отдаем как есть

  let allCards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
  let selectedCards = [];
  
  if (currentMode === 10) {
    selectedCards = allCards.filter(c => c.id <= 10); 
  } else if (currentMode === 15) {
    selectedCards = allCards.slice(0, 15);
  } else {
    selectedCards = allCards.slice(0, 20);
  }

  // 1. Профессии
  const shuffledProfs = shuffle([...PROFESSIONS]);
  selectedCards.forEach((card, index) => {
    card.alibiProfession = shuffledProfs[index % shuffledProfs.length];
  });

  // 2. Шифры
  const shuffledLetters = shuffle([...CIPHER_LETTERS]);
  selectedCards.forEach((card, index) => {
    const letter = shuffledLetters[index % shuffledLetters.length];
    const number = Math.floor(Math.random() * 999) + 1;
    card.randomCipher = `${letter}-${number}`;
  });

  // 3. Квесты (только Строителям)
  selectedCards.forEach(card => {
    if (card.role === "Строитель") {
      card.quest = QUESTS[Math.floor(Math.random() * QUESTS.length)];
    }
  });

  // 4. Мститель (только среди Строителей)
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

app.post('/api/set-mode', (req, res) => {
  currentMode = req.body.mode;
  res.json({ mode: currentMode });
});

app.post('/api/next-night', (_, res) => {
  currentNight++;
  res.json({ night: currentNight });
});

app.post('/api/reset', (_, res) => {
  state = {}; chat = {}; usedTokens = {}; currentNight = 1;
  gameCards = null; // Очищаем память, чтобы при следующем запросе всё перемешалось заново
  res.json({ ok: true });
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
app.get('/api/chat', (_, res) => {
  const summary = getCardsWithProfessions().map(c => ({
    token: c.token, cipher: c.randomCipher || c.cipher, role: c.role, alibiProfession: c.alibiProfession,
    messages: chat[c.token] || []
  }));
  res.json(summary);
});

app.listen(PORT, () => console.log(`▶  http://localhost:${PORT}`));