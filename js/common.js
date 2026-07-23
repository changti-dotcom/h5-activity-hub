// 全站共用的標籤定義與 UI 輔助函式

const PURPOSE_TAGS = ['拉新', '回流', '留存', '付費', '版本導流', '品牌口碑'];

const SPECIAL_TAG_SUGGESTIONS = [
  '時事熱點', '節慶檔期', 'IP聯動', '週年慶', '新版本上市',
  '電競賽事聯動', '老玩家回歸', '低開發成本', '需搭配抽卡機制',
];

const MECHANISM_TAGS = [
  '益智消除', '反應操作', '心理測驗', '經營模擬', '任務養成',
  '抽獎機率', '社交邀請', '陣營競賽', '劇情回顧', '音樂節奏', '其他',
];

// 「我要找活動」頁面的四個目標選項，點選後會顯示靈感庫中標註對應 goalTags 的點子
const GOAL_TAGS = [
  { key: '提升主要模式時長', icon: '⚔️' },
  { key: '提升其他模式時長', icon: '🎮' },
  { key: '提升非對局在線時長', icon: '🕒' },
  { key: '提升登入率', icon: '📲' },
];

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
  const cls = `chip tag-readonly ${variant ? 'tag-' + variant : ''}`;
  return `<span class="${cls}"${opts.title ? ` title="${escapeHtml(opts.title)}"` : ''}>${escapeHtml(text)}</span>`;
}

function tagRow(tags, variant) {
  if (!tags || !tags.length) return '';
  return `<div class="tag-row">${tags.map((t) => tagChip(t, variant)).join('')}</div>`;
}

function purposeTagsOrTodo(tags) {
  if (tags && tags.length) return tagRow(tags, 'purpose');
  return tagChip('設計目的待補充', 'todo');
}

// Google Drive「分享連結」（.../file/d/FILE_ID/view 或 open?id=FILE_ID）本質上是預覽頁面網址，
// 不是圖片檔案本身，直接當 <img src> 用會顯示不出來。這裡在「顯示時」自動轉成 Google 官方的
// 縮圖端點，不會更動使用者實際貼上、儲存的原始連結。
function normalizeImageUrl(url) {
  if (!url) return url;
  const trimmed = String(url).trim();
  if (!trimmed.includes('drive.google.com') || trimmed.includes('/thumbnail')) return trimmed;
  const fileMatch = trimmed.match(/\/file\/d\/([^/]+)/);
  const idParamMatch = trimmed.match(/[?&]id=([^&]+)/);
  const fileId = fileMatch ? fileMatch[1] : idParamMatch ? idParamMatch[1] : null;
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : trimmed;
}

function cardPhotoHtml(images) {
  if (images && images.length) {
    return `<div class="card-photo"><img src="${escapeHtml(normalizeImageUrl(images[0]))}" alt="" loading="lazy" onerror="this.closest('.card-photo').classList.add('img-error')"></div>`;
  }
  return `<div class="card-photo photo-placeholder"><span>🖼️ 尚無照片</span></div>`;
}

