// 資料存取層。CONFIG.API_URL 未設定時走「示範模式」：
// 讀取 mock-data.js 的種子資料，新增的內容則暫存於瀏覽器 localStorage（僅該裝置看得到）。
// 設定好 API_URL 後，所有讀寫都會改打 Apps Script，變成團隊共用資料庫。

const LOCAL_KEYS = {
  ideas: 'h5_local_ideas_v1',
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

async function fetchActivities() {
  if (CONFIG.USE_MOCK) {
    return [...readLocal(LOCAL_KEYS.activities), ...MOCK_ACTIVITIES];
  }
  const res = await fetch(`${CONFIG.API_URL}?type=activities`);
  if (!res.ok) throw new Error('讀取活動資料失敗');
  return res.json();
}

async function fetchIdeas() {
  if (CONFIG.USE_MOCK) {
    return [...readLocal(LOCAL_KEYS.ideas), ...MOCK_IDEAS];
  }
  const res = await fetch(`${CONFIG.API_URL}?type=ideas`);
  if (!res.ok) throw new Error('讀取活動靈感失敗');
  return res.json();
}

async function submitIdea(data) {
  if (CONFIG.USE_MOCK) {
    const list = readLocal(LOCAL_KEYS.ideas);
    const idea = { id: 'local_' + list.length + '_' + Math.floor(Math.random() * 1e6), createdAt: new Date().toISOString(), ...data };
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
