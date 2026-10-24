const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat.json');
const CARDS_FILE = path.join(__dirname, 'public', 'cards.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

let state = load(STATE_FILE, {});
let chat = load(CHAT_FILE, {});

// 12 случайных профессий (можешь заменить на свои)
const PROFESSIONS = [
  "Инженер", "Архитектор", "Учитель", "Бухгалтер", 
  "Программист", "Электрик", "Сварщик", "Агроном", 
  "Геолог", "Машинист", "Библиотекарь", "Химик"
];

// Функция перемешивания
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

// Главная функция получения карт
function getCardsWithProfessions() {
  let cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
  
  // Проверяем, есть ли хоть одна карта без профессии
  const hasMissingProfession = cards.some(c => !c.alibiProfession);

  if (hasMissingProfession) {
    const shuffled = shuffle([...PROFESSIONS]);
    cards.forEach((card, index) => {
      if (!card.alibiProfession) {
        card.alibiProfession = shuffled[index % shuffled.length];
      }
    });
    // Сохраняем в файл, чтобы профессии закрепились
    fs.writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2));
  }

  return cards;
}

// --- API ---
app.get('/api/cards', (_, res) => {
  res.json(getCardsWithProfessions());
});

app.get('/api/state', (_, res) => res.json(state));
app.post('/api/state/:id', (req, res) => {
  const id = req.params.id;
  state[id] = { ...(state[id] || {}), ...req.body };
  save(STATE_FILE, state);
  res.json(state[id]);
});

app.post('/api/reset', (_, res) => {
  state = {}; chat = {};
  save(STATE_FILE, state); save(CHAT_FILE, chat);
  
  // Очищаем профессии, чтобы при следующем старте они перемешались заново
  let cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
  cards.forEach(c => delete c.alibiProfession);
  fs.writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2));

  res.json({ ok: true });
});

// Чат
app.get('/api/chat/:token', (req, res) => res.json(chat[req.params.token] || []));
app.post('/api/chat/:token', (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  const t = req.params.token;
  (chat[t] = chat[t] || []).push({ from: 'player', text, ts: Date.now() });
  save(CHAT_FILE, chat);
  res.json({ ok: true });
});
app.post('/api/chat/:token/reply', (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  const t = req.params.token;
  (chat[t] = chat[t] || []).push({ from: 'admin', text, ts: Date.now() });
  save(CHAT_FILE, chat);
  res.json({ ok: true });
});
app.get('/api/chat', (_, res) => {
  const summary = getCardsWithProfessions().map(c => ({
    token: c.token, cipher: c.cipher, role: c.role,
    alibiProfession: c.alibiProfession,
    messages: chat[c.token] || []
  }));
  res.json(summary);
});

app.listen(PORT, () => console.log(`▶  http://localhost:${PORT}`));