document.addEventListener('DOMContentLoaded', () => {
  const cardsContainer = document.getElementById('cardsContainer') || document.body;
  const phaseIndicator = document.getElementById('currentPhase');

  // Загрузка состояния
  async function updateStatus() {
    try {
      const res = await fetch('/api/state');
      const state = await res.json();
      if (phaseIndicator) {
        phaseIndicator.textContent = `Текущая фаза: ${state.phase.toUpperCase()} | Раунд: ${state.round}`;
      }
    } catch (e) {
      console.error('Ошибка опроса состояния:', e);
    }
  }

  // Загрузка списка карт и ссылок
  async function loadAdminCards() {
    try {
      const res = await fetch('/api/admin/cards');
      const cards = await res.json();
      
      const listEl = document.getElementById('adminCardsList');
      if (listEl) {
        listEl.innerHTML = cards.map(c => `
          <div style="border: 1px solid #444; padding: 10px; margin: 8px 0; border-radius: 6px;">
            <strong>${c.name}</strong> — ${c.role} (${c.team})<br/>
            Ссылка игрока: <a href="/card.html?t=${c.token}" target="_blank">/card.html?t=${c.token}</a>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Ошибка загрузки карт админки:', err);
    }
  }

  // Экспорт функций смены фаз для кнопок в admin.html
  window.setGamePhase = async function(phase) {
    await fetch('/api/admin/phase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase })
    });
    updateStatus();
  };

  window.resetGame = async function() {
    if (confirm('Вы уверены, что хотите сбросить игру?')) {
      await fetch('/api/admin/reset', { method: 'POST' });
      updateStatus();
    }
  };

  loadAdminCards();
  updateStatus();
  setInterval(updateStatus, 3000);
});