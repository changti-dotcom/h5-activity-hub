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
// 頁面用 <body data-page="index|generate|ideas|activities"> 指定要跑哪一段邏輯。
// 「我有活動靈感」頁面把 H5 活動靈感、熱點活動靈感合併在同一個靈感庫，
// 用 ideaType（'h5' / 'hotspot'）欄位區分，Code.gs 會自動合併新舊兩個 Sheet 分頁的資料。
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

// 「我要找活動靈感」的目標選項；「我有活動靈感」新增點子的「設計目的」跟「過往歷史活動」
// 的設計目的都統一用同一份分類。
var GOAL_TAGS = [
  { key: '提升主要模式時長', icon: '⚔️' },
  { key: '提升其他模式時長', icon: '🎮' },
  { key: '提升非對局在線時長', icon: '🕒' },
  { key: '提升登入率', icon: '📲' },
  { key: '有趣時事梗', icon: '🔥' },
];

var ACTIVITY_TYPE_OPTIONS = ['H5活動', '活動中心活動'];

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

function demoLinkHtml(demoUrl, ideaType) {
  if (!demoUrl) return '';
  var label = ideaType === 'hotspot' ? '🔗 查看補充資料' : '▶ 開啟 Demo 網頁';
  return '<a href="' + escapeHtml(demoUrl) + '" target="_blank" rel="noopener" class="demo-link">' + label + '</a>';
}

function attachmentListHtml(attachments) {
  if (!attachments || !attachments.length) return '';
  return '<div class="attachment-list">' + attachments.map(function (url, i) {
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="attachment-link">📎 附件 ' + (i + 1) + '</a>';
  }).join('') + '</div>';
}

function ideaTypeBadgeHtml(ideaType) {
  if (ideaType === 'hotspot') return '<span class="chip tag-readonly tag-special">🔥 熱點活動</span>';
  return '<span class="chip tag-readonly tag-mechanism">📱 H5活動</span>';
}

