const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Встроенный CORS без сторонних библиотек
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

// Путь к файлу с данными карт
const CARDS_PATH = path.join(__dirname, 'public', 'data', 'cards.json');
let cards = [];

// Функция загрузки данных
function loadCards() {
  try {
    if (fs.existsSync(CARDS_PATH)) {
      const raw = fs.readFileSync(CARDS_PATH, 'utf-8');
      cards = JSON.parse(raw);
      console.log(`[DATA] Успешно загружено карт: ${cards.length}`);
    } else {
      console.warn(`[DATA] Файл ${CARDS_PATH} не найден!`);
      cards = [];
    }
  } catch (err) {
    console.error('[DATA] Ошибка при чтении cards.json:', err.message);
    cards = [];
  }
}
loadCards();

// Игровое состояние
let gameState = {
  phase: 'day', // 'day' | 'night' | 'voting' | 'ended'
  round: 1,
  killedPlayerId: null,
  votes: {},        // { voterToken: targetCardId }
  chatMessages: [], // { id, author, role, text, time }
  actionLogs: []
};

// Главная страница: отдаём index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: Получить карту игрока по токену
app.get('/api/cards', (req, res) => {
  const token = req.query.t;
  if (!token) {
    return res.status(400).json({ error: 'Параметр токена t отсутствует' });
  }

  const card = cards.find(c => c.token === token);
  if (!card) {
    return res.status(404).json({ error: 'Карта с таким токеном не найдена' });
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

// API: Получить все карты (для панели ведущего)
app.get('/api/admin/cards', (req, res) => {
  res.json(cards);
});

// API: Получить текущее состояние партии
app.get('/api/state', (req, res) => {
  res.json(gameState);
});

// API: Смена фазы (день, ночь, голосование)
app.post('/api/admin/phase', (req, res) => {
  const { phase } = req.body;
  if (!['day', 'night', 'voting', 'ended'].includes(phase)) {
    return res.status(400).json({ error: 'Недопустимая фаза игры' });
  }

  gameState.phase = phase;
  if (phase === 'day') {
    gameState.round += 1;
    gameState.votes = {}; // сброс дневного голосования
  }

  console.log(`[GAME] Фаза: ${phase}, Раунд: ${gameState.round}`);
  res.json({ success: true, gameState });
});

// API: Сброс игры ведущим
app.post('/api/admin/reset', (req, res) => {
  gameState = {
    phase: 'day',
    round: 1,
    killedPlayerId: null,
    votes: {},
    chatMessages: [],
    actionLogs: []
  };
  loadCards(); // перезагружаем карты из cards.json
  console.log('[GAME] Игра сброшена');
  res.json({ success: true, message: 'Игра успешно сброшена', gameState });
});

// API: Голосование
app.post('/api/vote', (req, res) => {
  const { voterToken, targetId } = req.body;
  if (!voterToken || targetId === undefined) {
    return res.status(400).json({ error: 'Не переданы параметры для голосования' });
  }

  const voter = cards.find(c => c.token === voterToken);
  if (!voter) {
    return res.status(403).json({ error: 'Игрок с таким токеном не найден' });
  }

  gameState.votes[voterToken] = targetId;
  res.json({ success: true, votes: gameState.votes });
});

// API: Сообщения чата
app.get('/api/chat', (req, res) => {
  res.json(gameState.chatMessages);
});

app.post('/api/chat', (req, res) => {
  const { token, text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Пустой текст сообщения' });
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

// Запуск приложения
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(` Сервер запущен на http://localhost:${PORT}`);
  console.log(` Меню:     http://localhost:${PORT}/`);
  console.log(` Админка:  http://localhost:${PORT}/admin.html`);
  console.log(` Карточка: http://localhost:${PORT}/card.html?t=7f3a9c21`);
  console.log(`========================================`);
});