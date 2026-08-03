// 「我有活動靈感」：H5 活動靈感跟熱點活動靈感合併在同一個靈感庫，
// 上傳時用「活動類型」選項區分，篩選/排序/按讚留言邏輯兩種類型共用。

const LIKED_IDEAS_KEY = 'h5_liked_ideas_v1';

let ALL_IDEAS = [];
const activeFilters = { purpose: new Set() };
let searchTerm = '';
let editingIdeaId = null;

const IDEA_PURPOSE_TAGS = GOAL_TAGS.map((g) => g.key);

function getLikedIdeaIds() {
  return new Set(readLocal(LIKED_IDEAS_KEY));
}

function markIdeaLiked(id) {
  const liked = getLikedIdeaIds();
  liked.add(id);
  writeLocal(LIKED_IDEAS_KEY, [...liked]);
}

function unmarkIdeaLiked(id) {
  const liked = getLikedIdeaIds();
  liked.delete(id);
  writeLocal(LIKED_IDEAS_KEY, [...liked]);
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

// 按讚數多的點子浮上去：先比讚數，同讚數再比新舊
function sortIdeas(list) {
  return list.sort((a, b) => (b.likes || 0) - (a.likes || 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function reloadIdeas() {
  ALL_IDEAS = sortIdeas(await fetchIdeas());
  renderList();
}

function wireDetailModalActions(idea) {
  const box = document.getElementById('detailModalBox');
  const editBtn = box.querySelector('.manage-edit-btn');
  const deleteBtn = box.querySelector('.manage-delete-btn');
  const likeBtn = box.querySelector('.like-btn');
  const commentForm = box.querySelector('.comment-form');

  if (editBtn) editBtn.addEventListener('click', () => openAddOrEditModal(idea));
  if (deleteBtn) deleteBtn.addEventListener('click', () => handleDeleteIdea(idea));

  if (likeBtn) {
    updateLikeButtonUi(likeBtn, idea);
    likeBtn.addEventListener('click', () => handleToggleLike(idea));
  }

  if (commentForm) {
    commentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAddComment(idea, commentForm);
    });
  }

  box.querySelectorAll('.comment-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => startEditComment(idea, btn.dataset.commentId));
  });
  box.querySelectorAll('.comment-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => handleDeleteComment(idea, btn.dataset.commentId));
  });
}

function updateLikeButtonUi(btn, idea) {
  const liked = getLikedIdeaIds().has(idea.id);
  btn.classList.toggle('liked', liked);
  btn.textContent = liked ? `👍 已按讚（${idea.likes || 0}）` : `👍 按讚（${idea.likes || 0}）`;
}

function refreshDetailModal(ideaId, fallbackIdea) {
  const updated = ALL_IDEAS.find((x) => x.id === ideaId) || fallbackIdea;
  renderIdeaDetailModal(updated, { manageActions: true });
  wireDetailModalActions(updated);
}

function openDetail(id) {
  const idea = ALL_IDEAS.find((x) => x.id === id);
  if (!idea) return;
  renderIdeaDetailModal(idea, { manageActions: true });
  wireDetailModalActions(idea);
}

async function handleToggleLike(idea) {
  const liked = getLikedIdeaIds().has(idea.id);
  const result = liked ? await unlikeIdea(idea.id) : await likeIdea(idea.id);
  if (result && result.success) {
    if (liked) unmarkIdeaLiked(idea.id);
    else markIdeaLiked(idea.id);
    await reloadIdeas();
    refreshDetailModal(idea.id, idea);
  } else {
    toast('操作失敗，請稍後再試');
  }
}

async function handleAddComment(idea, form) {
  const author = form.commentAuthor.value.trim();
  const text = form.commentText.value.trim();
  if (!author || !text) return;
  const result = await addComment(idea.id, { author, text });
  if (result && result.success) {
    toast('留言送出！');
    await reloadIdeas();
    refreshDetailModal(idea.id, idea);
  } else {
    toast('留言失敗，請稍後再試');
  }
}

function findCommentByKey(comments, commentId) {
  if (commentId.startsWith('idx_')) return comments[Number(commentId.slice(4))];
  return comments.find((c) => c.id === commentId);
}

