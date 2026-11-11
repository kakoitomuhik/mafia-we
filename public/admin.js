const origin = window.location.origin;

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const state = await res.json();

    const badge = document.getElementById('statusBadge');
    if (badge) {
      badge.className = `badge ${state.phase}`;
      let text = 'День';
      if (state.phase === 'voting') text = 'Голосование';
      if (state.phase === 'night') text = 'Ночь';
      badge.textContent = `${text} • Раунд ${state.round}`;
    }
  } catch (err) {
    console.error('Ошибка опроса состояния:', err);
  }
}

async function fetchCards() {
  const container = document.getElementById('cardsGrid');
  try {
    const res = await fetch('/api/admin/cards');
    if (!res.ok) throw new Error('Ошибка связи с сервером');
    const cards = await res.json();

    if (!cards || cards.length === 0) {
      container.innerHTML = '<p>В базе cards.json нет карт.</p>';
      return;
    }

    container.innerHTML = cards.map(c => {
      const cardUrl = `${origin}/card.html?t=${c.token}`;
      let teamName = 'Строители Интеграла';
      if (c.team === 'resistance') teamName = 'Мефи (Сопротивление)';
      if (c.team === 'guardian') teamName = 'Хранители';

      return `
        <div class="card ${c.team}">
          <div>
            <div class="card-title">${c.name} — ${c.role}</div>
            <div class="card-meta">Фракция: <b>${teamName}</b></div>
            <div class="card-quest"><b>Цель:</b> ${c.quest || 'Не указана'}</div>
          </div>
          <div>
            <button class="copy-btn" onclick="copyCardUrl('${cardUrl}')">📋 Скопировать ссылку игрока</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p style="color: #e53e3e;">Не удалось загрузить карточки: ${err.message}</p>`;
  }
}

window.setPhase = async function(phase) {
  try {
    await fetch('/api/admin/phase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase })
    });
    fetchState();
  } catch (err) {
    alert('Не удалось изменить фазу');
  }
};

window.resetGame = async function() {
  if (confirm('Сбросить игру и все голоса?')) {
    try {
      await fetch('/api/admin/reset', { method: 'POST' });
      fetchState();
    } catch (err) {
      alert('Ошибка при сбросе');
    }
  }
};

window.copyCardUrl = function(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      alert('Ссылка игрока скопирована в буфер обмена!');
    }).catch(() => prompt('Скопируйте ссылку вручную:', url));
  } else {
    prompt('Скопируйте ссылку вручную:', url);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  fetchState();
  fetchCards();
  setInterval(fetchState, 3000);
});