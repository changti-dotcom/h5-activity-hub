let ALL_IDEAS = [];
const activeFilters = { purpose: new Set(), special: new Set() };
let searchTerm = '';

function collectDynamicSpecialTags(ideas) {
  const set = new Set(SPECIAL_TAG_SUGGESTIONS);
  ideas.forEach((i) => (i.specialTags || []).forEach((t) => set.add(t)));
  return [...set];
}

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
  const { purpose, special } = activeFilters;
  if (purpose.size && !(idea.purposeTags || []).some((t) => purpose.has(t))) return false;
  if (special.size && !(idea.specialTags || []).some((t) => special.has(t))) return false;
  if (searchTerm) {
    const hay = `${idea.title} ${idea.description || ''} ${idea.submittedBy || ''}`.toLowerCase();
    if (!hay.includes(searchTerm.toLowerCase())) return false;
  }
  return true;
}

function ideaCardHtml(idea) {
  return `
    <div class="item-card" data-id="${idea.id}">
      <div class="title">${escapeHtml(idea.title)}</div>
      <div class="desc">${escapeHtml(idea.description)}</div>
      <div class="tag-row">
        ${(idea.purposeTags || []).map((t) => tagChip(t, 'purpose')).join('')}
        ${(idea.specialTags || []).map((t) => tagChip(t, 'special')).join('')}
      </div>
      <div class="footer-row">
        <span class="author-badge">
          <span class="avatar-circle">${escapeHtml(initialsOf(idea.submittedBy))}</span>
          ${escapeHtml(idea.submittedBy || '匿名')}
        </span>
        <span>${formatDateShort(idea.createdAt)}</span>
      </div>
    </div>
  `;
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
  const box = document.getElementById('detailModalBox');
  box.innerHTML = `
    <button class="modal-close" onclick="closeModal('detailModal')">✕</button>
    <h2>${escapeHtml(idea.title)}</h2>
    <div class="modal-sub">
      <span class="author-badge"><span class="avatar-circle">${escapeHtml(initialsOf(idea.submittedBy))}</span>${escapeHtml(idea.submittedBy || '匿名')}</span>
      提供 · ${formatDateShort(idea.createdAt)}
    </div>

    <div class="detail-section">
      <div class="label">詳細說明</div>
      <div class="value">${escapeHtml(idea.description)}</div>
    </div>

    <div class="detail-section">
      <div class="label">設計目的</div>
      ${purposeTagsOrTodo(idea.purposeTags)}
    </div>

    <div class="detail-section">
      <div class="label">特殊需求</div>
      ${tagRow(idea.specialTags, 'special') || '（無）'}
    </div>

    ${idea.inspirationRef ? `<div class="detail-section"><div class="label">參考／靈感來源</div><div class="value">${escapeHtml(idea.inspirationRef)}</div></div>` : ''}
  `;
  openModal('detailModal');
}

async function init() {
  ALL_IDEAS = await fetchIdeas();
  ALL_IDEAS.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  buildFilterChips('filterPurpose', PURPOSE_TAGS, 'purpose');
  buildFilterChips('filterSpecial', collectDynamicSpecialTags(ALL_IDEAS), 'special');
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
  renderChipSelect(document.getElementById('formPurposeTags'), PURPOSE_TAGS, []);
  renderChipSelect(document.getElementById('formSpecialTags'), SPECIAL_TAG_SUGGESTIONS, []);
  openModal('addIdeaModal');
});

document.getElementById('addIdeaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const customTags = form.customSpecialTags.value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const data = {
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    submittedBy: form.submittedBy.value.trim(),
    purposeTags: getSelectedChips(document.getElementById('formPurposeTags')),
    specialTags: [...new Set([...getSelectedChips(document.getElementById('formSpecialTags')), ...customTags])],
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
