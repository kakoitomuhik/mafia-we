const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Разрешаем CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Чтение карт из public/data/cards.json
const CARDS_PATH = path.join(__dirname, 'public', 'data', 'cards.json');
let cards = [];

function loadCards() {
  try {
    if (fs.existsSync(CARDS_PATH)) {
      const raw = fs.readFileSync(CARDS_PATH, 'utf-8');
      cards = JSON.parse(raw);
      console.log(`[DATA] Загружено карт: ${cards.length}`);
    } else {
      console.warn(`[DATA] cards.json не найден по пути: ${CARDS_PATH}`);
      cards = [];
    }
  } catch (err) {
    console.error('[DATA] Ошибка разбора cards.json:', err.message);
    cards = [];
  }
}
loadCards();

// Состояние сессии в памяти
let gameState = {
  phase: 'day', // 'day' | 'voting' | 'night'
  round: 1,
  votes: {},
  chatMessages: []
};

// Редирект с корня сайта на панель Благодетеля
app.get('/', (req, res) => {
  res.redirect('/admin.html');
});

// Проверка активности контейнера для хостинга
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// API: Карточка игрока по токену ?t=...
app.get('/api/cards', (req, res) => {
  const token = req.query.t;
  if (!token) {
    return res.status(400).json({ error: 'Токен игрока не указан в запросе' });
  }

  const card = cards.find(c => String(c.token).trim() === String(token).trim());
  if (!card) {
    return res.status(404).json({ error: 'Нумер с указанным шифром/токеном не найден' });
  }

  res.json({
    ...card,
    gamePhase: gameState.phase,
    round: gameState.round
  });
});

// API: Все карточки для админки
app.get('/api/admin/cards', (req, res) => {
  res.json(cards);
});

// API: Состояние игры
app.get('/api/state', (req, res) => {
  res.json(gameState);
});

// API: Переключение фазы (День / Голосование / Ночь)
app.post('/api/admin/phase', (req, res) => {
  const { phase } = req.body;
  if (!['day', 'voting', 'night', 'ended'].includes(phase)) {
    return res.status(400).json({ error: 'Недопустимая фаза игры' });
  }

  gameState.phase = phase;
  if (phase === 'day') {
    gameState.round += 1;
    gameState.votes = {};
  }

  console.log(`[STATE] Фаза: ${phase}, Раунд: ${gameState.round}`);
  res.json({ success: true, gameState });
});

// API: Сброс игры
app.post('/api/admin/reset', (req, res) => {
  gameState = {
    phase: 'day',
    round: 1,
    votes: {},
    chatMessages: []
  };
  loadCards();
  console.log('[STATE] Игра сброшена в исходное состояние');
  res.json({ success: true, gameState });
});

// API: Голосование
app.post('/api/vote', (req, res) => {
  const { voterToken, targetId } = req.body;
  if (!voterToken || targetId === undefined) {
    return res.status(400).json({ error: 'Недостаточно данных для передачи бюллетеня' });
  }

  const voter = cards.find(c => c.token === voterToken);
  if (!voter) {
    return res.status(403).json({ error: 'Недействительный шифр гражданина' });
  }

  gameState.votes[voterToken] = targetId;
  res.json({ success: true, votes: gameState.votes });
});

// API: Чат
app.get('/api/chat', (req, res) => {
  res.json(gameState.chatMessages);
});

app.post('/api/chat', (req, res) => {
  const { token, text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Пустое сообщение' });
  }

  const sender = cards.find(c => c.token === token) || { name: 'Неизвестный', role: 'Гражданин' };

  const message = {
    id: Date.now(),
    author: sender.name,
    role: sender.role,
    text: text.trim().slice(0, 300),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  gameState.chatMessages.push(message);
  if (gameState.chatMessages.length > 50) {
    gameState.chatMessages.shift();
  }

  res.json({ success: true, message });
});

// Запуск сервера с привязкой к 0.0.0.0
app.listen(PORT, HOST, () => {
  console.log(`========================================`);
  console.log(` Единое Государство: Сервер запущен`);
  console.log(` Адрес: http://${HOST}:${PORT}`);
  console.log(` Внешняя админка: /admin.html`);
  console.log(`========================================`);
});