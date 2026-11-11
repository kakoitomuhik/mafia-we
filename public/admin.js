// Автоматически берем текущий хост и протокол браузера (подходит и для localhost, и для Нитрана)
const baseUrl = window.location.origin;

async function updateState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const state = await res.json();
    
    const badge = document.getElementById('statusBadge');
    if (badge) {
      badge.className = `badge ${state.phase}`;
      let phaseName = 'День';
      if (state.phase === 'night') phaseName = 'Ночь';
      if (state.phase === 'voting') phaseName = 'Голосование';
      if (state.phase === 'ended') phaseName = 'Конец';
      badge.textContent = `Фаза: ${phaseName} | Раунд ${state.round}`;
    }
  } catch (err) {
    console.error('Ошибка обновления состояния:', err);
  }
}

async function loadCards() {
  try {
    const res = await fetch('/api/admin/cards');
    if (!res.ok) throw new Error('Не удалось получить список карт');
    const cards = await res.json();

    const list = document.getElementById('playersList');
    if (!list) return;

    if (cards.length === 0) {
      list.innerHTML = '<p>Карты не найдены. Проверьте public/data/cards.json</p>';
      return;
    }

    list.innerHTML = cards.map(c => {
      const playerUrl = `${baseUrl}/card.html?t=${c.token}`;
      const teamClass = c.team === 'mafia' ? 'mafia' : 'peaceful';
      const teamName = c.team === 'mafia' ? 'Мафия' : 'Мирные';

      return `
        <div class="player-card ${teamClass}">
          <strong>${c.name}</strong>
          <div><b>Роль:</b> ${c.role} (${teamName})</div>
          <div class="token-box">
            <a href="${playerUrl}" target="_blank">Открыть карту</a>
          </div>
          <button class="copy-btn" onclick="copyLink('${playerUrl}')">📋 Скопировать ссылку игрока</button>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    document.getElementById('playersList').innerHTML = `<p style="color: #e53e3e;">Ошибка: ${err.message}</p>`;
  }
}

window.setPhase = async function(phase) {
  try {
    const res = await fetch('/api/admin/phase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase })
    });
    if (res.ok) updateState();
  } catch (e) {
    alert('Ошибка при смене фазы');
  }
};

window.resetGame = async function() {
  if (confirm('Сбросить состояние игры и все голоса?')) {
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      if (res.ok) {
        updateState();
        loadCards();
      }
    } catch (e) {
      alert('Ошибка при сбросе');
    }
  }
};

window.copyLink = function(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert('Ссылка скопирована в буфер обмена!');
  }).catch(() => {
    prompt('Скопируйте ссылку вручную:', url);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  updateState();
  loadCards();
  setInterval(updateState, 3000);
});