const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// --- 1. БЕЗОПАСНОСТЬ И НАСТРОЙКИ ---
// Разрешаем запросы с любого домена (для разработки). 
// В продакшене замените '*' на адрес вашего фронтенда.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Защита от падения при невалидном JSON
app.use(express.json({ limit: '1mb', strict: true }));
app.use(express.static(__dirname + '/public'));

// --- 2. КАРТЫ ---
const CARDS = [ 
  { 
    id: 1, token: "7f3a9c21", role: "Строитель", image: "poet", 
    goalName: "Поэт", goalNameF: "Поэтесса", 
    quote: "Я говорю — и стекло трещит.", 
    quest: "Расскажи историю, которую оценят 3 человека.", 
    legend: { m: "Ты — поэт. Твои слова живут дольше тебя.", f: "Ты — поэтесса. Твои слова живут дольше тебя." } 
  },
  // ... остальные карты из вашего массива
];

// --- 3. ПАМЯТЬ (Временное решение) ---
// ВНИМАНИЕ: При перезагрузке сервера данные обнулятся.
// Для продакшена используйте Redis или базу данных.
let state = {};
let chat = {};
let votes = {};
let currentNight = 1;
let isVotingOpen = false;
let isMassacre = false;

// --- 4. ВАЛИДАЦИЯ (Вспомогательные функции) ---
const validateToken = (token) => typeof token === 'string' && token.length === 8;
const validateText = (text) => typeof text === 'string' && text.length > 0 && text.length < 500;

// --- 5. API ДЛЯ КАРТ ---
app.get('/api/cards', (req, res) => {
  const t = req.query.t;
  if (t) {
    if (!validateToken(t)) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    const card = CARDS.find(c => c.token === t);
    if (card) {
      const cardCopy = { ...card, alibiProfession: "Гражданин", randomCipher: "А-" + Math.floor(Math.random() * 999) };
      return res.json(cardCopy);
    }
    return res.status(404).json({ error: 'not found' });
  }
  res.json(CARDS);
});

// --- 6. API ДЛЯ СОСТОЯНИЯ ---
app.get('/api/state', (req, res) => 
  res.json({ cards: state, night: currentNight, mode: 10, isMassacre })
);

app.post('/api/state/:id', (req, res) => { 
  const id = req.params.id;
  const payload = req.body;
  
  if (typeof id !== 'string' || typeof payload !== 'object' || payload === null) {
    return res.status(400).json({ error: 'Bad request' });
  }
  
  // Защита от полной перезаписи объекта (частичная валидация)
  state[id] = { ...(state[id] || {}), ...payload };
  res.json(state[id]); 
});

// --- 7. API ДЛЯ ЧАТА ---
app.get('/api/chat', (req, res) => { 
  // Возвращаем только существующие чаты, а не заглушки для всех карт
  const activeChats = Object.keys(chat).map(token => ({
    token,
    role: CARDS.find(c => c.token === token)?.role || 'Unknown',
    messages: chat[token] || []
  }));
  res.json(activeChats); 
});

app.get('/api/chat/:token', (req, res) => {
  const t = req.params.token;
  if (!validateToken(t)) return res.status(400).json({ error: 'Invalid token' });
  res.json(chat[t] || []);
});

app.post('/api/chat/:token', (req, res) => { 
  const t = req.params.token;
  const text = req.body.text;
  
  if (!validateToken(t) || !validateText(text)) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  (chat[t] = chat[t] || []).push({ 
    from: 'player', 
    text, 
    ts: Date.now() 
  });
  res.json({ ok: true });
});

app.post('/api/chat/:token/reply', (req, res) => { 
  const t = req.params.token;
  const text = req.body.text;
  
  if (!validateToken(t) || !validateText(text)) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  (chat[t] = chat[t] || []).push({ 
    from: 'admin', 
    text, 
    ts: Date.now() 
  });
  res.json({ ok: true });
});

// --- 8. API ДЛЯ ГОЛОСОВАНИЯ ---
app.get('/api/votes', (req, res) => res.json(votes));

app.post('/api/vote', (req, res) => {
  const { voterId, targetId } = req.body;
  if (typeof voterId === 'string' && typeof targetId === 'string') {
    votes[voterId] = targetId;
  }
  res.json({ ok: true, votes });
});

app.post('/api/reset-votes', (req, res) => { 
  votes = {}; 
  res.json({ ok: true }); 
});

app.get('/api/voting-status', (req, res) => res.json({ isVotingOpen }));

app.post('/api/voting-status', (req, res) => { 
  const { isVotingOpen: status } = req.body;
  if (typeof status === 'boolean') {
    isVotingOpen = status;
  }
  res.json({ isVotingOpen });
});

// --- 9. АДМИНКА ---
app.post('/api/next-night', (req, res) => { 
  currentNight++; 
  // Сброс флагов при наступлении нового дня
  isMassacre = false; 
  res.json({ night: currentNight, isMassacre });
});

app.post('/api/reset', (req, res) => { 
  state = {}; 
  chat = {}; 
  votes = {}; 
  currentNight = 1; 
  isVotingOpen = false; 
  isMassacre = false; 
  res.json({ ok: true }); 
});

// --- 10. ЗАПУСК ---
app.listen(PORT, () => console.log('Server running on port ' + PORT));