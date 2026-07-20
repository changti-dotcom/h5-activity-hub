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

function cardPhotoHtml(images) {
  if (images && images.length) {
    return `<div class="card-photo"><img src="${escapeHtml(images[0])}" alt="" loading="lazy" onerror="this.closest('.card-photo').classList.add('img-error')"></div>`;
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
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="photo-gallery-item"><img src="${escapeHtml(url)}" alt="" loading="lazy"></a>`
    )
    .join('')}</div>`;
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
