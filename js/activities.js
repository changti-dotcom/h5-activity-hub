let ALL_ACTIVITIES = [];
const activeFilters = { purpose: new Set(), special: new Set(), mechanism: new Set() };
let searchTerm = '';

function collectDynamicSpecialTags(activities) {
  const set = new Set(SPECIAL_TAG_SUGGESTIONS);
  activities.forEach((a) => (a.specialTags || []).forEach((t) => set.add(t)));
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

function matchesFilters(activity) {
  const { purpose, special, mechanism } = activeFilters;
  if (purpose.size && !(activity.purposeTags || []).some((t) => purpose.has(t))) return false;
  if (special.size && !(activity.specialTags || []).some((t) => special.has(t))) return false;
  if (mechanism.size && !(activity.mechanismTags || []).some((t) => mechanism.has(t))) return false;
  if (searchTerm) {
    const hay = `${activity.name} ${activity.description || ''} ${activity.mechanism || ''}`.toLowerCase();
    if (!hay.includes(searchTerm.toLowerCase())) return false;
  }
  return true;
}

function activityCardHtml(a) {
  const metricsBadge = a.metrics
    ? `<span class="chip tag-readonly" style="background:#eaf7ee;color:#1e7a3c;border-color:#cdeed6;">已有成效數據</span>`
    : `<span class="chip tag-readonly tag-todo">成效待補充</span>`;
  return `
    <div class="item-card" data-id="${a.id}">
      ${cardPhotoHtml(a.images)}
      <div class="title">${escapeHtml(a.name)}</div>
      <div class="meta">${escapeHtml(a.dateText || '日期未提供')}</div>
      <div class="desc">${escapeHtml(a.mechanism || a.description || '')}</div>
      <div class="tag-row">
        ${(a.mechanismTags || []).map((t) => tagChip(t, 'mechanism')).join('')}
        ${(a.specialTags || []).map((t) => tagChip(t, 'special')).join('')}
      </div>
      <div class="footer-row">
        <span>${a.purposeTags && a.purposeTags.length ? escapeHtml(a.purposeTags.join(' / ')) : '目的待補充'}</span>
        ${metricsBadge}
      </div>
    </div>
  `;
}

function renderList() {
  const filtered = ALL_ACTIVITIES.filter(matchesFilters);
  const grid = document.getElementById('cardGrid');
  document.getElementById('listMeta').textContent = `共 ${filtered.length} 筆活動（總計 ${ALL_ACTIVITIES.length} 筆）`;
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="big">🔍</div>找不到符合條件的活動，試試調整篩選條件。</div>`;
    return;
  }
  grid.innerHTML = filtered.map(activityCardHtml).join('');
  grid.querySelectorAll('.item-card').forEach((card) => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

function openDetail(id) {
  const a = ALL_ACTIVITIES.find((x) => x.id === id);
  if (!a) return;
  const box = document.getElementById('detailModalBox');
  box.innerHTML = `
    <button class="modal-close" onclick="closeModal('detailModal')">✕</button>
    <h2>${escapeHtml(a.name)}</h2>
    <div class="modal-sub">${escapeHtml(a.dateText || '日期未提供')}${a.createdBy ? ' · 記錄人：' + escapeHtml(a.createdBy) : ''}</div>

    <div class="detail-section">
      <div class="label">活動照片</div>
      ${photoGalleryHtml(a.images)}
    </div>

    <div class="detail-section">
      <div class="label">遊戲機制</div>
      <div class="value">${escapeHtml(a.mechanism || '（尚未填寫）')}</div>
    </div>

    ${a.description ? `<div class="detail-section"><div class="label">活動說明 / 獎勵內容</div><div class="value">${escapeHtml(a.description)}</div></div>` : ''}

    <div class="detail-section">
      <div class="label">遊戲類型</div>
      ${tagRow(a.mechanismTags, 'mechanism') || '（未分類）'}
    </div>

    <div class="detail-section">
      <div class="label">設計目的</div>
      ${purposeTagsOrTodo(a.purposeTags)}
    </div>

    <div class="detail-section">
      <div class="label">特殊需求</div>
      ${tagRow(a.specialTags, 'special') || '（無）'}
    </div>

    <div class="detail-section">
      <div class="label">成效數據</div>
      ${a.metrics
        ? `<div class="value">${escapeHtml(a.metrics.summary || '')}</div>`
        : `<div class="metrics-box">📊 成效數據待補充——待營運團隊整理完成後會更新此區塊。</div>`}
    </div>

    ${a.referenceLink ? `<div class="detail-section"><div class="label">參考連結</div><div class="value"><a href="${escapeHtml(a.referenceLink)}" target="_blank" rel="noopener">${escapeHtml(a.referenceLink)}</a></div></div>` : ''}
  `;
  openModal('detailModal');
}

async function init() {
  ALL_ACTIVITIES = await fetchActivities();
  buildFilterChips('filterPurpose', PURPOSE_TAGS, 'purpose');
  buildFilterChips('filterSpecial', collectDynamicSpecialTags(ALL_ACTIVITIES), 'special');
  buildFilterChips('filterMechanism', MECHANISM_TAGS, 'mechanism');
  renderList();

  document.getElementById('searchInput').addEventListener(
    'input',
    debounce((e) => {
      searchTerm = e.target.value.trim();
      renderList();
    }, 200)
  );
}

document.getElementById('openAddActivityBtn').addEventListener('click', () => {
  renderChipSelect(document.getElementById('formMechanismTags'), MECHANISM_TAGS, []);
  renderChipSelect(document.getElementById('formPurposeTags'), PURPOSE_TAGS, []);
  renderChipSelect(document.getElementById('formSpecialTags'), SPECIAL_TAG_SUGGESTIONS, []);
  openModal('addActivityModal');
});

document.getElementById('addActivityForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    name: form.name.value.trim(),
    dateText: form.dateText.value.trim(),
    description: form.description.value.trim(),
    mechanism: form.mechanism.value.trim(),
    mechanismTags: getSelectedChips(document.getElementById('formMechanismTags')),
    purposeTags: getSelectedChips(document.getElementById('formPurposeTags')),
    specialTags: getSelectedChips(document.getElementById('formSpecialTags')),
    referenceLink: form.referenceLink.value.trim(),
    images: form.images.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    createdBy: form.createdBy.value.trim() || '匿名',
    metrics: null,
  };
  if (!data.name || !data.mechanism) return;
  const result = await submitActivity(data);
  if (result && result.success) {
    toast('已新增活動紀錄' + (result.local ? '（示範模式，僅存在此瀏覽器）' : ''));
    form.reset();
    closeModal('addActivityModal');
    ALL_ACTIVITIES = await fetchActivities();
    renderList();
  } else {
    toast('新增失敗，請稍後再試');
  }
});

init();
