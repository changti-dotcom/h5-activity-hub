// 資料存取層。CONFIG.API_URL 未設定時走「示範模式」：
// 讀取 mock-data.js 的種子資料，新增的內容則暫存於瀏覽器 localStorage（僅該裝置看得到）。
// 設定好 API_URL 後，所有讀寫都會改打 Apps Script，變成團隊共用資料庫。

const LOCAL_KEYS = {
  activities: 'h5_local_activities_v1',
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
    return [...readLocal(LOCAL_KEYS.activities), ...MOCK_ACTIVITIES];
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

// ---------- 點子庫（我有 H5 活動靈感／我有熱點活動靈感）共用的 CRUD 邏輯 ----------
// 兩個點子庫的上傳/編輯/刪除邏輯完全一樣，差別只在種子資料來源跟 localStorage/API 用的 key，
// 所以抽成一份設定表 + 一組通用函式，避免兩份頁面各寫一套一樣的程式碼。

const IDEA_COLLECTIONS = {
  ideas: {
    mockData: () => MOCK_IDEAS,
    local: 'h5_local_ideas_v1',
    edits: 'h5_local_idea_edits_v1',
    deletes: 'h5_local_idea_deletes_v1',
    apiType: 'ideas',
    addAction: 'addIdea',
    updateAction: 'updateIdea',
    deleteAction: 'deleteIdea',
  },
  hotIdeas: {
    mockData: () => MOCK_HOT_IDEAS,
    local: 'h5_local_hot_ideas_v1',
    edits: 'h5_local_hot_idea_edits_v1',
    deletes: 'h5_local_hot_idea_deletes_v1',
    apiType: 'hotIdeas',
    addAction: 'addHotIdea',
    updateAction: 'updateHotIdea',
    deleteAction: 'deleteHotIdea',
  },
};

async function fetchIdeaCollection(ns) {
  const cfg = IDEA_COLLECTIONS[ns];
  if (CONFIG.USE_MOCK) {
    const deleted = new Set(readLocal(cfg.deletes));
    const edits = readLocalMap(cfg.edits);
    const localItems = readLocal(cfg.local).filter((i) => !deleted.has(i.id));
    const seedItems = cfg
      .mockData()
      .filter((i) => !deleted.has(i.id))
      .map((i) => (edits[i.id] ? { ...i, ...edits[i.id] } : i));
    return [...localItems, ...seedItems];
  }
  const res = await fetch(`${CONFIG.API_URL}?type=${cfg.apiType}`);
  if (!res.ok) throw new Error('讀取活動靈感失敗');
  return res.json();
}

async function submitIdeaToCollection(ns, data) {
  const cfg = IDEA_COLLECTIONS[ns];
  if (CONFIG.USE_MOCK) {
    const list = readLocal(cfg.local);
    const idea = { id: 'local_' + list.length + '_' + Math.floor(Math.random() * 1e6), createdAt: new Date().toISOString(), ...data };
    list.unshift(idea);
    writeLocal(cfg.local, list);
    return { success: true, id: idea.id, local: true };
  }
  // 注意：body 用純字串（不手動設定 Content-Type）可避免觸發 CORS 預檢請求，
  // Apps Script 網頁應用程式不處理 OPTIONS 預檢，設定 header 會導致請求失敗。
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: cfg.addAction, data }),
  });
  return res.json();
}

async function updateIdeaInCollection(ns, id, data) {
  const cfg = IDEA_COLLECTIONS[ns];
  if (CONFIG.USE_MOCK) {
    if (id.startsWith('local_')) {
      const list = readLocal(cfg.local);
      const idx = list.findIndex((i) => i.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data };
        writeLocal(cfg.local, list);
      }
    } else {
      const edits = readLocalMap(cfg.edits);
      edits[id] = { ...(edits[id] || {}), ...data };
      writeLocalMap(cfg.edits, edits);
    }
    return { success: true, local: true };
  }
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: cfg.updateAction, data: { id, ...data } }),
  });
  return res.json();
}

async function deleteIdeaFromCollection(ns, id) {
  const cfg = IDEA_COLLECTIONS[ns];
  if (CONFIG.USE_MOCK) {
    if (id.startsWith('local_')) {
      writeLocal(cfg.local, readLocal(cfg.local).filter((i) => i.id !== id));
    } else {
      const deleted = new Set(readLocal(cfg.deletes));
      deleted.add(id);
      writeLocal(cfg.deletes, [...deleted]);
    }
    return { success: true, local: true };
  }
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action: cfg.deleteAction, data: { id } }),
  });
  return res.json();
}

// 「我有 H5 活動靈感」沿用原本的函式名稱，維持向下相容
async function fetchIdeas() { return fetchIdeaCollection('ideas'); }
async function submitIdea(data) { return submitIdeaToCollection('ideas', data); }
async function updateIdea(id, data) { return updateIdeaInCollection('ideas', id, data); }
async function deleteIdea(id) { return deleteIdeaFromCollection('ideas', id); }

// 「我有熱點活動靈感」用的對應函式
async function fetchHotIdeas() { return fetchIdeaCollection('hotIdeas'); }
async function submitHotIdea(data) { return submitIdeaToCollection('hotIdeas', data); }
async function updateHotIdea(id, data) { return updateIdeaInCollection('hotIdeas', id, data); }
async function deleteHotIdea(id) { return deleteIdeaFromCollection('hotIdeas', id); }
