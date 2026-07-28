// ============================================================================
// 正式共用版（Apps Script webapp）的共用前端程式
// ----------------------------------------------------------------------------
// 這支檔案由 GitHub Pages 提供（https://changti-dotcom.github.io/h5-activity-hub/webapp-shared.js），
// 各 Apps Script 頁面用 <script src="..."> 載入。
//
// 為什麼要放外部：Apps Script 服務 HtmlService 頁面時，會處理「inline <script>」字串裡
// 的 <a href>／<img src> 等標籤與屬性，導致 JS 語法錯誤。改成外部 .js 後，Apps Script
// 不會碰這支檔案，就不會再壞掉（示範版一直正常就是因為 JS 都在外部 js/*.js）。
//
// 資料存取一律透過 google.script.run 呼叫 Code.gs 的伺服器函式（不是 fetch()）。
// 頁面用 <body data-page="index|generate|ideas|hotideas|activities"> 指定要跑哪一段邏輯。
// ============================================================================

// ---------- 標籤／目標分類 ----------
var PURPOSE_TAGS = ['拉新', '回流', '留存', '付費', '版本導流', '品牌口碑'];

var SPECIAL_TAG_SUGGESTIONS = [
  '時事熱點', '節慶檔期', 'IP聯動', '週年慶', '新版本上市',
  '電競賽事聯動', '老玩家回歸', '低開發成本', '需搭配抽卡機制',
];

var MECHANISM_TAGS = [
  '益智消除', '反應操作', '心理測驗', '經營模擬', '任務養成',
  '抽獎機率', '社交邀請', '陣營競賽', '劇情回顧', '音樂節奏', '其他',
];

var GOAL_TAGS = [
  { key: '提升主要模式時長', icon: '⚔️' },
  { key: '提升其他模式時長', icon: '🎮' },
  { key: '提升非對局在線時長', icon: '🕒' },
  { key: '提升登入率', icon: '📲' },
];

// ---------- 共用 UI 輔助函式 ----------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tagChip(text, variant, opts) {
  opts = opts || {};
  var cls = 'chip tag-readonly ' + (variant ? 'tag-' + variant : '');
  return '<span class="' + cls + '"' + (opts.title ? ' title="' + escapeHtml(opts.title) + '"' : '') + '>' + escapeHtml(text) + '</span>';
}

function tagRow(tags, variant) {
  if (!tags || !tags.length) return '';
  return '<div class="tag-row">' + tags.map(function (t) { return tagChip(t, variant); }).join('') + '</div>';
}

function purposeTagsOrTodo(tags) {
  if (tags && tags.length) return tagRow(tags, 'purpose');
  return tagChip('設計目的待補充', 'todo');
}

// Google Drive「分享連結」會自動轉成 Google 官方縮圖端點，方便直接當圖片顯示。
function normalizeImageUrl(url) {
  if (!url) return url;
  var trimmed = String(url).trim();
  if (trimmed.indexOf('drive.google.com') === -1 || trimmed.indexOf('/thumbnail') !== -1) return trimmed;
  var fileMatch = trimmed.match(/\/file\/d\/([^/]+)/);
  var idParamMatch = trimmed.match(/[?&]id=([^&]+)/);
  var fileId = fileMatch ? fileMatch[1] : idParamMatch ? idParamMatch[1] : null;
  return fileId ? 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000' : trimmed;
}

function demoLinkHtml(demoUrl) {
  if (!demoUrl) return '';
  return '<a href="' + escapeHtml(demoUrl) + '" target="_blank" rel="noopener" class="demo-link">▶ 開啟 Demo 網頁</a>';
}

function attachmentListHtml(attachments) {
  if (!attachments || !attachments.length) return '';
  return '<div class="attachment-list">' + attachments.map(function (url, i) {
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="attachment-link">📎 附件 ' + (i + 1) + '</a>';
  }).join('') + '</div>';
}

