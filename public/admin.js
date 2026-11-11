const origin = window.location.origin;

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const state = await res.json();

    const badge = document.getElementById('statusBadge');
    if (badge) {
      let t = 'День';
      if (state.phase === 'voting') t = 'Голосование';
      if (state.phase === 'night') t = 'Ночь';
      badge.textContent = `Фаза: ${t} • Раунд ${state.round}`;
    }
  } catch (e) {}
}

async function fetchCards() {
  const container = document.getElementById('cardsGrid');
  try {
    const res = await fetch('/api/admin/cards');
    const cards = await res.json();

    container.innerHTML = cards.map(c => {
      const cardUrl = `${origin}/card.html?t=${c.token}`;
      return `
        <div class="card ${c.team}">
          <div>
            <span class="cipher-tag">Шифр: ${c.cipher}</span>
            <div style="font-size: 15px; font-weight: bold; margin-bottom: 4px;">${c.name} (${c.role})</div>
            <div style="color: #94a3b8; font-size: 12px; margin-bottom: 6px;"><b>Квест:</b> ${c.quest}</div>
            <div style="color: #64748b; font-size: 11px;"><b>Ночь:</b> ${c.night}</div>
          </div>
          <div>
            <button class="copy-btn" onclick="copyUrl('${cardUrl}')">📋 Скопировать ссылку игрока</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<p>Ошибка загрузки карточек</p>';
  }
}

window.randomizeCiphers = async function() {
  try {
    await fetch('/api/admin/randomize', { method: 'POST' });
    fetchCards();
    alert('Шифры нумеров успешно рандомизированы!');
  } catch (e) {
    alert('Ошибка при перемешивании');
  }
};

window.setPhase = async function(phase) {
  await fetch('/api/admin/phase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase })
  });
  fetchState();
};

window.resetGame = async function() {
  if (confirm('Сбросить состояние игры?')) {
    await fetch('/api/admin/reset', { method: 'POST' });
    fetchState();
    fetchCards();
  }
};

window.copyUrl = function(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert('Ссылка скопирована!');
  }).catch(() => prompt('Скопируй ссылку:', url));
};

document.addEventListener('DOMContentLoaded', () => {
  fetchState();
  fetchCards();
  setInterval(fetchState, 3000);
});