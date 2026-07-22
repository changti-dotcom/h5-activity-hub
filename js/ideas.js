let ALL_IDEAS = [];
const activeFilters = { purpose: new Set() };
let searchTerm = '';

const IDEA_PURPOSE_TAGS = GOAL_TAGS.map((g) => g.key);

function buildFilterChips(containerId, tags, filterKey) {
  const container = document.getElementById(containerId);
  container.innerHTML = tags
    .map((t) => `<span class="chip" data-value="${escapeHtml(t)}">${escapeHtml(t)}</span>`)
    .join('');
  container.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      const set = activeFilters[filterKey];
      if (chip.classList.contains('active')) set.add(chip.dataset.value);
      else set.delete(chip.dataset.value);
      renderList();
    });
  });
}

function matchesFilters(idea) {
  const { purpose } = activeFilters;
  if (purpose.size && !(idea.purposeTags || []).some((t) => purpose.has(t))) return false;
  if (searchTerm) {
    const hay = `${idea.title} ${idea.description || ''} ${idea.submittedBy || ''}`.toLowerCase();
    if (!hay.includes(searchTerm.toLowerCase())) return false;
  }
  return true;
}

function renderList() {
  const filtered = ALL_IDEAS.filter(matchesFilters);
  const grid = document.getElementById('cardGrid');
  document.getElementById('listMeta').textContent = `共 ${filtered.length} 則點子（總計 ${ALL_IDEAS.length} 則）`;
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="big">💡</div>還沒有符合條件的點子，換個篩選條件，或成為第一個提供想法的人！</div>`;
    return;
  }
  grid.innerHTML = filtered.map(ideaCardHtml).join('');
  grid.querySelectorAll('.item-card').forEach((card) => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

function openDetail(id) {
  const idea = ALL_IDEAS.find((x) => x.id === id);
  if (!idea) return;
  renderIdeaDetailModal(idea);
}

async function init() {
  ALL_IDEAS = await fetchIdeas();
  ALL_IDEAS.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  buildFilterChips('filterPurpose', IDEA_PURPOSE_TAGS, 'purpose');
  renderList();

  document.getElementById('searchInput').addEventListener(
    'input',
    debounce((e) => {
      searchTerm = e.target.value.trim();
      renderList();
    }, 200)
  );
}

document.getElementById('openAddIdeaBtn').addEventListener('click', () => {
  renderChipSelect(document.getElementById('formPurposeTags'), IDEA_PURPOSE_TAGS, []);
  openModal('addIdeaModal');
});

document.getElementById('addIdeaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    submittedBy: form.submittedBy.value.trim(),
    images: form.imageUrl.value.trim() ? [form.imageUrl.value.trim()] : [],
    purposeTags: getSelectedChips(document.getElementById('formPurposeTags')),
    inspirationRef: form.inspirationRef.value.trim(),
  };
  if (!data.title || !data.submittedBy) return;
  const result = await submitIdea(data);
  if (result && result.success) {
    toast('已新增點子，感謝分享！' + (result.local ? '（示範模式，僅存在此瀏覽器）' : ''));
    form.reset();
    closeModal('addIdeaModal');
    ALL_IDEAS = await fetchIdeas();
    ALL_IDEAS.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    renderList();
  } else {
    toast('新增失敗，請稍後再試');
  }
});

init();