function cardPhotoHtml(images) {
  if (images && images.length) {
    return '<div class="card-photo"><img src="' + escapeHtml(normalizeImageUrl(images[0])) + '" alt="" loading="lazy" onerror="this.closest(\'.card-photo\').classList.add(\'img-error\')"></div>';
  }
  return '<div class="card-photo photo-placeholder"><span>🖼️ 尚無照片</span></div>';
}

function photoGalleryHtml(images) {
  if (!images || !images.length) {
    return '<div class="photo-box">🖼️ 照片待補充——之後有活動截圖或素材可以補在這裡。</div>';
  }
  return '<div class="photo-gallery">' + images.map(function (url) {
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="photo-gallery-item"><img src="' + escapeHtml(normalizeImageUrl(url)) + '" alt="" loading="lazy"></a>';
  }).join('') + '</div>';
}

var METRIC_THRESHOLDS = {
  visitRate: { high: 40, mid: 25 },
  completionRate: { high: 30, mid: 15 },
};

function metricTier(value, kind) {
  var t = METRIC_THRESHOLDS[kind];
  if (value >= t.high) return { label: '表現優異', cls: 'metric-high' };
  if (value >= t.mid) return { label: '表現中等', cls: 'metric-mid' };
  return { label: '待加強', cls: 'metric-low' };
}

function initialsOf(name) {
  if (!name) return '?';
  return name.trim().slice(0, 1).toUpperCase();
}

function formatDateShort(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
}

function debounce(fn, delay) {
  var timer = null;
  return function () {
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(null, args); }, delay || 250);
  };
}

function toast(msg) {
  var el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
}

function renderChipSelect(container, tags, selected) {
  container.innerHTML = tags.map(function (t) {
    return '<span class="chip" data-value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</span>';
  }).join('');
  container.querySelectorAll('.chip').forEach(function (chip) {
    if (selected.indexOf(chip.dataset.value) !== -1) chip.classList.add('active');
    chip.addEventListener('click', function () { chip.classList.toggle('active'); });
  });
}

function getSelectedChips(container) {
  return [].slice.call(container.querySelectorAll('.chip.active')).map(function (c) { return c.dataset.value; });
}

function ideaCardHtml(idea) {
  return '' +
    '<div class="item-card" data-id="' + escapeHtml(idea.id) + '">' +
      cardPhotoHtml(idea.images) +
      '<div class="title">' + escapeHtml(idea.title) + '</div>' +
      '<div class="desc">' + escapeHtml(idea.description) + '</div>' +
      '<div class="tag-row">' +
        (idea.purposeTags || []).map(function (t) { return tagChip(t, 'purpose'); }).join('') +
        (idea.demoUrl ? '<span class="demo-badge">🎮 有 Demo</span>' : '') +
      '</div>' +
      '<div class="footer-row">' +
        '<span class="author-badge">' +
          '<span class="avatar-circle">' + escapeHtml(initialsOf(idea.submittedBy)) + '</span>' +
          escapeHtml(idea.submittedBy || '匿名') +
        '</span>' +
        '<span>' + (idea.attachments && idea.attachments.length ? '📎 ' + idea.attachments.length + '　' : '') + formatDateShort(idea.createdAt) + '</span>' +
      '</div>' +
    '</div>';
}

