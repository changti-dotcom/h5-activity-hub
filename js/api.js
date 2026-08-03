// 資料存取層。CONFIG.API_URL 未設定時走「示範模式」：
// 讀取 mock-data.js 的種子資料，新增的內容則暫存於瀏覽器 localStorage（僅該裝置看得到）。
// 設定好 API_URL 後，所有讀寫都會改打 Apps Script，變成團隊共用資料庫。

const LOCAL_KEYS = {
  activities: 'h5_local_activities_v1',
  activityEdits: 'h5_local_activity_edits_v1',
  ideas: 'h5_local_ideas_v1',
  ideaEdits: 'h5_local_idea_edits_v1',
  ideaDeletes: 'h5_local_idea_deletes_v1',
};

function readLocal(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}

function writeLocal(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

// 種子資料（mock-data.js）沒辦法直接改寫，示範模式下對種子資料的編輯/刪除
// 分別記在對應的 edits/deletes key 裡（edits: id -> 覆蓋欄位；deletes: 被刪除的 id 清單），
// 讀取時再套用到種子資料上，讓示範模式也能編輯/刪除任何一筆資料。
function readLocalMap(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch (e) {
    return {};
  }
}

function writeLocalMap(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}

async function fetchActivities() {
  if (CONFIG.USE_MOCK) {
    const edits = readLocalMap(LOCAL_KEYS.activityEdits);
    const seedActivities = MOCK_ACTIVITIES.map((a) => (edits[a.id] ? { ...a, ...edits[a.id] } : a));
    return [...readLocal(LOCAL_KEYS.activities), ...seedActivities];
  }
  const res = await fetch(`${CONFIG.API_URL}?type=activities`);
  if (!res.ok) throw new Error('讀取活動資料失敗');
  return res.json();
}

async function submitActivity(data) {
  if (CONFIG.USE_MOCK) {
    const list = readLocal(LOCAL_KEYS.activities);
    const activity = { id: 'local_' + list.length + '_' + Math.floor(Math.random() * 1e6), createdAt: new Date().toISOString(), status: 'draft', ...data };
    list.unshift(activity);
    writeLocal(LOCAL_KEYS.activities, list);
    return { success: true, id: activity.id, local: true };
  }
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'addActivity', data }),
  });
  return res.json();
}

async function updateActivity(id, data) {
  if (CONFIG.USE_MOCK) {
    if (id.startsWith('local_')) {
      const list = readLocal(LOCAL_KEYS.activities);
      const idx = list.findIndex((a) => a.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data };
        writeLocal(LOCAL_KEYS.activities, list);
      }
    } else {
      const edits = readLocalMap(LOCAL_KEYS.activityEdits);
      edits[id] = { ...(edits[id] || {}), ...data };
      writeLocalMap(LOCAL_KEYS.activityEdits, edits);
    }
    return { success: true, local: true };
  }
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'updateActivity', data: { id, ...data } }),
  });
  return res.json();
}

async function generateSuggestions(data) {
  if (CONFIG.USE_MOCK) {
    return {
      error: '示範模式尚未連接 AI 服務。請先依 apps-script/SETUP.md 的「啟用 AI 活動發想產生器」章節設定好共用資料庫與 API 金鑰後再試。',
    };
  }
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'generateSuggestion', data }),
  });
  return res.json();
}

// ---------- 我有活動靈感（H5 + 熱點合併在同一個靈感庫） ----------

async function fetchIdeas() {
  if (CONFIG.USE_MOCK) {
    const deleted = new Set(readLocal(LOCAL_KEYS.ideaDeletes));
    const edits = readLocalMap(LOCAL_KEYS.ideaEdits);
    const localIdeas = readLocal(LOCAL_KEYS.ideas).filter((i) => !deleted.has(i.id));
    const seedIdeas = MOCK_IDEAS
      .filter((i) => !deleted.has(i.id))
      .map((i) => (edits[i.id] ? { ...i, ...edits[i.id] } : i));
    return [...localIdeas, ...seedIdeas];
  }
  const res = await fetch(`${CONFIG.API_URL}?type=ideas`);
  if (!res.ok) throw new Error('讀取活動靈感失敗');
  return res.json();
}

