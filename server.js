const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// CORS
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

// 10 базовых персонажей Единого Государства
let baseRoles = [];
function loadBaseCards() {
  try {
    if (fs.existsSync(CARDS_PATH)) {
      baseRoles = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf-8'));
    } else {
      console.warn('[DATA] cards.json не найден, загрузка встроенного пула');
      baseRoles = [];
    }
  } catch (e) {
    console.error('[DATA] Ошибка чтения cards.json:', e.message);
  }
}
loadBaseCards();

// Фиксированные постоянные 10 мест для постоянных QR-кодов
const SEATS_COUNT = 10;
const FIXED_SEATS = [
  { seat: 1,  token: "seat-01" },
  { seat: 2,  token: "seat-02" },
  { seat: 3,  token: "seat-03" },
  { seat: 4,  token: "seat-04" },
  { seat: 5,  token: "seat-05" },
  { seat: 6,  token: "seat-06" },
  { seat: 7,  token: "seat-07" },
  { seat: 8,  token: "seat-08" },
  { seat: 9,  token: "seat-09" },
  { seat: 10, token: "seat-10" }
];

function generateCipher(index) {
  const letters = ['Д', 'I', 'О', 'Р', 'S', 'Ю', 'Ф', 'К', 'М', 'Б'];
  const l = letters[index % letters.length];
  const num = Math.floor(100 + Math.random() * 899);
  return `${l}-${num}`;
}

// Перемешивание ролей между постоянными местами
let activeSeats = [];

function shuffleRoles() {
  loadBaseCards();
  const shuffled = [...baseRoles].sort(() => Math.random() - 0.5);

  activeSeats = FIXED_SEATS.map((seatInfo, idx) => {
    const roleData = shuffled[idx] || {
      name: `Нумер ${idx + 1}`,
      role: "Строитель",
      team: "builders",
      image: "poet_m",
      target: "Строитель",
      quest: "Следовать Часовой Скрижали.",
      night: "Сон по расписанию.",
      quote: "Мы счастливы, ибо подчинены закону."
    };

    return {
      seat: seatInfo.seat,
      token: seatInfo.token,
      cipher: generateCipher(idx),
      alive: true,
      ...roleData
    };
  });
  console.log('[GAME] 10 мест успешно перераспределены под постоянные QR-коды');
}
shuffleRoles();

// Состояние партии
let gameState = {
  phase: 'day', // 'day' | 'voting' | 'night'
  round: 1,
  chatMessages: []
};

// Редирект корня
app.get('/', (req, res) => res.redirect('/admin.html'));

// Проверка хостинга
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', seats: activeSeats.length }));

// API: Карточка игрока по QR-коду (по ?seat=1..10 или по ?t=seat-01)
app.get('/api/cards', (req, res) => {
  const { t, seat } = req.query;
  let found = null;

  if (seat) {
    found = activeSeats.find(s => String(s.seat) === String(seat));
  } else if (t) {
    found = activeSeats.find(s => s.token === t || String(s.id) === String(t));
  }

  if (!found) {
    return res.status(404).json({ error: 'Место или QR-код не зарегистрирован в системе' });
  }

  res.json({
    ...found,
    gamePhase: gameState.phase,
    round: gameState.round
  });
});

// API: Список всех 10 мест для Благодетеля
app.get('/api/admin/cards', (req, res) => {
  res.json(activeSeats);
});

// API: Состояние игры
app.get('/api/state', (req, res) => {
  res.json(gameState);
});

// API: Смена фазы (День / Голосование / Ночь)
app.post('/api/admin/phase', (req, res) => {
  const { phase } = req.body;
  if (!['day', 'voting', 'night', 'ended'].includes(phase)) {
    return res.status(400).json({ error: 'Неверная фаза' });
  }

  gameState.phase = phase;
  if (phase === 'day') {
    gameState.round += 1;
  }

  let phaseLabel = 'ДЕНЬ ☀️';
  if (phase === 'voting') phaseLabel = 'ГОЛОСОВАНИЕ 🗳️';
  if (phase === 'night') phaseLabel = 'ЛИЧНЫЙ ЧАС (НОЧЬ) 🌙';

  // Системное сообщение в чат
  gameState.chatMessages.push({
    id: Date.now(),
    author: 'БЛАГОДЕТЕЛЬ',
    role: 'Скрижаль',
    text: `Объявлена фаза: ${phaseLabel}. Раунд ${gameState.round}.`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true
  });

  res.json({ success: true, gameState });
});

// API: Переключение Жив / Мёртв (казнён)
app.post('/api/admin/player-status', (req, res) => {
  const { seat, alive } = req.body;
  const p = activeSeats.find(s => Number(s.seat) === Number(seat));
  if (!p) return res.status(404).json({ error: 'Место не найдено' });

  p.alive = Boolean(alive);

  gameState.chatMessages.push({
    id: Date.now(),
    author: 'БЮРО ХРАНИТЕЛЕЙ',
    role: 'Скрижаль',
    text: p.alive 
      ? `Нумер ${p.cipher} (Место №${p.seat}) возвращён в строй.`
      : `Нумер ${p.cipher} (Место №${p.seat}) аннигилирован под Колоколом.`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true
  });

  res.json({ success: true, player: p });
});

// API: Перемешать роли по местам (перед новой игрой, QR-коды не меняются!)
app.post('/api/admin/randomize', (req, res) => {
  shuffleRoles();
  gameState.chatMessages.push({
    id: Date.now(),
    author: 'БЛАГОДЕТЕЛЬ',
    role: 'Скрижаль',
    text: 'Произведена перетасовка ролей между постоянными местами 1–10. Сканируйте QR-коды!',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true
  });
  res.json({ success: true, seats: activeSeats });
});

// API: Сброс игры
app.post('/api/admin/reset', (req, res) => {
  gameState = {
    phase: 'day',
    round: 1,
    chatMessages: []
  };
  shuffleRoles();
  res.json({ success: true, gameState, seats: activeSeats });
});

// API: Чат мембраны Единого Государства
app.get('/api/chat', (req, res) => {
  res.json(gameState.chatMessages);
});

app.post('/api/chat', (req, res) => {
  const { seat, token, text, author } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Пустое сообщение' });
  }

  let senderName = author || 'Благодетель';
  let senderRole = 'Бюро';

  const player = activeSeats.find(s => (seat && Number(s.seat) === Number(seat)) || (token && s.token === token));
  if (player) {
    senderName = `${player.cipher} (№${player.seat})`;
    senderRole = player.role;
    if (!player.alive) {
      return res.status(403).json({ error: 'Казнённый нумер не может передавать сообщения через мембрану' });
    }
  }

  const message = {
    id: Date.now(),
    author: senderName,
    role: senderRole,
    text: text.trim().slice(0, 240),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: false
  };

  gameState.chatMessages.push(message);
  if (gameState.chatMessages.length > 60) {
    gameState.chatMessages.shift();
  }

  res.json({ success: true, message });
});

app.listen(PORT, HOST, () => {
  console.log(`===============================================`);
  console.log(` Единое Государство запущено на ${HOST}:${PORT}`);
  console.log(` QR-ссылка места №1: /card.html?seat=1`);
  console.log(` Админка Благодетеля: /admin.html`);
  console.log(`===============================================`);
});