function renderIdeaDetailModal(idea, opts) {
  opts = opts || {};
  var box = document.getElementById('detailModalBox');
  box.innerHTML = '' +
    '<button class="modal-close" onclick="closeModal(\'detailModal\')">✕</button>' +
    '<h2>' + escapeHtml(idea.title) + '</h2>' +
    '<div class="modal-sub">' +
      '<span class="author-badge"><span class="avatar-circle">' + escapeHtml(initialsOf(idea.submittedBy)) + '</span>' + escapeHtml(idea.submittedBy || '匿名') + '</span>' +
      ' 提供 · ' + formatDateShort(idea.createdAt) +
    '</div>' +
    '<div class="detail-section"><div class="label">示意圖／Demo 照片</div>' + photoGalleryHtml(idea.images) + '</div>' +
    (idea.demoUrl ? '<div class="detail-section"><div class="label">互動 Demo</div>' + demoLinkHtml(idea.demoUrl) + '</div>' : '') +
    '<div class="detail-section"><div class="label">詳細說明</div><div class="value">' + escapeHtml(idea.description) + '</div></div>' +
    '<div class="detail-section"><div class="label">設計目的</div>' + purposeTagsOrTodo(idea.purposeTags) + '</div>' +
    (idea.inspirationRef ? '<div class="detail-section"><div class="label">參考／靈感來源</div><div class="value">' + escapeHtml(idea.inspirationRef) + '</div></div>' : '') +
    (idea.attachments && idea.attachments.length ? '<div class="detail-section"><div class="label">附件</div>' + attachmentListHtml(idea.attachments) + '</div>' : '') +
    (opts.manageActions ?
      '<div class="form-actions" style="justify-content:flex-start;border-top:1px solid var(--color-border);padding-top:16px;">' +
        '<button type="button" class="btn btn-outline btn-sm manage-edit-btn" data-id="' + escapeHtml(idea.id) + '">✏️ 編輯</button>' +
        '<button type="button" class="btn btn-outline btn-sm manage-delete-btn" data-id="' + escapeHtml(idea.id) + '" style="color:var(--color-danger);border-color:#ffc7ca;">🗑️ 刪除</button>' +
      '</div>' : '');
  openModal('detailModal');
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', function (e) {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ---------- 資料存取層（google.script.run） ----------
function callServer(fnName, payload) {
  return new Promise(function (resolve, reject) {
    var runner = google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(function (err) { reject(err); });
    if (payload === undefined) runner[fnName]();
    else runner[fnName](payload);
  });
}

function fetchActivities() { return callServer('getActivitiesForClient').then(function (r) { return Array.isArray(r) ? r : []; }); }
function submitActivity(data) { return callServer('addActivityForClient', data); }

function fetchIdeas() { return callServer('getIdeasForClient').then(function (r) { return Array.isArray(r) ? r : []; }); }
function submitIdea(data) { return callServer('addIdeaForClient', data); }
function updateIdea(id, data) { return callServer('updateIdeaForClient', Object.assign({ id: id }, data)); }
function deleteIdea(id) { return callServer('deleteIdeaForClient', id); }

function fetchHotIdeas() { return callServer('getHotIdeasForClient').then(function (r) { return Array.isArray(r) ? r : []; }); }
function submitHotIdea(data) { return callServer('addHotIdeaForClient', data); }
function updateHotIdea(id, data) { return callServer('updateHotIdeaForClient', Object.assign({ id: id }, data)); }
function deleteHotIdea(id) { return callServer('deleteHotIdeaForClient', id); }

// ============================================================================
// 各頁面邏輯
// ============================================================================

// ---------- 首頁：統計數字 ----------
function initIndex() {
  Promise.all([fetchActivities(), fetchIdeas(), fetchHotIdeas()]).then(function (res) {
    var activities = res[0], ideas = res[1], hotIdeas = res[2];
    var mechanismSet = {};
    var missingMetrics = 0;
    activities.forEach(function (a) {
      (a.mechanismTags || []).forEach(function (t) { mechanismSet[t] = 1; });
      if (!a.metrics) missingMetrics += 1;
    });
    var nums = document.querySelectorAll('#statsRow .num');
    if (nums[0]) nums[0].textContent = activities.length;
    if (nums[1]) nums[1].textContent = ideas.length;
    if (nums[2]) nums[2].textContent = hotIdeas.length;
    if (nums[3]) nums[3].textContent = Object.keys(mechanismSet).length;
    if (nums[4]) nums[4].textContent = missingMetrics;
  }).catch(function (e) { console.error(e); });
}

// ---------- 我要找活動靈感：依目標篩選靈感庫 ----------
function initGenerate() {
  var ALL_IDEAS = [];
  var activeGoal = null;

  function countForGoal(key) {
    return ALL_IDEAS.filter(function (i) { return (i.purposeTags || []).indexOf(key) !== -1; }).length;
  }
  function goalCardHtml(goal) {
    var active = goal.key === activeGoal ? ' active' : '';
    return '<div class="goal-card' + active + '" data-key="' + escapeHtml(goal.key) + '">' +
      '<div class="icon">' + goal.icon + '</div>' +
      '<div class="label">' + escapeHtml(goal.key) + '</div>' +
      '<div class="count">' + countForGoal(goal.key) + ' 則相關靈感</div>' +
    '</div>';
  }
  function renderGoalGrid() {
    var grid = document.getElementById('goalGrid');
    grid.innerHTML = GOAL_TAGS.map(goalCardHtml).join('');
    grid.querySelectorAll('.goal-card').forEach(function (card) {
      card.addEventListener('click', function () {
        activeGoal = card.dataset.key;
        renderGoalGrid();
        renderResults();
      });
    });
  }
  function renderResults() {
    var area = document.getElementById('resultArea');
    if (!activeGoal) {
      area.innerHTML = '<div class="empty-state"><div class="big">🎯</div>先選一個上方的目標，看看團隊過去想過哪些對應的活動靈感。</div>';
      return;
    }
    var matched = ALL_IDEAS.filter(function (i) { return (i.purposeTags || []).indexOf(activeGoal) !== -1; });
    if (!matched.length) {
      area.innerHTML = '<div class="empty-state"><div class="big">🤔</div>靈感庫目前還沒有標註「' + escapeHtml(activeGoal) + '」的點子，去「我有H5活動靈感」頁面新增一個吧！</div>';
      return;
    }
    area.innerHTML = '<div class="card-grid">' + matched.map(ideaCardHtml).join('') + '</div>';
    area.querySelectorAll('.item-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var idea = matched.find(function (i) { return i.id === card.dataset.id; });
        if (idea) renderIdeaDetailModal(idea);
      });
    });
  }

  fetchIdeas().then(function (list) {
    ALL_IDEAS = list;
    renderGoalGrid();
    renderResults();
  });
}