function commentsListHtml(comments) {
  if (!comments || !comments.length) {
    return '<div class="value" style="color:var(--color-text-muted);">還沒有人留言，第一個留言分享想法吧！</div>';
  }
  // 這個功能上線前留下的舊留言可能沒有 id，用陣列位置當備援識別碼，
  // 讓編輯/刪除對所有留言都能用，不會只有新留言才有這兩個按鈕。
  return '<div class="comment-list">' + comments.map(function (c, i) {
    var key = c.id || ('idx_' + i);
    return '' +
      '<div class="comment-item" data-comment-id="' + escapeHtml(key) + '">' +
        '<div class="comment-head"><strong>' + escapeHtml(c.author || '匿名') + '</strong><span>' + formatDateShort(c.createdAt) + '</span></div>' +
        '<div class="comment-text">' + escapeHtml(c.text) + '</div>' +
        '<div class="comment-actions">' +
          '<button type="button" class="comment-edit-btn" data-comment-id="' + escapeHtml(key) + '">✏️ 編輯</button>' +
          '<button type="button" class="comment-delete-btn" data-comment-id="' + escapeHtml(key) + '">🗑️ 刪除</button>' +
        '</div>' +
      '</div>';
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
        ideaTypeBadgeHtml(idea.ideaType) +
        (idea.purposeTags || []).map(function (t) { return tagChip(t, 'purpose'); }).join('') +
        (idea.demoUrl ? '<span class="demo-badge">' + (idea.ideaType === 'hotspot' ? '📎 有補充資料' : '🎮 有 Demo') + '</span>' : '') +
      '</div>' +
      '<div class="footer-row">' +
        '<span class="author-badge">' +
          '<span class="avatar-circle">' + escapeHtml(initialsOf(idea.submittedBy)) + '</span>' +
          escapeHtml(idea.submittedBy || '匿名') +
        '</span>' +
        '<span>👍 ' + (idea.likes || 0) + '　' + (idea.attachments && idea.attachments.length ? '📎 ' + idea.attachments.length + '　' : '') + formatDateShort(idea.createdAt) + '</span>' +
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
      ideaTypeBadgeHtml(idea.ideaType) +
      '<span class="author-badge"><span class="avatar-circle">' + escapeHtml(initialsOf(idea.submittedBy)) + '</span>' + escapeHtml(idea.submittedBy || '匿名') + '</span>' +
      ' 提供 · ' + formatDateShort(idea.createdAt) +
    '</div>' +
    ((idea.ideaType !== 'hotspot' || (idea.images && idea.images.length)) ? '<div class="detail-section"><div class="label">示意圖／Demo 照片</div>' + photoGalleryHtml(idea.images) + '</div>' : '') +
    (idea.demoUrl ? '<div class="detail-section"><div class="label">' + (idea.ideaType === 'hotspot' ? '其他補充資料' : '互動 Demo') + '</div>' + demoLinkHtml(idea.demoUrl, idea.ideaType) + '</div>' : '') +
    '<div class="detail-section"><div class="label">' + (idea.ideaType === 'hotspot' ? '活動說明' : '詳細說明') + '</div><div class="value">' + escapeHtml(idea.description) + '</div></div>' +
    (idea.topicRef ? '<div class="detail-section"><div class="label">時事議題／時事梗</div><div class="value">' + escapeHtml(idea.topicRef) + '</div></div>' : '') +
    '<div class="detail-section"><div class="label">設計目的</div>' + purposeTagsOrTodo(idea.purposeTags) + '</div>' +
    (idea.inspirationRef ? '<div class="detail-section"><div class="label">參考／靈感來源</div><div class="value">' + escapeHtml(idea.inspirationRef) + '</div></div>' : '') +
    (idea.attachments && idea.attachments.length ? '<div class="detail-section"><div class="label">附件</div>' + attachmentListHtml(idea.attachments) + '</div>' : '') +
    '<div class="detail-section"><div class="label">按讚</div><button type="button" class="btn btn-outline btn-sm like-btn" data-id="' + escapeHtml(idea.id) + '">👍 按讚（' + (idea.likes || 0) + '）</button></div>' +
    '<div class="detail-section"><div class="label">留言（' + ((idea.comments || []).length) + '）</div>' +
      commentsListHtml(idea.comments) +
      '<form class="comment-form" data-id="' + escapeHtml(idea.id) + '" style="margin-top:14px;">' +
        '<div class="form-group" style="margin-bottom:8px;"><input type="text" name="commentAuthor" placeholder="你的名字" required></div>' +
        '<div class="form-group" style="margin-bottom:8px;"><textarea name="commentText" placeholder="覺得這個點子可以怎麼修改？想留言鼓勵一下也可以" required style="min-height:60px;"></textarea></div>' +
        '<div class="form-actions" style="margin-top:0;"><button type="submit" class="btn btn-primary btn-sm">送出留言</button></div>' +
      '</form>' +
    '</div>' +
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
function updateActivity(id, data) { return callServer('updateActivityForClient', Object.assign({ id: id }, data)); }

function fetchIdeas() { return callServer('getIdeasForClient').then(function (r) { return Array.isArray(r) ? r : []; }); }
function submitIdea(data) { return callServer('addIdeaForClient', data); }
function updateIdea(id, data) { return callServer('updateIdeaForClient', Object.assign({ id: id }, data)); }
function deleteIdea(id) { return callServer('deleteIdeaForClient', id); }
function likeIdea(id) { return callServer('likeIdeaForClient', id); }
function unlikeIdea(id) { return callServer('unlikeIdeaForClient', id); }
function addComment(id, comment) { return callServer('addCommentForClient', Object.assign({ id: id }, comment)); }
function updateComment(id, commentId, data) { return callServer('updateCommentForClient', Object.assign({ id: id, commentId: commentId }, data)); }
function deleteComment(id, commentId) { return callServer('deleteCommentForClient', { id: id, commentId: commentId }); }

// ============================================================================
// 各頁面邏輯
// ============================================================================

// ---------- 首頁：統計數字 ----------
function initIndex() {
  Promise.all([fetchActivities(), fetchIdeas()]).then(function (res) {
    var activities = res[0], ideas = res[1];
    var mechanismSet = {};
    var missingMetrics = 0;
    activities.forEach(function (a) {
      (a.mechanismTags || []).forEach(function (t) { mechanismSet[t] = 1; });
      if (!a.metrics) missingMetrics += 1;
    });
    var nums = document.querySelectorAll('#statsRow .num');
    if (nums[0]) nums[0].textContent = activities.length;
    if (nums[1]) nums[1].textContent = ideas.length;
    if (nums[2]) nums[2].textContent = Object.keys(mechanismSet).length;
    if (nums[3]) nums[3].textContent = missingMetrics;
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
      area.innerHTML = '<div class="empty-state"><div class="big">🤔</div>靈感庫目前還沒有標註「' + escapeHtml(activeGoal) + '」的點子，去「我有活動靈感」頁面新增一個吧！</div>';
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

// ---------- 我有活動靈感（H5 + 熱點合併） ----------
function initIdeas() {
  var LIKED_KEY = 'h5_liked_ideas_v1';
  var ALL_IDEAS = [];
  var activeFilters = { purpose: {} };
  var searchTerm = '';
  var editingIdeaId = null;
  var IDEA_PURPOSE_TAGS = GOAL_TAGS.map(function (g) { return g.key; });

  function getLikedIds() {
    try { return new Set(JSON.parse(localStorage.getItem(LIKED_KEY)) || []); } catch (e) { return new Set(); }
  }
  function markLiked(id) {
    var liked = getLikedIds();
    liked.add(id);
    localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(liked)));
  }
  function unmarkLiked(id) {
    var liked = getLikedIds();
    liked.delete(id);
    localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(liked)));
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

  function matchesFilters(idea) {
    var purposeKeys = Object.keys(activeFilters.purpose);
    if (purposeKeys.length && !(idea.purposeTags || []).some(function (t) { return activeFilters.purpose[t]; })) return false;
    if (searchTerm) {
      var hay = (idea.title + ' ' + (idea.description || '') + ' ' + (idea.submittedBy || '')).toLowerCase();
      if (hay.indexOf(searchTerm.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function sortIdeas(list) {
    return list.sort(function (a, b) {
      return (b.likes || 0) - (a.likes || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
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
    return fetchIdeas().then(function (list) {
      ALL_IDEAS = sortIdeas(list);
      renderList();
    });
  }

  function updateLikeButtonUi(btn, idea) {
    var liked = getLikedIds().has(idea.id);
    btn.classList.toggle('liked', liked);
    btn.textContent = liked ? '👍 已按讚（' + (idea.likes || 0) + '）' : '👍 按讚（' + (idea.likes || 0) + '）';
  }

  function refreshDetailModal(ideaId, fallbackIdea) {
    var updated = ALL_IDEAS.find(function (x) { return x.id === ideaId; }) || fallbackIdea;
    renderIdeaDetailModal(updated, { manageActions: true });
    wireDetailActions(updated);
  }

  function wireDetailActions(idea) {
    var box = document.getElementById('detailModalBox');
    var editBtn = box.querySelector('.manage-edit-btn');
    var deleteBtn = box.querySelector('.manage-delete-btn');
    var likeBtn = box.querySelector('.like-btn');
    var commentForm = box.querySelector('.comment-form');

    if (editBtn) editBtn.addEventListener('click', function () { openAddOrEditModal(idea); });
    if (deleteBtn) deleteBtn.addEventListener('click', function () { handleDeleteIdea(idea); });

    if (likeBtn) {
      updateLikeButtonUi(likeBtn, idea);
      likeBtn.addEventListener('click', function () { handleToggleLike(idea); });
    }

    if (commentForm) {
      commentForm.addEventListener('submit', function (e) {
        e.preventDefault();
        handleAddComment(idea, commentForm);
      });
    }

    box.querySelectorAll('.comment-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { startEditComment(idea, btn.dataset.commentId); });
    });
    box.querySelectorAll('.comment-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { handleDeleteComment(idea, btn.dataset.commentId); });
    });
  }

  function openDetail(id) {
    var idea = ALL_IDEAS.find(function (x) { return x.id === id; });
    if (!idea) return;
    renderIdeaDetailModal(idea, { manageActions: true });
    wireDetailActions(idea);
  }

  function handleToggleLike(idea) {
    var liked = getLikedIds().has(idea.id);
    var op = liked ? unlikeIdea(idea.id) : likeIdea(idea.id);
    op.then(function (result) {
      if (result && result.success) {
        if (liked) unmarkLiked(idea.id); else markLiked(idea.id);
        return reloadIdeas().then(function () { refreshDetailModal(idea.id, idea); });
      }
      toast('操作失敗，請稍後再試');
    });
  }

  function handleAddComment(idea, form) {
    var author = form.commentAuthor.value.trim();
    var text = form.commentText.value.trim();
    if (!author || !text) return;
    addComment(idea.id, { author: author, text: text }).then(function (result) {
      if (result && result.success) {
        toast('留言送出！');
        return reloadIdeas().then(function () { refreshDetailModal(idea.id, idea); });
      }
      toast('留言失敗，請稍後再試');
    });
  }

  function findCommentByKey(comments, commentId) {
    if (commentId.indexOf('idx_') === 0) return comments[Number(commentId.slice(4))];
    return comments.find(function (c) { return c.id === commentId; });
  }

  function startEditComment(idea, commentId) {
    var comment = findCommentByKey(idea.comments || [], commentId);
    if (!comment) return;
    var item = document.querySelector('.comment-item[data-comment-id="' + commentId + '"]');
    if (!item) return;
    item.innerHTML = '' +
      '<div class="form-group" style="margin-bottom:8px;"><input type="text" class="edit-comment-author" value="' + escapeHtml(comment.author || '') + '"></div>' +
      '<div class="form-group" style="margin-bottom:8px;"><textarea class="edit-comment-text" style="min-height:60px;">' + escapeHtml(comment.text || '') + '</textarea></div>' +
      '<div class="form-actions" style="margin-top:0;">' +
        '<button type="button" class="btn btn-outline btn-sm cancel-edit-comment-btn">取消</button>' +
        '<button type="button" class="btn btn-primary btn-sm save-edit-comment-btn">儲存</button>' +
      '</div>';
    item.querySelector('.cancel-edit-comment-btn').addEventListener('click', function () { refreshDetailModal(idea.id, idea); });
    item.querySelector('.save-edit-comment-btn').addEventListener('click', function () { saveEditComment(idea, commentId, item); });
  }

  function saveEditComment(idea, commentId, item) {
    var author = item.querySelector('.edit-comment-author').value.trim();
    var text = item.querySelector('.edit-comment-text').value.trim();
    if (!author || !text) return;
    updateComment(idea.id, commentId, { author: author, text: text }).then(function (result) {
      if (result && result.success) {
        toast('留言已更新');
        return reloadIdeas().then(function () { refreshDetailModal(idea.id, idea); });
      }
      toast('更新失敗，請稍後再試');
    });
  }

  function handleDeleteComment(idea, commentId) {
    if (!confirm('確定要刪除這則留言嗎？')) return;
    deleteComment(idea.id, commentId).then(function (result) {
      if (result && result.success) {
        toast('留言已刪除');
        return reloadIdeas().then(function () { refreshDetailModal(idea.id, idea); });
      }
      toast('刪除失敗，請稍後再試');
    });
  }

  // 活動中心不是做小遊戲，是條件兌換機制，所以「詳細說明」「Demo 網頁連結」這兩個欄位
  // 換成對應的標籤／提示／預留文字；附件（工單）跟示意圖照片是 H5 專用，活動中心不需要，
  // 「Demo 網頁連結」在活動中心底下直接兼作「其他補充資料」的單一連結欄位使用。
  function setIdeaTypeUi(type) {
    var isHotspot = type === 'hotspot';
    document.getElementById('attachmentsFieldGroup').style.display = isHotspot ? 'none' : '';
    document.getElementById('imageUrlFieldGroup').style.display = isHotspot ? 'none' : '';

    var descLabelText = document.getElementById('descriptionLabelText');
    var descHint = document.getElementById('descriptionHint');
    var descInput = document.getElementById('descriptionInput');
    var demoLabelText = document.getElementById('demoUrlLabelText');
    var demoHint = document.getElementById('demoUrlHint');

    if (isHotspot) {
      descLabelText.textContent = '活動說明';
      descHint.textContent = '選填，例如可以連結哪個英雄、條件兌換機制怎麼設計等等';
      descInput.placeholder = '例：搭配哪個英雄／IP、玩家要完成什麼條件才能兌換什麼獎勵（活動中心是條件兌換機制，不是遊戲玩法）';
      demoLabelText.textContent = '其他補充資料';
      demoHint.textContent = '選填，示意圖、參考文件、活動企劃連結等都可以，貼一個連結就好';
    } else {
      descLabelText.textContent = '詳細說明';
      descHint.textContent = '選填，先丟出來就好，之後想到再補充也可以';
      descInput.placeholder = '玩法怎麼玩？為什麼覺得會吸引玩家？（沒想清楚也沒關係，先寫個大概）';
      demoLabelText.textContent = 'Demo 網頁連結';
      demoHint.textContent = '選填，如果已經做好可以直接玩的 HTML Demo 網頁，貼連結讓大家玩玩看，要不要放完全自由';
    }
  }

  function openAddOrEditModal(idea) {
    editingIdeaId = idea ? idea.id : null;
    document.getElementById('addIdeaModalTitle').textContent = idea ? '編輯點子' : '新增點子';
    document.getElementById('addIdeaSubmitBtn').textContent = idea ? '儲存變更' : '送出';
    var form = document.getElementById('addIdeaForm');
    var type = idea ? idea.ideaType || 'h5' : 'h5';
    form.querySelector('input[name="ideaType"][value="' + type + '"]').checked = true;
    setIdeaTypeUi(type);
    form.title.value = idea ? idea.title || '' : '';
    form.description.value = idea ? idea.description || '' : '';
    form.submittedBy.value = idea ? idea.submittedBy || '' : '';
    form.imageUrl.value = idea && idea.images && idea.images[0] ? idea.images[0] : '';
    form.demoUrl.value = idea ? idea.demoUrl || '' : '';
    form.topicRef.value = idea ? idea.topicRef || '' : '';
    form.attachments.value = idea && idea.attachments && idea.attachments.length ? idea.attachments.join('\n') : '';
    form.inspirationRef.value = idea ? idea.inspirationRef || '' : '';
    renderChipSelect(document.getElementById('formPurposeTags'), IDEA_PURPOSE_TAGS, idea ? idea.purposeTags || [] : []);
    openModal('addIdeaModal');
  }

  function handleDeleteIdea(idea) {
    if (!confirm('確定要刪除「' + idea.title + '」嗎？此動作無法復原。')) return;
    deleteIdea(idea.id).then(function (result) {
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

  document.querySelectorAll('input[name="ideaType"]').forEach(function (radio) {
    radio.addEventListener('change', function (e) { setIdeaTypeUi(e.target.value); });
  });

  document.getElementById('addIdeaForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var ideaType = form.querySelector('input[name="ideaType"]:checked').value;
    var data = {
      ideaType: ideaType,
      title: form.title.value.trim(),
      description: form.description.value.trim(),
      submittedBy: form.submittedBy.value.trim(),
      images: form.imageUrl.value.trim() ? [form.imageUrl.value.trim()] : [],
      demoUrl: form.demoUrl.value.trim(),
      topicRef: form.topicRef.value.trim(),
      attachments: ideaType === 'h5' ? form.attachments.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean) : [],
      purposeTags: getSelectedChips(document.getElementById('formPurposeTags')),
      inspirationRef: form.inspirationRef.value.trim(),
    };
    if (!data.title || !data.submittedBy) return;
    var op = editingIdeaId ? updateIdea(editingIdeaId, data) : submitIdea(data);
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
  var activeFilters = { purpose: {}, special: {}, mechanism: {}, activityType: {} };
  var searchTerm = '';
  var editingActivityId = null;
  // 設計目的分類基礎跟「我要找活動靈感」「我有活動靈感」統一，用同一份 GOAL_TAGS，
  // 過往歷史活動這裡另外加上三個傳統業務目的分類（留存／拉新／回流），只有這個頁面有。
  var ACTIVITY_PURPOSE_TAGS = GOAL_TAGS.map(function (g) { return g.key; }).concat(['留存', '拉新', '回流']);

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
    if (Object.keys(activeFilters.activityType).length && !activeFilters.activityType[activity.activityType]) return false;
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
        (a.activityType ? tagChip(a.activityType, 'goal') : '') +
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
      '<div class="modal-sub">' + (a.activityType ? escapeHtml(a.activityType) + ' · ' : '') + escapeHtml(a.dateText || '日期未提供') + (a.createdBy ? ' · 記錄人：' + escapeHtml(a.createdBy) : '') + '</div>' +
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
      (a.referenceLink ? '<div class="detail-section"><div class="label">參考連結</div><div class="value"><a href="' + escapeHtml(a.referenceLink) + '" target="_blank" rel="noopener">' + escapeHtml(a.referenceLink) + '</a></div></div>' : '') +
      '<div class="form-actions" style="justify-content:flex-start;border-top:1px solid var(--color-border);padding-top:16px;">' +
        '<button type="button" class="btn btn-outline btn-sm manage-edit-activity-btn">✏️ 編輯</button>' +
      '</div>';
    box.querySelector('.manage-edit-activity-btn').addEventListener('click', function () { openAddOrEditActivityModal(a); });
    openModal('detailModal');
  }

  function openAddOrEditActivityModal(activity) {
    editingActivityId = activity ? activity.id : null;
    document.getElementById('addActivityModalTitle').textContent = activity ? '編輯活動紀錄' : '新增活動紀錄';
    document.getElementById('addActivitySubmitBtn').textContent = activity ? '儲存變更' : '送出';
    var form = document.getElementById('addActivityForm');
    form.activityType.value = activity ? activity.activityType || '' : '';
    form.name.value = activity ? activity.name || '' : '';
    form.dateText.value = activity ? activity.dateText || '' : '';
    form.description.value = activity ? activity.description || '' : '';
    form.mechanism.value = activity ? activity.mechanism || '' : '';
    form.referenceLink.value = activity ? activity.referenceLink || '' : '';
    form.images.value = activity && activity.images && activity.images.length ? activity.images.join('\n') : '';
    form.createdBy.value = activity ? activity.createdBy || '' : '';
    renderChipSelect(document.getElementById('formMechanismTags'), MECHANISM_TAGS, activity ? activity.mechanismTags || [] : []);
    renderChipSelect(document.getElementById('formPurposeTags'), ACTIVITY_PURPOSE_TAGS, activity ? activity.purposeTags || [] : []);
    renderChipSelect(document.getElementById('formSpecialTags'), SPECIAL_TAG_SUGGESTIONS, activity ? activity.specialTags || [] : []);
    openModal('addActivityModal');
  }

  document.getElementById('openAddActivityBtn').addEventListener('click', function () { openAddOrEditActivityModal(null); });

  document.getElementById('addActivityForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var data = {
      activityType: form.activityType.value,
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
    };
    // 新增時預設沒有成效數據；編輯時不能覆蓋掉既有的 metrics（表單本來就沒有這個欄位可以填）
    if (!editingActivityId) data.metrics = null;
    if (!data.name || !data.mechanism) return;

    var op = editingActivityId ? updateActivity(editingActivityId, data) : submitActivity(data);
    op.then(function (result) {
      if (result && result.success) {
        toast(editingActivityId ? '已更新活動紀錄！' : '已新增活動紀錄');
        form.reset();
        editingActivityId = null;
        closeModal('addActivityModal');
        closeModal('detailModal');
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

  buildFilterChips('filterActivityType', ACTIVITY_TYPE_OPTIONS, 'activityType');
  buildFilterChips('filterPurpose', ACTIVITY_PURPOSE_TAGS, 'purpose');
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
  else if (page === 'ideas') initIdeas();
  else if (page === 'activities') initActivities();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootWebapp);
} else {
  bootWebapp();
}
