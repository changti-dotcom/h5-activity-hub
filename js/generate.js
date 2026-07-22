let ALL_IDEAS = [];
let activeGoal = null;

function countForGoal(key) {
  return ALL_IDEAS.filter((i) => (i.purposeTags || []).includes(key)).length;
}

function goalCardHtml(goal) {
  const active = goal.key === activeGoal ? ' active' : '';
  return `
    <div class="goal-card${active}" data-key="${escapeHtml(goal.key)}">
      <div class="icon">${goal.icon}</div>
      <div class="label">${escapeHtml(goal.key)}</div>
      <div class="count">${countForGoal(goal.key)} 則相關靈感</div>
    </div>
  `;
}

function renderGoalGrid() {
  const grid = document.getElementById('goalGrid');
  grid.innerHTML = GOAL_TAGS.map(goalCardHtml).join('');
  grid.querySelectorAll('.goal-card').forEach((card) => {
    card.addEventListener('click', () => {
      activeGoal = card.dataset.key;
      renderGoalGrid();
      renderResults();
    });
  });
}

function renderResults() {
  const area = document.getElementById('resultArea');
  if (!activeGoal) {
    area.innerHTML = `<div class="empty-state"><div class="big">🎯</div>先選一個上方的目標，看看團隊過去想過哪些對應的活動靈感。</div>`;
    return;
  }
  const matched = ALL_IDEAS.filter((i) => (i.purposeTags || []).includes(activeGoal));
  if (!matched.length) {
    area.innerHTML = `<div class="empty-state"><div class="big">🤔</div>靈感庫目前還沒有標註「${escapeHtml(activeGoal)}」的點子，去「我有活動靈感」頁面新增一個吧！</div>`;
    return;
  }
  area.innerHTML = `<div class="card-grid">${matched.map(ideaCardHtml).join('')}</div>`;
  area.querySelectorAll('.item-card').forEach((card) => {
    card.addEventListener('click', () => {
      const idea = matched.find((i) => i.id === card.dataset.id);
      if (idea) renderIdeaDetailModal(idea);
    });
  });
}

async function init() {
  ALL_IDEAS = await fetchIdeas();
  renderGoalGrid();
  renderResults();
}

init();