// ---------- 我有H5活動靈感 / 我有熱點活動靈感（共用） ----------
// kind: 'ideas' 或 'hotIdeas'
function initIdeasPage(kind) {
  var API = kind === 'hotIdeas'
    ? { fetch: fetchHotIdeas, submit: submitHotIdea, update: updateHotIdea, remove: deleteHotIdea }
    : { fetch: fetchIdeas, submit: submitIdea, update: updateIdea, remove: deleteIdea };

  var ALL_IDEAS = [];
  var activeFilters = { purpose: {} };
  var searchTerm = '';
  var editingIdeaId = null;
  var IDEA_PURPOSE_TAGS = GOAL_TAGS.map(function (g) { return g.key; });

  function buildFilterChips(containerId, tags, filterKey) {
    var container = document.getElementById(containerId);
    container.innerHTML = tags.map(function (t) {
      return '<span class="chip" data-value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</span>';
    }).join('');
    container.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        chip.classList.toggle('active');
        if (chip.classList.contains('active')) activeFilters[filterKey][chip.dataset.value] = 1;
        else delete activeFilters[filterKey][chip.dataset.value];
        renderList();
      });
    });
  }

  function matchesFilters(idea) {
    var purposeKeys = Object.keys(activeFilters.purpose);
    if (purposeKeys.length && !(idea.purposeTags || []).some(function (t) { return activeFilters.purpose[t]; })) return false;
    if (searchTerm) {
      var hay = (idea.title + ' ' + (idea.description || '') + ' ' + (idea.submittedBy || '')).toLowerCase();
      if (hay.indexOf(searchTerm.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function renderList() {
    var filtered = ALL_IDEAS.filter(matchesFilters);
    var grid = document.getElementById('cardGrid');
    document.getElementById('listMeta').textContent = '共 ' + filtered.length + ' 則點子（總計 ' + ALL_IDEAS.length + ' 則）';
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="big">💡</div>還沒有符合條件的點子，換個篩選條件，或成為第一個提供想法的人！</div>';
      return;
    }
    grid.innerHTML = filtered.map(ideaCardHtml).join('');
    grid.querySelectorAll('.item-card').forEach(function (card) {
      card.addEventListener('click', function () { openDetail(card.dataset.id); });
    });
  }

  function reloadIdeas() {
    return API.fetch().then(function (list) {
      ALL_IDEAS = list.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
      renderList();
    });
  }

  function openDetail(id) {
    var idea = ALL_IDEAS.find(function (x) { return x.id === id; });
    if (!idea) return;
    renderIdeaDetailModal(idea, { manageActions: true });
    var box = document.getElementById('detailModalBox');
    var editBtn = box.querySelector('.manage-edit-btn');
    var deleteBtn = box.querySelector('.manage-delete-btn');
    if (editBtn) editBtn.addEventListener('click', function () { openAddOrEditModal(idea); });
    if (deleteBtn) deleteBtn.addEventListener('click', function () { handleDeleteIdea(idea); });
  }

  function openAddOrEditModal(idea) {
    editingIdeaId = idea ? idea.id : null;
    document.getElementById('addIdeaModalTitle').textContent = idea ? '編輯點子' : '新增點子';
    document.getElementById('addIdeaSubmitBtn').textContent = idea ? '儲存變更' : '送出';
    var form = document.getElementById('addIdeaForm');
    form.title.value = idea ? idea.title || '' : '';
    form.description.value = idea ? idea.description || '' : '';
    form.submittedBy.value = idea ? idea.submittedBy || '' : '';
    form.imageUrl.value = idea && idea.images && idea.images[0] ? idea.images[0] : '';
    form.demoUrl.value = idea ? idea.demoUrl || '' : '';
    form.attachments.value = idea && idea.attachments && idea.attachments.length ? idea.attachments.join('\n') : '';
    form.inspirationRef.value = idea ? idea.inspirationRef || '' : '';
    renderChipSelect(document.getElementById('formPurposeTags'), IDEA_PURPOSE_TAGS, idea ? idea.purposeTags || [] : []);
    openModal('addIdeaModal');
  }

  function handleDeleteIdea(idea) {
    if (!confirm('確定要刪除「' + idea.title + '」嗎？此動作無法復原。')) return;
    API.remove(idea.id).then(function (result) {
      if (result && result.success) {
        toast('已刪除該則點子');
        closeModal('detailModal');
        reloadIdeas();
      } else {
        toast('刪除失敗，請稍後再試');
      }
    });
  }

  document.getElementById('openAddIdeaBtn').addEventListener('click', function () { openAddOrEditModal(null); });

  document.getElementById('addIdeaForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var data = {
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      submittedBy: form.submittedBy.value.trim(),
      images: form.imageUrl.value.trim() ? [form.imageUrl.value.trim()] : [],
      demoUrl: form.demoUrl.value.trim(),
      attachments: form.attachments.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      purposeTags: getSelectedChips(document.getElementById('formPurposeTags')),
      inspirationRef: form.inspirationRef.value.trim(),
    };
    if (!data.title || !data.submittedBy) return;
    var op = editingIdeaId ? API.update(editingIdeaId, data) : API.submit(data);
    op.then(function (result) {
      if (result && result.success) {
        toast(editingIdeaId ? '已更新點子！' : '已新增點子，感謝分享！');
        form.reset();
        editingIdeaId = null;
        closeModal('addIdeaModal');
        closeModal('detailModal');
        reloadIdeas();
      } else {
        toast('儲存失敗：' + ((result && result.error) ? result.error : '請稍後再試'));
      }
    }).catch(function (err) {
      toast('儲存發生錯誤：' + ((err && err.message) ? err.message : String(err)));
    });
  });

  buildFilterChips('filterPurpose', IDEA_PURPOSE_TAGS, 'purpose');
  document.getElementById('searchInput').addEventListener('input', debounce(function (e) {
    searchTerm = e.target.value.trim();
    renderList();
  }, 200));
  reloadIdeas();
}

