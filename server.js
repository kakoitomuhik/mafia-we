const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function findCardsFile() {
  const paths = [
    path.join(__dirname, 'data', 'cards.json'),
    path.join(__dirname, 'public', 'cards.json'),
    path.join(__dirname, 'cards.json')
  ];
  for (const p of paths) {
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
let currentMode = 10;
let isVotingOpen = false;
let isMassacre = false;

app.get('/api/cards', (req, res) => {
  const all = loadCards();
  const t = req.query.t;
  if (t) {
    const one = all.find(c => c.token === t);
    return one ? res.json(one) : res.status(404).json({ error: 'not found' });
  }
  res.json(all);
});

app.get('/api/players', (req, res) => {
  const all = loadCards();
  res.json(all.map(c => ({ id: c.id, cipher: c.cipher || 'Нумер', randomCipher: c.randomCipher || 'А-1' })));
});

app.get('/api/state', (req, res) => {
  res.json({ cards: state, night: currentNight, mode: currentMode, isMassacre });
});

app.post('/api/state/:id', (req, res) => {
  state[req.params.id] = { ...(state[req.params.id] || {}), ...req.body };
  res.json(state[req.params.id]);
});

app.get('/api/chat', (req, res) => {
  const all = loadCards();
  res.json(all.map(c => ({
    token: c.token, 
    cipher: c.randomCipher || c.cipher || 'Нумер', 
    randomCipher: c.randomCipher || 'А-1',
    role: c.role, 
    alibiProfession: c.alibiProfession || 'Гражданин',
    messages: chat[c.token] || []
  })));
});

app.get('/api/chat/:token', (req, res) => res.json(chat[req.params.token] || []));

app.post('/api/chat/:token', (req, res) => {
  const text = (req.body && req.body.text ? String(req.body.text) : '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  const t = req.params.token;
  (chat[t] = chat[t] || []).push({ from: 'player', text, ts: Date.now() });
  res.json({ ok: true });
});

app.post('/api/chat/:token/reply', (req, res) => {
  const text = (req.body && req.body.text ? String(req.body.text) : '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  const t = req.params.token;
  (chat[t] = chat[t] || []).push({ from: 'admin', text, ts: Date.now() });
  res.json({ ok: true });
});

app.get('/api/votes', (req, res) => res.json(votes));
app.post('/api/vote', (req, res) => {
  const { voterId, targetId } = req.body || {};
  if (voterId) votes[voterId] = targetId === null ? null : Number(targetId);
  res.json({ ok: true, votes });
});

app.post('/api/reset-votes', (req, res) => { votes = {}; res.json({ ok: true }); });
app.get('/api/voting-status', (req, res) => res.json({ isVotingOpen }));
app.post('/api/voting-status', (req, res) => { isVotingOpen = Boolean(req.body && req.body.isVotingOpen); res.json({ isVotingOpen }); });

app.post('/api/set-mode', (req, res) => { 
  currentMode = Number(req.body.mode); 
  res.json({ mode: currentMode }); 
});

app.post('/api/next-night', (req, res) => {
  currentNight++;
  const anyDead = Object.values(state).some(s => s && s.dead);
  isMassacre = currentNight === 3 && !anyDead;
  res.json({ night: currentNight, isMassacre });
});

app.post('/api/reset', (req, res) => {
  state = {}; chat = {}; votes = {}; currentNight = 1; isVotingOpen = false; isMassacre = false;
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});