function photoGalleryHtml(images) {
  if (!images || !images.length) {
    return `<div class="photo-box">🖼️ 照片待補充——之後有活動截圖或素材可以補在這裡。</div>`;
  }
  return `<div class="photo-gallery">${images
    .map(
      (url) =>
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="photo-gallery-item"><img src="${escapeHtml(normalizeImageUrl(url))}" alt="" loading="lazy"></a>`
    )
    .join('')}</div>`;
}

// 成效數據分級門檻：依團隊過去活動的參與率／完成率分布抓的參考值，用來讓數字一看就懂表現好壞
const METRIC_THRESHOLDS = {
  visitRate: { high: 40, mid: 25 },
  completionRate: { high: 30, mid: 15 },
};

function metricTier(value, kind) {
  const t = METRIC_THRESHOLDS[kind];
  if (value >= t.high) return { label: '表現優異', cls: 'metric-high' };
  if (value >= t.mid) return { label: '表現中等', cls: 'metric-mid' };
  return { label: '待加強', cls: 'metric-low' };
}

function metricStatHtml(label, value, kind) {
  const tier = metricTier(value, kind);
  return `
    <div class="metric-stat ${tier.cls}">
      <div class="metric-num">${value}%</div>
      <div class="metric-tier-label">${escapeHtml(label)}・${tier.label}</div>
    </div>
  `;
}

function metricsSectionHtml(metrics) {
  if (!metrics) {
    return `<div class="metrics-box">📊 成效數據待補充——待營運團隊整理完成後會更新此區塊。</div>`;
  }
  if (metrics.visitRate != null || metrics.completionRate != null) {
    const stats = [];
    if (metrics.visitRate != null) stats.push(metricStatHtml('參與率', metrics.visitRate, 'visitRate'));
    if (metrics.completionRate != null) stats.push(metricStatHtml('完成率', metrics.completionRate, 'completionRate'));
    return `<div class="metric-stats-row">${stats.join('')}</div>`;
  }
  return `<div class="value">${escapeHtml(metrics.summary || '')}</div>`;
}

function metricsBadgeHtml(metrics) {
  if (!metrics) return `<span class="chip tag-readonly tag-todo">成效待補充</span>`;
  if (metrics.visitRate != null || metrics.completionRate != null) {
    const parts = [];
    if (metrics.visitRate != null) parts.push(`參與 ${metrics.visitRate}%`);
    if (metrics.completionRate != null) parts.push(`完成 ${metrics.completionRate}%`);
    const kind = metrics.completionRate != null ? 'completionRate' : 'visitRate';
    const value = metrics.completionRate != null ? metrics.completionRate : metrics.visitRate;
    const tier = metricTier(value, kind);
    return `<span class="chip tag-readonly ${tier.cls}">${escapeHtml(parts.join(' · '))}</span>`;
  }
  return `<span class="chip tag-readonly" style="background:#eaf7ee;color:#1e7a3c;border-color:#cdeed6;">已有成效數據</span>`;
}

function initialsOf(name) {
  if (!name) return '?';
  const trimmed = name.trim();
  return trimmed.slice(0, 1).toUpperCase();
}

function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay || 250);
  };
}

function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function renderChipSelect(container, tags, selected) {
  container.innerHTML = tags
    .map((t) => `<span class="chip" data-value="${escapeHtml(t)}">${escapeHtml(t)}</span>`)
    .join('');
  container.querySelectorAll('.chip').forEach((chip) => {
    if (selected.includes(chip.dataset.value)) chip.classList.add('active');
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
    });
  });
}

function getSelectedChips(container) {
  return [...container.querySelectorAll('.chip.active')].map((c) => c.dataset.value);
}

function ideaCardHtml(idea) {
  return `
    <div class="item-card" data-id="${idea.id}">
      ${cardPhotoHtml(idea.images)}
      <div class="title">${escapeHtml(idea.title)}</div>
      <div class="desc">${escapeHtml(idea.description)}</div>
      <div class="tag-row">
        ${(idea.purposeTags || []).map((t) => tagChip(t, 'purpose')).join('')}
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

function renderIdeaDetailModal(idea, opts) {
  opts = opts || {};
  const box = document.getElementById('detailModalBox');
  box.innerHTML = `
    <button class="modal-close" onclick="closeModal('detailModal')">✕</button>
    <h2>${escapeHtml(idea.title)}</h2>
    <div class="modal-sub">
      <span class="author-badge"><span class="avatar-circle">${escapeHtml(initialsOf(idea.submittedBy))}</span>${escapeHtml(idea.submittedBy || '匿名')}</span>
      提供 · ${formatDateShort(idea.createdAt)}
    </div>

    <div class="detail-section">
      <div class="label">示意圖／Demo 照片</div>
      ${photoGalleryHtml(idea.images)}
    </div>

    <div class="detail-section">
      <div class="label">詳細說明</div>
      <div class="value">${escapeHtml(idea.description)}</div>
    </div>

    <div class="detail-section">
      <div class="label">設計目的</div>
      ${purposeTagsOrTodo(idea.purposeTags)}
    </div>

    ${idea.inspirationRef ? `<div class="detail-section"><div class="label">參考／靈感來源</div><div class="value">${escapeHtml(idea.inspirationRef)}</div></div>` : ''}

    ${opts.manageActions ? `
    <div class="form-actions" style="justify-content:flex-start;border-top:1px solid var(--color-border);padding-top:16px;">
      <button type="button" class="btn btn-outline btn-sm manage-edit-btn" data-id="${escapeHtml(idea.id)}">✏️ 編輯</button>
      <button type="button" class="btn btn-outline btn-sm manage-delete-btn" data-id="${escapeHtml(idea.id)}" style="color:var(--color-danger);border-color:#f0b8b1;">🗑️ 刪除</button>
    </div>` : ''}
  `;
  openModal('detailModal');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});