// ---------- 過往歷史活動 ----------
function initActivities() {
  var ALL_ACTIVITIES = [];
  var activeFilters = { purpose: {}, special: {}, mechanism: {} };
  var searchTerm = '';

  function collectDynamicSpecialTags(activities) {
    var seen = {};
    SPECIAL_TAG_SUGGESTIONS.forEach(function (t) { seen[t] = 1; });
    activities.forEach(function (a) { (a.specialTags || []).forEach(function (t) { seen[t] = 1; }); });
    return Object.keys(seen);
  }

  function buildFilterChips(containerId, tags, filterKey) {
    var container = document.getElementById(containerId);
    container.innerHTML = tags.map(function (t) {
      return '<span class="chip" data-value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</span>';
    }).join('');
    container.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        chip.classList.toggle('active');
        if (chip.classList.contains('active')) activeFilters[filterKey][chip.dataset.value] = 1;
        else delete activeFilters[filterKey][chip.dataset.value];
        renderList();
      });
    });
  }

  function matchesFilters(activity) {
    if (Object.keys(activeFilters.purpose).length && !(activity.purposeTags || []).some(function (t) { return activeFilters.purpose[t]; })) return false;
    if (Object.keys(activeFilters.special).length && !(activity.specialTags || []).some(function (t) { return activeFilters.special[t]; })) return false;
    if (Object.keys(activeFilters.mechanism).length && !(activity.mechanismTags || []).some(function (t) { return activeFilters.mechanism[t]; })) return false;
    if (searchTerm) {
      var hay = (activity.name + ' ' + (activity.description || '') + ' ' + (activity.mechanism || '')).toLowerCase();
      if (hay.indexOf(searchTerm.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function activityCardHtml(a) {
    var metricsBadge = a.metrics
      ? '<span class="chip tag-readonly" style="background:#eaf7ee;color:#1e7a3c;border-color:#cdeed6;">已有成效數據</span>'
      : '<span class="chip tag-readonly tag-todo">成效待補充</span>';
    return '<div class="item-card" data-id="' + a.id + '">' +
      cardPhotoHtml(a.images) +
      '<div class="title">' + escapeHtml(a.name) + '</div>' +
      '<div class="meta">' + escapeHtml(a.dateText || '日期未提供') + '</div>' +
      '<div class="desc">' + escapeHtml(a.mechanism || a.description || '') + '</div>' +
      '<div class="tag-row">' +
        (a.mechanismTags || []).map(function (t) { return tagChip(t, 'mechanism'); }).join('') +
        (a.specialTags || []).map(function (t) { return tagChip(t, 'special'); }).join('') +
      '</div>' +
      '<div class="footer-row">' +
        '<span>' + (a.purposeTags && a.purposeTags.length ? escapeHtml(a.purposeTags.join(' / ')) : '目的待補充') + '</span>' +
        metricsBadge +
      '</div>' +
    '</div>';
  }

  function renderList() {
    var filtered = ALL_ACTIVITIES.filter(matchesFilters);
    var grid = document.getElementById('cardGrid');
    document.getElementById('listMeta').textContent = '共 ' + filtered.length + ' 筆活動（總計 ' + ALL_ACTIVITIES.length + ' 筆）';
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="big">🔍</div>找不到符合條件的活動，試試調整篩選條件。</div>';
      return;
    }
    grid.innerHTML = filtered.map(activityCardHtml).join('');
    grid.querySelectorAll('.item-card').forEach(function (card) {
      card.addEventListener('click', function () { openDetail(card.dataset.id); });
    });
  }

  function openDetail(id) {
    var a = ALL_ACTIVITIES.find(function (x) { return x.id === id; });
    if (!a) return;
    var box = document.getElementById('detailModalBox');
    box.innerHTML = '' +
      '<button class="modal-close" onclick="closeModal(\'detailModal\')">✕</button>' +
      '<h2>' + escapeHtml(a.name) + '</h2>' +
      '<div class="modal-sub">' + escapeHtml(a.dateText || '日期未提供') + (a.createdBy ? ' · 記錄人：' + escapeHtml(a.createdBy) : '') + '</div>' +
      '<div class="detail-section"><div class="label">活動照片</div>' + photoGalleryHtml(a.images) + '</div>' +
      '<div class="detail-section"><div class="label">遊戲機制</div><div class="value">' + escapeHtml(a.mechanism || '（尚未填寫）') + '</div></div>' +
      (a.description ? '<div class="detail-section"><div class="label">活動說明 / 獎勵內容</div><div class="value">' + escapeHtml(a.description) + '</div></div>' : '') +
      '<div class="detail-section"><div class="label">遊戲類型</div>' + (tagRow(a.mechanismTags, 'mechanism') || '（未分類）') + '</div>' +
      '<div class="detail-section"><div class="label">設計目的</div>' + purposeTagsOrTodo(a.purposeTags) + '</div>' +
      '<div class="detail-section"><div class="label">特殊需求</div>' + (tagRow(a.specialTags, 'special') || '（無）') + '</div>' +
      '<div class="detail-section"><div class="label">成效數據</div>' +
        (a.metrics
          ? '<div class="value">' + escapeHtml(a.metrics.summary || '') + '</div>'
          : '<div class="metrics-box">📊 成效數據待補充——待營運團隊整理完成後會更新此區塊。</div>') +
      '</div>' +
      (a.referenceLink ? '<div class="detail-section"><div class="label">參考連結</div><div class="value"><a href="' + escapeHtml(a.referenceLink) + '" target="_blank" rel="noopener">' + escapeHtml(a.referenceLink) + '</a></div></div>' : '');
    openModal('detailModal');
  }

  document.getElementById('openAddActivityBtn').addEventListener('click', function () {
    renderChipSelect(document.getElementById('formMechanismTags'), MECHANISM_TAGS, []);
    renderChipSelect(document.getElementById('formPurposeTags'), PURPOSE_TAGS, []);
    renderChipSelect(document.getElementById('formSpecialTags'), SPECIAL_TAG_SUGGESTIONS, []);
    openModal('addActivityModal');
  });

  document.getElementById('addActivityForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var data = {
      name: form.name.value.trim(),
      dateText: form.dateText.value.trim(),
      description: form.description.value.trim(),
      mechanism: form.mechanism.value.trim(),
      mechanismTags: getSelectedChips(document.getElementById('formMechanismTags')),
      purposeTags: getSelectedChips(document.getElementById('formPurposeTags')),
      specialTags: getSelectedChips(document.getElementById('formSpecialTags')),
      referenceLink: form.referenceLink.value.trim(),
      images: form.images.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      createdBy: form.createdBy.value.trim() || '匿名',
      metrics: null,
    };
    if (!data.name || !data.mechanism) return;
    submitActivity(data).then(function (result) {
      if (result && result.success) {
        toast('已新增活動紀錄');
        form.reset();
        closeModal('addActivityModal');
        reloadActivities();
      } else {
        toast('儲存失敗：' + ((result && result.error) ? result.error : '請稍後再試'));
      }
    }).catch(function (err) {
      toast('儲存發生錯誤：' + ((err && err.message) ? err.message : String(err)));
    });
  });

  function reloadActivities() {
    return fetchActivities().then(function (list) {
      ALL_ACTIVITIES = list;
      renderList();
    });
  }

  buildFilterChips('filterPurpose', PURPOSE_TAGS, 'purpose');
  fetchActivities().then(function (list) {
    ALL_ACTIVITIES = list;
    buildFilterChips('filterSpecial', collectDynamicSpecialTags(list), 'special');
    buildFilterChips('filterMechanism', MECHANISM_TAGS, 'mechanism');
    renderList();
    document.getElementById('searchInput').addEventListener('input', debounce(function (e) {
      searchTerm = e.target.value.trim();
      renderList();
    }, 200));
  });
}

// ---------- 依 <body data-page> 分派 ----------
function bootWebapp() {
  var page = (document.body && document.body.getAttribute('data-page')) || 'index';
  if (page === 'index') initIndex();
  else if (page === 'generate') initGenerate();
  else if (page === 'ideas') initIdeasPage('ideas');
  else if (page === 'hotideas') initIdeasPage('hotIdeas');
  else if (page === 'activities') initActivities();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootWebapp);
} else {
  bootWebapp();
}
