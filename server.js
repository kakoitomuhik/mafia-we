const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function findCardsFile() {
  const possiblePaths = [
    path.join(__dirname, 'data', 'cards.json'),
    path.join(__dirname, 'public', 'cards.json'),
    path.join(__dirname, 'cards.json')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadCards() {
  const file = findCardsFile();
  if (!file) return [];
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

let state = {};
let chat = {};
let votes = {};
let currentNight = 1;
let isVotingOpen = false;

app.get('/api/cards', (req, res) => {
  const allCards = loadCards();
  const token = req.query.t;
  
  if (token) {
    const card = allCards.find(c => c.token === token);
    if (card) return res.json(card);
    return res.status(404).json({ error: 'card not found' });
  }
  res.json(allCards);
});

app.get('/api/players', (req, res) => {
  const allCards = loadCards();
  res.json(allCards.map(c => ({ id: c.id, cipher: c.cipher || 'Нумер', randomCipher: c.randomCipher || 'А-1' })));
});

app.get('/api/state', (req, res) => {
  res.json({ cards: state, night: currentNight, mode: 10, isMassacre: false });
});

app.post('/api/state/:id', (req, res) => {
  state[req.params.id] = { ...(state[req.params.id] || {}), ...req.body };
  res.json(state[req.params.id]);
});

app.get('/api/chat', (req, res) => res.json([]));
app.get('/api/chat/:token', (req, res) => res.json(chat[req.params.token] || []));
app.post('/api/chat/:token', (req, res) => {
  (chat[req.params.token] = chat[req.params.token] || []).push({ from: 'player', text: req.body.text, ts: Date.now() });
  res.json({ ok: true });
});
app.post('/api/chat/:token/reply', (req, res) => {
  (chat[req.params.token] = chat[req.params.token] || []).push({ from: 'admin', text: req.body.text, ts: Date.now() });
  res.json({ ok: true });
});

app.get('/api/votes', (req, res) => res.json(votes));
app.post('/api/vote', (req, res) => { votes[req.body.voterId] = req.body.targetId; res.json({ ok: true }); });
app.post('/api/reset-votes', (req, res) => { votes = {}; res.json({ ok: true }); });
app.get('/api/voting-status', (req, res) => res.json({ isVotingOpen }));
app.post('/api/voting-status', (req, res) => { isVotingOpen = req.body.isVotingOpen; res.json({ isVotingOpen }); });

app.listen(PORT, () => {
  console.log(`▶ Server running on port ${PORT}`);
});