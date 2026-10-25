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
let gameCards = null;

const PROFESSIONS = [
  "Инженер", "Архитектор", "Учитель", "Бухгалтер", 
  "Программист", "Электрик", "Сварщик", "Агроном", 
  "Геолог", "Машинист", "Библиотекарь", "Химик"
];

const CIPHER_LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н", "П", "Р", "С", "Т", "Ф"];

// Связанные пакеты: Картинка + Квест + Цитата
const PACKAGES = [
  { img: "poet", quest: "«Поэт»: Расскажи историю, которую оценят 3 человека.", quote: "Я говорю — и стекло трещит." },
  { img: "propagandist", quest: "«Смутьян»: Добейся, чтобы против тебя проголосовало 0 человек.", quote: "Толпа — механизм. Найди рычаг." },
  { img: "lawyer", quest: "«Судья»: Добейся, чтобы казнили того, за кого ты проголосовал.", quote: "Люди пишут правила. Люди ошибаются." },
  { img: "citizen", quest: "«Тень»: В течение дня соглашайся со всеми, но проголосуй против большинства.", quote: "Чтобы выжить в стеклянном доме — стань стеклом." },
  { img: "pacifist", quest: "«Молчун»: Промолчи всю игру (общайся только жестами).", quote: "Любовь важнее закона." },
  { img: "icon", quest: "«Хранитель времени»: Проживи до конца игры, ни разу не нарушив правила.", quote: "Я — цитата, которую повторят после меня." },
  { img: "dissident", quest: "«Смельчак»: Выдвинь на казнь самого активного игрока за столом.", quote: "Я просто ускоряю процесс." },
  { img: "leader", quest: "«Игрок»: На первом голосовании проголосуй за того, кто окажется мирным.", quote: "Они думают, что ловят меня. Это я решаю, кого они поймают." },
  { img: "doctor", quest: "«Хранитель времени»: Проживи до конца игры, ни разу не нарушив правила.", quote: "Интеграл — это не стены. Это люди." },
  { img: "guardian", quest: "«Смутьян»: Добейся, чтобы против тебя проголосовало 0 человек.", quote: "Я не ищу врагов. Я нахожу сбои." }
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
  
  if (currentMode === 10) {
    selectedCards = allCards.filter(c => c.id <= 10); 
  } else if (currentMode === 15) {
    selectedCards = allCards.slice(0, 15);
  } else {
    selectedCards = allCards.slice(0, 20);
  }

  const shuffledProfs = shuffle([...PROFESSIONS]);
  const shuffledPackages = shuffle([...PACKAGES]);

  selectedCards.forEach((card, index) => {
    card.alibiProfession = shuffledProfs[index % shuffledProfs.length];
    
    const pkg = shuffledPackages[index % shuffledPackages.length];
    card.image = pkg.img;
    card.quote = pkg.quote;
    
    if (card.role === "Строитель" || card.role === "Икона сопротивления") {
      card.quest = pkg.quest;
    }
  });

  const shuffledLetters = shuffle([...CIPHER_LETTERS]);
  selectedCards.forEach((card, index) => {
    const letter = shuffledLetters[index % shuffledLetters.length];
    const number = Math.floor(Math.random() * 999) + 1;
    card.randomCipher = `${letter}-${number}`;
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
  gameCards = null; 
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