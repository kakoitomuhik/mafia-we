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
let isMassacreActive = false; 

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
  { img: "propagandist", name: "Агитатор", nameF: "Агитаторша", task: "Сделай так, чтобы за того, кого ты выбрал, проголосовало большинство.", quote: "Толпа — механизм. Найди рычаг." },
  { img: "true_numer", name: "Истинный нумер", nameF: "Истинная нумер", task: "Ты должен проголосовать против того, кто тебе симпатичен. Объясни это логически.", quote: "Я помню, что ты мне нравился. Но Система права: ты — ошибка." },
  { img: "cultist", name: "Культист Интеграла", nameF: "Культистка Интеграла", task: "Добейся, чтобы в первый же день казнили любого нумера. Поддержи это решение публично.", quote: "Смерть — это не конец. Это оптимизация. Я приношу её во имя Интеграла." },
  { img: "order", name: "Порядок", nameF: "Порядок", task: "Сделай минимум 2 замечания тем, кто перебивает других во время обсуждения.", quote: "Хаос начинается с перебивания. Я не позволю Интегралу пасть из-за вашей неэффективности." },
  { img: "archivist", name: "Архивариус", nameF: "Архивариус", task: "Узнай и запомни три факта о других игроках. Назови их ведущему в конце игры.", quote: "Я собираю то, что Система пытается стереть. Ваши страхи — это единственное, что осталось настоящим." }
];

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
  } else {
    selectedCards = allCards.slice(0, 15);
  }

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

// ОГРАНИЧЕНИЕ НА 1 УСТРОЙСТВО СНЯТО
app.get('/api/cards', (req, res) => {
  res.json(getCardsWithProfessions());
});

app.get('/api/state', (_, res) => res.json({ cards: state, night: currentNight, mode: currentMode, isMassacre: isMassacreActive }));
app.post('/api/state/:id', (req, res) => {
  const id = req.params.id;
  state[id] = { ...(state[id] || {}), ...req.body };
  res.json(state[id]);
});

app.get('/api/chat', (_, res) => {
  const summary = getCardsWithProfessions().map(c => ({
    token: c.token, cipher: c.randomCipher || c.cipher, role: c.role, alibiProfession: c.alibiProfession,
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
  gameCards = null; 
  res.json({ mode: currentMode });
});

app.post('/api/next-night', (_, res) => {
  currentNight++;
  
  if (currentMode >= 15 && currentNight === 3) {
    const maifaAlive = getCardsWithProfessions().filter(c => 
      (c.role === "Диссидент" || c.role === "Лидер сопротивления") && !(state[c.id] || {}).dead
    );
    const requiredMaifa = currentMode === 15 ? 3 : 4;
    if (maifaAlive.length >= requiredMaifa) {
      isMassacreActive = true;
    }
  }

  res.json({ night: currentNight, isMassacre: isMassacreActive });
});

app.post('/api/reset', (_, res) => {
  state = {}; chat = {}; votes = {}; currentNight = 1;
  isVotingOpen = false;
  isMassacreActive = false;
  gameCards = null; 
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => console.log(`▶  Server running on port ${PORT}`));