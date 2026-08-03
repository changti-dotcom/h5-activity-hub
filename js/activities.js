let ALL_ACTIVITIES = [];
const activeFilters = { purpose: new Set(), special: new Set(), mechanism: new Set(), activityType: new Set() };
let searchTerm = '';
let editingActivityId = null;

// 設計目的分類基礎跟「我要找活動靈感」「我有活動靈感」統一，用同一份 GOAL_TAGS，
// 過往歷史活動這裡另外加上三個傳統業務目的分類（留存／拉新／回流），只有這個頁面有。
const ACTIVITY_PURPOSE_TAGS = [...GOAL_TAGS.map((g) => g.key), '留存', '拉新', '回流'];
const ACTIVITY_TYPE_OPTIONS = ['H5活動', '活動中心活動'];

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
  const { purpose, special, mechanism, activityType } = activeFilters;
  if (purpose.size && !(activity.purposeTags || []).some((t) => purpose.has(t))) return false;
  if (special.size && !(activity.specialTags || []).some((t) => special.has(t))) return false;
  if (mechanism.size && !(activity.mechanismTags || []).some((t) => mechanism.has(t))) return false;
  if (activityType.size && !activityType.has(activity.activityType)) return false;
  if (searchTerm) {
    const hay = `${activity.name} ${activity.description || ''} ${activity.mechanism || ''}`.toLowerCase();
    if (!hay.includes(searchTerm.toLowerCase())) return false;
  }
  return true;
}

function activityCardHtml(a) {
  const metricsBadge = metricsBadgeHtml(a.metrics);
  return `
    <div class="item-card" data-id="${a.id}">
      ${cardPhotoHtml(a.images)}
      <div class="title">${escapeHtml(a.name)}</div>
      <div class="meta">${escapeHtml(a.dateText || '日期未提供')}</div>
      <div class="desc">${escapeHtml(a.mechanism || a.description || '')}</div>
      <div class="tag-row">
        ${a.activityType ? tagChip(a.activityType, 'goal') : ''}
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
    <div class="modal-sub">${a.activityType ? escapeHtml(a.activityType) + ' · ' : ''}${escapeHtml(a.dateText || '日期未提供')}${a.createdBy ? ' · 記錄人：' + escapeHtml(a.createdBy) : ''}</div>

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
      ${metricsSectionHtml(a.metrics)}
    </div>

    ${a.referenceLink ? `<div class="detail-section"><div class="label">參考連結</div><div class="value"><a href="${escapeHtml(a.referenceLink)}" target="_blank" rel="noopener">${escapeHtml(a.referenceLink)}</a></div></div>` : ''}

    <div class="form-actions" style="justify-content:flex-start;border-top:1px solid var(--color-border);padding-top:16px;">
      <button type="button" class="btn btn-outline btn-sm manage-edit-activity-btn">✏️ 編輯</button>
    </div>
  `;
  box.querySelector('.manage-edit-activity-btn').addEventListener('click', () => openAddOrEditActivityModal(a));
  openModal('detailModal');
}

async function init() {
  ALL_ACTIVITIES = await fetchActivities();
  buildFilterChips('filterActivityType', ACTIVITY_TYPE_OPTIONS, 'activityType');
  buildFilterChips('filterPurpose', ACTIVITY_PURPOSE_TAGS, 'purpose');
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

function openAddOrEditActivityModal(activity) {
  editingActivityId = activity ? activity.id : null;
  document.getElementById('addActivityModalTitle').textContent = activity ? '編輯活動紀錄' : '新增活動紀錄';
  document.getElementById('addActivitySubmitBtn').textContent = activity ? '儲存變更' : '送出';
  const form = document.getElementById('addActivityForm');
  form.activityType.value = activity ? activity.activityType || '' : '';
  form.name.value = activity ? activity.name || '' : '';
  form.dateText.value = activity ? activity.dateText || '' : '';
  form.description.value = activity ? activity.description || '' : '';
  form.mechanism.value = activity ? activity.mechanism || '' : '';
  form.referenceLink.value = activity ? activity.referenceLink || '' : '';
  form.images.value = activity && activity.images && activity.images.length ? activity.images.join('\n') : '';
  form.createdBy.value = activity ? activity.createdBy || '' : '';
  form.visitRate.value = activity && activity.metrics && activity.metrics.visitRate != null ? activity.metrics.visitRate : '';
  form.completionRate.value = activity && activity.metrics && activity.metrics.completionRate != null ? activity.metrics.completionRate : '';
  renderChipSelect(document.getElementById('formMechanismTags'), MECHANISM_TAGS, activity ? activity.mechanismTags || [] : []);
  renderChipSelect(document.getElementById('formPurposeTags'), ACTIVITY_PURPOSE_TAGS, activity ? activity.purposeTags || [] : []);
  renderChipSelect(document.getElementById('formSpecialTags'), SPECIAL_TAG_SUGGESTIONS, activity ? activity.specialTags || [] : []);
  openModal('addActivityModal');
}

document.getElementById('openAddActivityBtn').addEventListener('click', () => openAddOrEditActivityModal(null));

document.getElementById('addActivityForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    activityType: form.activityType.value,
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
  };
  // 有填參與率／完成率其中之一才組成 metrics；兩個都空的話，新增就是「還沒有成效數據」（null），
  // 編輯則乾脆不帶 metrics 這個欄位，讓既有資料（不管是這個格式還是舊格式）維持原樣不被蓋掉。
  const visitRateVal = form.visitRate.value.trim();
  const completionRateVal = form.completionRate.value.trim();
  if (visitRateVal !== '' || completionRateVal !== '') {
    data.metrics = {};
    if (visitRateVal !== '') data.metrics.visitRate = Number(visitRateVal);
    if (completionRateVal !== '') data.metrics.completionRate = Number(completionRateVal);
  } else if (!editingActivityId) {
    data.metrics = null;
  }
  if (!data.name || !data.mechanism) return;

  const result = editingActivityId ? await updateActivity(editingActivityId, data) : await submitActivity(data);

  if (result && result.success) {
    toast(editingActivityId ? '已更新活動紀錄！' : '已新增活動紀錄' + (result.local ? '（示範模式，僅存在此瀏覽器）' : ''));
    form.reset();
    editingActivityId = null;
    closeModal('addActivityModal');
    closeModal('detailModal');
    ALL_ACTIVITIES = await fetchActivities();
    renderList();
  } else {
    toast(editingActivityId ? '更新失敗，請稍後再試' : '新增失敗，請稍後再試');
  }
});

init();
