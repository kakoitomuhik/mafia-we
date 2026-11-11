const params = new URLSearchParams(window.location.search);
const seat = params.get('seat');
const token = params.get('t');

let userGender = localStorage.getItem('user_gender') || null;
let currentCard = null;

// Названия ролей и целей под М и Ж
const TITLES = {
  1: { m: 'Поэт (Строитель)', f: 'Поэтесса (Строитель)' },
  2: { m: 'Агитатор (Строитель)', f: 'Агитаторша (Строитель)' },
  3: { m: 'Юрист (Строитель)', f: 'Юристка (Строитель)' },
  4: { m: 'Порядочный нумер (Строитель)', f: 'Порядочная нумер (Строитель)' },
  5: { m: 'Пацифист (Строитель)', f: 'Пацифистка (Строитель)' },
  6: { m: 'Икона сопротивления', f: 'Икона сопротивления' },
  7: { m: 'Диссидент (Неуловимый)', f: 'Диссидентка (Неуловимая)' },
  8: { m: 'Лидер сопротивления', f: 'Лидер сопротивления' },
  9: { m: 'Врач (Хранитель Иконы)', f: 'Врач (Хранительница Иконы)' },
  10: { m: 'Хранитель (Смерть лидеру)', f: 'Хранительница (Смерть лидеру)' }
};

function initGenderModal() {
  const overlay = document.getElementById('genderOverlay');
  if (!userGender) {
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
  }
}

window.selectGender = function(g) {
  userGender = g;
  localStorage.setItem('user_gender', g);
  document.getElementById('genderOverlay').style.display = 'none';
  renderCardData();
};

window.openGenderModal = function() {
  document.getElementById('genderOverlay').style.display = 'flex';
};

async function loadCard() {
  try {
    const query = seat ? `seat=${seat}` : `t=${token}`;
    const res = await fetch(`/api/cards?${query}`);
    if (!res.ok) throw new Error('Не найдено');
    currentCard = await res.json();
    renderCardData();
  } catch (err) {
    document.getElementById('pName').textContent = 'Нумер не найден';
  }
}

function renderCardData() {
  if (!currentCard) return;
  const g = userGender || 'm';

  const titleObj = TITLES[currentCard.id];
  const roleName = titleObj ? titleObj[g] : currentCard.role;

  document.getElementById('seatBadge').textContent = `МЕСТО № ${currentCard.seat || currentCard.id} • ШИФР: ${currentCard.cipher || 'Д-503'}`;
  document.getElementById('pName').textContent = `${currentCard.name} [${g === 'f' ? '♀' : '♂'}]`;
  document.getElementById('pRole').textContent = `Роль: ${roleName}`;
  document.getElementById('pQuote').textContent = currentCard.quote;
  document.getElementById('pQuest').textContent = currentCard.quest;
  document.getElementById('pNight').textContent = currentCard.night;

  // Показ плашки казнённого
  const deadBanner = document.getElementById('deadBanner');
  if (deadBanner) {
    deadBanner.style.display = currentCard.alive ? 'none' : 'block';
  }

  // Определение аватара: image_m или image_f
  const baseImg = currentCard.image.replace(/_[mf]$/, '');
  const imgEl = document.getElementById('avatarImg');
  const targetSrc = `/${baseImg}_${g}.png`;

  imgEl.src = targetSrc;
  imgEl.onerror = () => {
    // Если .png нет, пробуем .jpg или запасную мужскую версию
    imgEl.src = `/${baseImg}_${g}.jpg`;
    imgEl.onerror = () => {
      imgEl.src = `/${baseImg}_m.png`;
    };
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initGenderModal();
  loadCard();
  setInterval(loadCard, 3000);
});