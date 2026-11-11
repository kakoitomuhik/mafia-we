const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

const CARDS_PATH = path.join(__dirname, 'public', 'data', 'cards.json');
let cards = [];

// Генератор случайного шифра в стиле Замятина (буква + число)
function generateRandomCipher(used) {
  const letters = ['Д', 'I', 'О', 'Р', 'S', 'Ю', 'Ф', 'К', 'М', 'Б', 'Т', 'А', 'Н', 'Э'];
  let cipher = '';
  do {
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const num = Math.floor(10 + Math.random() * 8990);
    cipher = `${letter}-${num}`;
  } while (used.has(cipher));
  used.add(cipher);
  return cipher;
}

// Загрузка карт и рандомизация шифров нумеров
function randomizeCiphers() {
  try {
    if (fs.existsSync(CARDS_PATH)) {
      const raw = fs.readFileSync(CARDS_PATH, 'utf-8');
      const baseCards = JSON.parse(raw);
      const usedCiphers = new Set();
      
      cards = baseCards.map(c => ({
        ...c,
        cipher: generateRandomCipher(usedCiphers)
      }));
      console.log(`[DATA] Загружено 10 карт, сгенерированы новые шифры.`);
    } else {
      console.warn(`[DATA] cards.json не найден: ${CARDS_PATH}`);
      cards = [];
    }
  } catch (err) {
    console.error('[DATA] Ошибка чтения карт:', err.message);
  }
}
randomizeCiphers();

// Состояние сессии
let gameState = {
  phase: 'day',
  round: 1,
  votes: {},
  chatMessages: []
};

// Редирект на админку
app.get('/', (req, res) => {
  res.redirect('/admin.html');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', playersCount: cards.length });
});

// Получение карты игрока по токену ?t=...
app.get('/api/cards', (req, res) => {
  const token = req.query.t;
  if (!token) {
    return res.status(400).json({ error: 'Токен игрока не указан' });
  }

  const card = cards.find(c => String(c.token).trim() === String(token).trim());
  if (!card) {
    return res.status(404).json({ error: 'Карта игрока не найдена' });
  }

  res.json({
    ...card,
    gamePhase: gameState.phase,
    round: gameState.round
  });
});

// Список всех 10 карт для админки
app.get('/api/admin/cards', (req, res) => {
  res.json(cards);
});

// Кнопка рандомизации шифров из админки
app.post('/api/admin/randomize', (req, res) => {
  randomizeCiphers();
  res.json({ success: true, cards });
});

// Состояние
app.get('/api/state', (req, res) => {
  res.json(gameState);
});

// Смена фазы
app.post('/api/admin/phase', (req, res) => {
  const { phase } = req.body;
  if (!['day', 'voting', 'night', 'ended'].includes(phase)) {
    return res.status(400).json({ error: 'Недопустимая фаза' });
  }

  gameState.phase = phase;
  if (phase === 'day') {
    gameState.round += 1;
    gameState.votes = {};
  }

  res.json({ success: true, gameState });
});

// Сброс партии
app.post('/api/admin/reset', (req, res) => {
  gameState = {
    phase: 'day',
    round: 1,
    votes: {},
    chatMessages: []
  };
  randomizeCiphers();
  res.json({ success: true, gameState });
});

// Запуск сервера с 0.0.0.0
app.listen(PORT, HOST, () => {
  console.log(`========================================`);
  console.log(` Сервер запущен на ${HOST}:${PORT}`);
  console.log(` Админка: http://localhost:${PORT}/admin.html`);
  console.log(`========================================`);
});