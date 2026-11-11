document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t');

  const cardBox = document.getElementById('cardBox');
  const phaseEl = document.getElementById('gamePhase');
  const imgEl = document.getElementById('playerImage');
  const nameEl = document.getElementById('playerName');
  const roleEl = document.getElementById('playerRole');
  const descEl = document.getElementById('playerDesc');
  const questEl = document.getElementById('playerQuest');
  const nightEl = document.getElementById('playerNight');
  const quoteEl = document.getElementById('playerQuote');

  if (!token) {
    cardBox.innerHTML = `
      <div class="error-box">
        <h3>ОШИБКА ДОСТУПА</h3>
        <p>Токен гражданина не указан в строке адреса.</p>
        <p style="margin-top: 8px; font-size: 12px; color: #a0aec0;">Ссылка должна иметь вид: /card.html?t=ВАШ_ТОКЕН</p>
      </div>
    `;
    return;
  }

  async function loadCard() {
    try {
      const res = await fetch(`/api/cards?t=${encodeURIComponent(token)}`);
      
      // Проверяем Content-Type: если сервер вернул HTML вместо JSON, не парсим его
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Сервер вернул ответ не в формате JSON (${res.status})`);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Не удалось найти нумер');
      }

      // Обновляем страницу данными
      nameEl.textContent = data.name;
      roleEl.textContent = data.role;
      descEl.textContent = data.description || 'Нет данных';
      questEl.textContent = data.quest || 'Следовать всеобщему благу';
      nightEl.textContent = data.night || 'Сон по расписанию Часовой Скрижали';
      quoteEl.textContent = data.quote ? `«${data.quote}»` : '';

      if (imgEl && data.image) {
        imgEl.src = `/${data.image}.png`;
        imgEl.onerror = () => { imgEl.src = '/poet.png'; };
      }

      if (phaseEl) {
        let phaseRu = 'ДЕНЬ';
        if (data.gamePhase === 'voting') phaseRu = 'ГОЛОСОВАНИЕ';
        if (data.gamePhase === 'night') phaseRu = 'НОЧЬ';
        phaseEl.textContent = `СКРИЖАЛЬ: ${phaseRu} • РАУНД ${data.round}`;
      }
    } catch (err) {
      console.error(err);
      descEl.innerHTML = `<span style="color: #fc8181;">${err.message}</span>`;
    }
  }

  await loadCard();
  setInterval(loadCard, 3500);
});