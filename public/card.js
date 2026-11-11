document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('t');

  const roleEl = document.getElementById('roleName');
  const nameEl = document.getElementById('playerName');
  const descEl = document.getElementById('roleDescription');
  const quoteEl = document.getElementById('roleQuote');
  const imgEl = document.getElementById('roleImage');
  const phaseEl = document.getElementById('gamePhase');

  if (!token) {
    if (descEl) descEl.textContent = 'Ошибка: токен не найден в адресе. Ссылка должна быть вида ?t=код';
    return;
  }

  async function loadData() {
    try {
      const res = await fetch(`/api/cards?t=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Ошибка загрузки карточки');
      }

      const card = await res.json();

      if (nameEl) nameEl.textContent = card.name;
      if (roleEl) {
        roleEl.textContent = card.role;
        roleEl.style.color = card.team === 'mafia' ? '#e53e3e' : '#38a169';
      }
      if (descEl) descEl.textContent = card.description;
      if (quoteEl) quoteEl.textContent = card.quote ? `«${card.quote}»` : '';

      if (phaseEl) {
        let phaseRu = 'День';
        if (card.gamePhase === 'night') phaseRu = 'Ночь';
        if (card.gamePhase === 'voting') phaseRu = 'Голосование';
        phaseEl.textContent = `Фаза: ${phaseRu} (Раунд ${card.round})`;
      }

      if (imgEl && card.image) {
        imgEl.src = `/${card.image}.png`;
        imgEl.onerror = () => { imgEl.src = '/poet.png'; };
      }
    } catch (e) {
      if (descEl) descEl.textContent = e.message;
    }
  }

  await loadData();
  setInterval(loadData, 3000);
});