function startEditComment(idea, commentId) {
  const comment = findCommentByKey(idea.comments || [], commentId);
  if (!comment) return;
  const item = document.querySelector(`.comment-item[data-comment-id="${commentId}"]`);
  if (!item) return;
  item.innerHTML = `
    <div class="form-group" style="margin-bottom:8px;">
      <input type="text" class="edit-comment-author" value="${escapeHtml(comment.author || '')}">
    </div>
    <div class="form-group" style="margin-bottom:8px;">
      <textarea class="edit-comment-text" style="min-height:60px;">${escapeHtml(comment.text || '')}</textarea>
    </div>
    <div class="form-actions" style="margin-top:0;">
      <button type="button" class="btn btn-outline btn-sm cancel-edit-comment-btn">取消</button>
      <button type="button" class="btn btn-primary btn-sm save-edit-comment-btn">儲存</button>
    </div>
  `;
  item.querySelector('.cancel-edit-comment-btn').addEventListener('click', () => refreshDetailModal(idea.id, idea));
  item.querySelector('.save-edit-comment-btn').addEventListener('click', () => saveEditComment(idea, commentId, item));
}

async function saveEditComment(idea, commentId, item) {
  const author = item.querySelector('.edit-comment-author').value.trim();
  const text = item.querySelector('.edit-comment-text').value.trim();
  if (!author || !text) return;
  const result = await updateComment(idea.id, commentId, { author, text });
  if (result && result.success) {
    toast('留言已更新');
    await reloadIdeas();
    refreshDetailModal(idea.id, idea);
  } else {
    toast('更新失敗，請稍後再試');
  }
}

async function handleDeleteComment(idea, commentId) {
  if (!confirm('確定要刪除這則留言嗎？')) return;
  const result = await deleteComment(idea.id, commentId);
  if (result && result.success) {
    toast('留言已刪除');
    await reloadIdeas();
    refreshDetailModal(idea.id, idea);
  } else {
    toast('刪除失敗，請稍後再試');
  }
}

function setIdeaTypeUi(type) {
  const attachmentsGroup = document.getElementById('attachmentsFieldGroup');
  attachmentsGroup.style.display = type === 'hotspot' ? 'none' : '';
}

function openAddOrEditModal(idea) {
  editingIdeaId = idea ? idea.id : null;
  document.getElementById('addIdeaModalTitle').textContent = idea ? '編輯點子' : '新增點子';
  document.getElementById('addIdeaSubmitBtn').textContent = idea ? '儲存變更' : '送出';
  const form = document.getElementById('addIdeaForm');
  const type = idea ? idea.ideaType || 'h5' : 'h5';
  form.querySelector(`input[name="ideaType"][value="${type}"]`).checked = true;
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

async function handleDeleteIdea(idea) {
  if (!confirm(`確定要刪除「${idea.title}」嗎？此動作無法復原。`)) return;
  const result = await deleteIdea(idea.id);
  if (result && result.success) {
    toast('已刪除該則點子');
    closeModal('detailModal');
    await reloadIdeas();
  } else {
    toast('刪除失敗，請稍後再試');
  }
}

async function init() {
  await reloadIdeas();
  buildFilterChips('filterPurpose', IDEA_PURPOSE_TAGS, 'purpose');

  document.getElementById('searchInput').addEventListener(
    'input',
    debounce((e) => {
      searchTerm = e.target.value.trim();
      renderList();
    }, 200)
  );

  document.querySelectorAll('input[name="ideaType"]').forEach((radio) => {
    radio.addEventListener('change', (e) => setIdeaTypeUi(e.target.value));
  });
}

document.getElementById('openAddIdeaBtn').addEventListener('click', () => openAddOrEditModal(null));

document.getElementById('addIdeaForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const ideaType = form.querySelector('input[name="ideaType"]:checked').value;
  const data = {
    ideaType,
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    submittedBy: form.submittedBy.value.trim(),
    images: form.imageUrl.value.trim() ? [form.imageUrl.value.trim()] : [],
    demoUrl: form.demoUrl.value.trim(),
    topicRef: form.topicRef.value.trim(),
    attachments: ideaType === 'h5'
      ? form.attachments.value.split('\n').map((s) => s.trim()).filter(Boolean)
      : [],
    purposeTags: getSelectedChips(document.getElementById('formPurposeTags')),
    inspirationRef: form.inspirationRef.value.trim(),
  };
  if (!data.title || !data.submittedBy) return;

  const result = editingIdeaId ? await updateIdea(editingIdeaId, data) : await submitIdea(data);

  if (result && result.success) {
    toast(editingIdeaId ? '已更新點子！' : '已新增點子，感謝分享！' + (result.local ? '（示範模式，僅存在此瀏覽器）' : ''));
    form.reset();
    editingIdeaId = null;
    closeModal('addIdeaModal');
    closeModal('detailModal');
    await reloadIdeas();
  } else {
    toast(editingIdeaId ? '更新失敗，請稍後再試' : '新增失敗，請稍後再試');
  }
});

init();