async function submitIdea(data) {
  if (CONFIG.USE_MOCK) {
    const list = readLocal(LOCAL_KEYS.ideas);
    const idea = { id: 'local_' + list.length + '_' + Math.floor(Math.random() * 1e6), createdAt: new Date().toISOString(), likes: 0, comments: [], ...data };
    list.unshift(idea);
    writeLocal(LOCAL_KEYS.ideas, list);
    return { success: true, id: idea.id, local: true };
  }
  // 注意：body 用純字串（不手動設定 Content-Type）可避免觸發 CORS 預檢請求，
  // Apps Script 網頁應用程式不處理 OPTIONS 預檢，設定 header 會導致請求失敗。
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'addIdea', data }),
  });
  return res.json();
}

async function updateIdea(id, data) {
  if (CONFIG.USE_MOCK) {
    if (id.startsWith('local_')) {
      const list = readLocal(LOCAL_KEYS.ideas);
      const idx = list.findIndex((i) => i.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data };
        writeLocal(LOCAL_KEYS.ideas, list);
      }
    } else {
      const edits = readLocalMap(LOCAL_KEYS.ideaEdits);
      edits[id] = { ...(edits[id] || {}), ...data };
      writeLocalMap(LOCAL_KEYS.ideaEdits, edits);
    }
    return { success: true, local: true };
  }
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'updateIdea', data: { id, ...data } }),
  });
  return res.json();
}

async function deleteIdea(id) {
  if (CONFIG.USE_MOCK) {
    if (id.startsWith('local_')) {
      writeLocal(LOCAL_KEYS.ideas, readLocal(LOCAL_KEYS.ideas).filter((i) => i.id !== id));
    } else {
      const deleted = new Set(readLocal(LOCAL_KEYS.ideaDeletes));
      deleted.add(id);
      writeLocal(LOCAL_KEYS.ideaDeletes, [...deleted]);
    }
    return { success: true, local: true };
  }
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'deleteIdea', data: { id } }),
  });
  return res.json();
}

// 按讚／留言都是在既有資料上做小幅修改，所以直接複用 updateIdea：
// 先讀出目前（含其他人已經按過的讚／留言）的最新狀態，算出新值，再整包存回去。
async function likeIdea(id) {
  const all = await fetchIdeas();
  const idea = all.find((i) => i.id === id);
  if (!idea) return { success: false, error: '找不到這筆點子' };
  return updateIdea(id, { likes: (idea.likes || 0) + 1 });
}

async function unlikeIdea(id) {
  const all = await fetchIdeas();
  const idea = all.find((i) => i.id === id);
  if (!idea) return { success: false, error: '找不到這筆點子' };
  return updateIdea(id, { likes: Math.max(0, (idea.likes || 0) - 1) });
}

async function addComment(id, comment) {
  const all = await fetchIdeas();
  const idea = all.find((i) => i.id === id);
  if (!idea) return { success: false, error: '找不到這筆點子' };
  const newComment = {
    id: 'c_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1e6),
    ...comment,
    createdAt: new Date().toISOString(),
  };
  const comments = [...(idea.comments || []), newComment];
  return updateIdea(id, { comments });
}

// 這個功能上線前留下的舊留言沒有 id，前端會改用陣列位置當識別碼（格式 "idx_數字"），
// 這裡統一還原成實際的陣列索引，讓編輯/刪除對新舊留言都能用。
function resolveCommentIndex(comments, commentId) {
  if (typeof commentId === 'string' && commentId.startsWith('idx_')) {
    return Number(commentId.slice(4));
  }
  return comments.findIndex((c) => c.id === commentId);
}

async function updateComment(ideaId, commentId, data) {
  const all = await fetchIdeas();
  const idea = all.find((i) => i.id === ideaId);
  if (!idea) return { success: false, error: '找不到這筆點子' };
  const comments = [...(idea.comments || [])];
  const idx = resolveCommentIndex(comments, commentId);
  if (idx < 0 || idx >= comments.length) return { success: false, error: '找不到這則留言' };
  comments[idx] = { ...comments[idx], ...data };
  return updateIdea(ideaId, { comments });
}

async function deleteComment(ideaId, commentId) {
  const all = await fetchIdeas();
  const idea = all.find((i) => i.id === ideaId);
  if (!idea) return { success: false, error: '找不到這筆點子' };
  const comments = [...(idea.comments || [])];
  const idx = resolveCommentIndex(comments, commentId);
  if (idx < 0 || idx >= comments.length) return { success: false, error: '找不到這則留言' };
  comments.splice(idx, 1);
  return updateIdea(ideaId, { comments });
}
