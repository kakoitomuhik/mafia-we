const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

// Для Нитрана берем системный порт из окружения или 8080 по умолчанию
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0'; // Обязательно для облачных контейнеров

// Встроенный CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Путь к файлу с картами
const CARDS_PATH = path.join(__dirname, 'public', 'data', 'cards.json');
let cards = [];

function loadCards() {
  try {
    if (fs.existsSync(CARDS_PATH)) {
      const raw = fs.readFileSync(CARDS_PATH, 'utf-8');
      cards = JSON.parse(raw);
      console.log(`[DATA] Успешно загружено карт: ${cards.length}`);
    } else {
      console.warn(`[DATA] cards.json не найден по пути ${CARDS_PATH}`);
      cards = [];
    }
  } catch (err) {
    console.error('[DATA] Ошибка чтения cards.json:', err.message);
    cards = [];
  }
}
loadCards();

// Игровое состояние в памяти
let gameState = {
  phase: 'day', // 'day' | 'night' | 'voting' | 'ended'
  round: 1,
  killedPlayerId: null,
  votes: {},
  chatMessages: [],
  actionLogs: []
};

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Проверка здоровья сервиса для балансировщика хостинга
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// API: Получить карту по токену (?t=...)
app.get('/api/cards', (req, res) => {
  const token = req.query.t;
  if (!token) {
    return res.status(400).json({ error: 'Параметр токена ?t= не передан' });
  }

  const card = cards.find(c => String(c.token).trim() === String(token).trim());
  if (!card) {
    return res.status(404).json({ error: 'Игрок с таким токеном не найден' });
  }

  res.json({
    id: card.id,
    name: card.name,
    role: card.role,
    team: card.team,
    image: card.image,
    description: card.description,
    quote: card.quote,
    gamePhase: gameState.phase,
    round: gameState.round
  });
});

// API: Список всех карт для админки
app.get('/api/admin/cards', (req, res) => {
  res.json(cards);
});

// API: Текущий статус игры
app.get('/api/state', (req, res) => {
  res.json(gameState);
});

// API: Переключение фазы
app.post('/api/admin/phase', (req, res) => {
  const { phase } = req.body;
  if (!['day', 'night', 'voting', 'ended'].includes(phase)) {
    return res.status(400).json({ error: 'Недопустимая фаза игры' });
  }

  gameState.phase = phase;
  if (phase === 'day') {
    gameState.round += 1;
    gameState.votes = {};
  }

  console.log(`[GAME] Смена фазы: ${phase}, Раунд: ${gameState.round}`);
  res.json({ success: true, gameState });
});

// API: Сброс игры
app.post('/api/admin/reset', (req, res) => {
  gameState = {
    phase: 'day',
    round: 1,
    killedPlayerId: null,
    votes: {},
    chatMessages: [],
    actionLogs: []
  };
  loadCards();
  console.log('[GAME] Игра сброшена в исходное состояние');
  res.json({ success: true, gameState });
});

// API: Голосование
app.post('/api/vote', (req, res) => {
  const { voterToken, targetId } = req.body;
  if (!voterToken || targetId === undefined) {
    return res.status(400).json({ error: 'Не переданы данные для голосования' });
  }

  const voter = cards.find(c => c.token === voterToken);
  if (!voter) {
    return res.status(403).json({ error: 'Недействительный токен' });
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
    return res.status(400).json({ error: 'Пустой текст' });
  }

  const sender = cards.find(c => c.token === token) || { name: 'Гость', role: 'Наблюдатель' };

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

// Слушаем 0.0.0.0
app.listen(PORT, HOST, () => {
  console.log(`========================================`);
  console.log(` Сервер запущен на ${HOST}:${PORT}`);
  console.log(` Окружение PORT = ${process.env.PORT || 'не задан (дефолт 8080)'}`);
  console.log(`========================================`);
});