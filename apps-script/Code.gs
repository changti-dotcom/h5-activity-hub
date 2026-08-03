// H5 活動資料庫 / 靈感庫 — 共用資料庫後端
// 部署方式請見同目錄下的 SETUP.md

const SHEET_ACTIVITIES = 'Activities';
const SHEET_IDEAS = 'Ideas';
// 舊版「我有熱點活動靈感」用過的獨立分頁，現在頁面已合併成單一「我有活動靈感」，
// 但這個分頁如果同事之前已經用過、存了真實資料，不能直接丟掉——讀取時會把這個分頁
// 也一起讀出來、合併進同一份清單（用 ideaType 標記回原本的類型），寫入新資料則一律
// 存進 SHEET_IDEAS，用 ideaType 欄位區分 H5 / 熱點活動。
const SHEET_HOT_IDEAS = 'HotIdeas';

const ACTIVITIES_HEADERS = [
  'id', 'name', 'activityType', 'dateText', 'dateStart', 'dateEnd', 'description', 'mechanism',
  'mechanismTags', 'purposeTags', 'specialTags', 'metrics', 'referenceLink', 'images',
  'createdBy', 'createdAt', 'status',
];

// purposeTags 這裡實際存放的是「我要找活動靈感」頁面的目標選項（見 Shared.html 的 GOAL_TAGS），
// 不是過往活動用的舊 PURPOSE_TAGS（拉新/回流…），沿用 root 前端 js/mock-data.js 的既有欄位設計。
const IDEAS_HEADERS = [
  'id', 'ideaType', 'title', 'description', 'submittedBy', 'images', 'demoUrl', 'topicRef',
  'attachments', 'purposeTags', 'inspirationRef', 'likes', 'comments', 'createdAt',
];

// 頁面名稱 → HTML 樣板檔案名稱（樣板檔案放在 apps-script/webapp/ 底下，需另外貼進 Apps Script 編輯器）
const PAGE_TEMPLATES = {
  index: 'Index',
  generate: 'Generate',
  activities: 'Activities',
  ideas: 'Ideas',
};

function doGet(e) {
  const type = e.parameter.type;
  if (type === 'activities') return respond(getRows(SHEET_ACTIVITIES, ACTIVITIES_HEADERS));
  if (type === 'ideas') return respond(getAllIdeas());
  if (type) return respond({ error: 'unknown type: ' + type });

  const page = PAGE_TEMPLATES[e.parameter.page] ? e.parameter.page : 'index';
  const template = HtmlService.createTemplateFromFile(PAGE_TEMPLATES[page]);
  template.baseUrl = ScriptApp.getService().getUrl();
  return template.evaluate()
    .setTitle('活動靈感大對決 ‧ 傳說營運的靈感倉庫')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 給 HTML 樣板用來內嵌共用檔案（Shared.html）的小工具
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ---------- 給前端用 google.script.run 呼叫的包裝函式 ----------
// 前端（Shared.html）透過 google.script.run 呼叫這幾個函式讀寫資料，
// 不走 fetch()，所以不會遇到「網域限定存取」造成的登入導向問題。

function getActivitiesForClient() {
  return getRows(SHEET_ACTIVITIES, ACTIVITIES_HEADERS);
}

function addActivityForClient(data) {
  return addActivity(data);
}

function getIdeasForClient() {
  return getAllIdeas();
}

function addIdeaForClient(data) {
  return addIdea(data);
}

function updateIdeaForClient(payload) {
  const data = Object.assign({}, payload);
  const id = data.id;
  delete data.id;
  return updateIdea(id, data);
}

function deleteIdeaForClient(id) {
  return deleteIdea(id);
}

function likeIdeaForClient(id) {
  return likeIdea(id);
}

function unlikeIdeaForClient(id) {
  return unlikeIdea(id);
}

function addCommentForClient(payload) {
  return addComment(payload.id, { author: payload.author, text: payload.text });
}

function updateCommentForClient(payload) {
  return updateComment(payload.id, payload.commentId, { author: payload.author, text: payload.text });
}

function deleteCommentForClient(payload) {
  return deleteComment(payload.id, payload.commentId);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const data = body.data || {};
  if (body.action === 'addIdea') return respond(addIdea(data));
  if (body.action === 'updateIdea') return respond(updateIdea(data.id, data));
  if (body.action === 'deleteIdea') return respond(deleteIdea(data.id));
  if (body.action === 'likeIdea') return respond(likeIdea(data.id));
  if (body.action === 'unlikeIdea') return respond(unlikeIdea(data.id));
  if (body.action === 'addComment') return respond(addComment(data.id, { author: data.author, text: data.text }));
  if (body.action === 'updateComment') return respond(updateComment(data.id, data.commentId, { author: data.author, text: data.text }));
  if (body.action === 'deleteComment') return respond(deleteComment(data.id, data.commentId));
  if (body.action === 'addActivity') return respond(addActivity(data));
  return respond({ error: 'unknown action: ' + body.action });
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }
  // 舊分頁可能是用更早版本的程式碼建立的，欄位會少於現在需要的欄位。
  // 這裡只把「缺少的欄位」補到標題列最後面，不會動到既有欄位或任何一列資料，
  // 讓程式碼升級後不需要手動改 Google Sheet 也能運作。
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter((h) => h !== '');
  const missing = headers.filter((h) => existingHeaders.indexOf(h) === -1);
  if (missing.length) {
    sheet.getRange(1, existingHeaders.length + 1, 1, missing.length).setValues([missing]);
  }
  return sheet;
}

// 讀取分頁「目前實際」的標題列（可能跟傳入的 headers 常數順序不同，
// 因為舊分頁升級時新欄位是補在最後面），寫入資料時要照這個順序才不會寫錯欄位。
function getActualHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter((h) => h !== '');
}

function getRows(sheetName, headers) {
  const sheet = getOrCreateSheet(sheetName, headers);
  const values = sheet.getDataRange().getValues();
  const fileHeaders = values.shift() || headers;
  return values
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => {
      const obj = {};
      fileHeaders.forEach((h, i) => {
        obj[h] = parseCell(h, row[i]);
      });
      return obj;
    });
}

// 合併「我有活動靈感」的資料來源：主要的 Ideas 分頁，加上舊版「我有熱點活動靈感」
// 用過的 HotIdeas 分頁（如果同事之前用過、裡面有真實資料，一樣讀得到，只是預設標成熱點活動）。
function getAllIdeas() {
  // 用 `||` 補預設值而不是整包 Object.assign 蓋過去，避免舊資料的 ideaType 欄位是空字串時
  // 被覆蓋成正確值又被空字串蓋掉——只有真的沒有值時才套用「依所在分頁判斷」的預設類型。
  const fromIdeas = getRows(SHEET_IDEAS, IDEAS_HEADERS).map((r) => {
    r.ideaType = r.ideaType || 'h5';
    return r;
  });
  const fromHotIdeas = getRows(SHEET_HOT_IDEAS, IDEAS_HEADERS).map((r) => {
    r.ideaType = r.ideaType || 'hotspot';
    return r;
  });
  return fromIdeas.concat(fromHotIdeas);
}

// 陣列類欄位在 Sheet 裡以逗號分隔字串儲存，讀取時還原成陣列
const ARRAY_FIELDS = ['mechanismTags', 'purposeTags', 'specialTags'];
// 照片／附件連結陣列改用換行分隔（URL 本身可能含逗號），讀取時還原成陣列
const NEWLINE_ARRAY_FIELDS = ['images', 'attachments'];
// JSON 物件／陣列欄位
const JSON_FIELDS = ['metrics', 'comments'];

function parseCell(header, value) {
  // Google Sheet 有時會自動把貼上的文字（例如 2026-06-18）判斷成「日期」格式儲存格，
  // 這種情況 Apps Script 讀到的會是 Date 物件，直接透過 google.script.run 傳回前端時
  // 容易整包資料序列化失敗（變成 null）。這裡統一轉回純文字字串，避免這個問題。
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }
  if (ARRAY_FIELDS.indexOf(header) !== -1) {
    return value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : [];
  }
  if (NEWLINE_ARRAY_FIELDS.indexOf(header) !== -1) {
    return value ? String(value).split('\n').map((s) => s.trim()).filter(Boolean) : [];
  }
  if (header === 'metrics') {
    if (!value) return null;
    try { return JSON.parse(value); } catch (e) { return { summary: value }; }
  }
  if (header === 'comments') {
    if (!value) return [];
    try { return JSON.parse(value); } catch (e) { return []; }
  }
  if (header === 'likes') {
    return value ? Number(value) : 0;
  }
  return value;
}

// 寫入 Sheet 前，把陣列/物件欄位序列化回純文字（parseCell 的反向操作）
function serializeField(header, value) {
  if (ARRAY_FIELDS.indexOf(header) !== -1) return (value || []).join(',');
  if (NEWLINE_ARRAY_FIELDS.indexOf(header) !== -1) return (value || []).join('\n');
  if (JSON_FIELDS.indexOf(header) !== -1) return value ? JSON.stringify(value) : '';
  if (header === 'likes') return value || 0;
  return value || '';
}

function findRowIndexById(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) return i + 1; // 1-indexed sheet row number
  }
  return -1;
}

// 找出某個 id 實際存在哪一個分頁（Ideas 或舊版 HotIdeas），編輯/刪除/按讚/留言都要先知道這個
function findIdeaSheetName(id) {
  const ideasSheet = getOrCreateSheet(SHEET_IDEAS, IDEAS_HEADERS);
  if (findRowIndexById(ideasSheet, id) !== -1) return SHEET_IDEAS;
  const hotSheet = getOrCreateSheet(SHEET_HOT_IDEAS, IDEAS_HEADERS);
  if (findRowIndexById(hotSheet, id) !== -1) return SHEET_HOT_IDEAS;
  return null;
}

function addRecord(sheetName, headers, idPrefix, data, defaults) {
  const sheet = getOrCreateSheet(sheetName, headers);
  const actualHeaders = getActualHeaders(sheet);
  const id = idPrefix + '_' + new Date().getTime();
  const row = actualHeaders.map((h) => {
    if (h === 'id') return id;
    if (h === 'createdAt') return new Date().toISOString();
    if (defaults && Object.prototype.hasOwnProperty.call(defaults, h) && !data[h]) return defaults[h];
    return serializeField(h, data[h]);
  });
  sheet.appendRow(row);
  return { success: true, id };
}

function updateRecord(sheetName, headers, id, data) {
  const sheet = getOrCreateSheet(sheetName, headers);
  const actualHeaders = getActualHeaders(sheet);
  const rowIndex = findRowIndexById(sheet, id);
  if (rowIndex === -1) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  const existing = sheet.getRange(rowIndex, 1, 1, actualHeaders.length).getValues()[0];
  const newRow = actualHeaders.map((h, i) => (Object.prototype.hasOwnProperty.call(data, h) ? serializeField(h, data[h]) : existing[i]));
  sheet.getRange(rowIndex, 1, 1, actualHeaders.length).setValues([newRow]);
  return { success: true };
}

function deleteRecord(sheetName, headers, id) {
  const sheet = getOrCreateSheet(sheetName, headers);
  const rowIndex = findRowIndexById(sheet, id);
  if (rowIndex === -1) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  sheet.deleteRow(rowIndex);
  return { success: true };
}

// ---------- 我有活動靈感（H5 + 熱點合併，用 ideaType 區分） ----------

function addIdea(data) {
  const targetSheet = data.ideaType === 'hotspot' ? SHEET_HOT_IDEAS : SHEET_IDEAS;
  return addRecord(targetSheet, IDEAS_HEADERS, 'idea', data, { ideaType: data.ideaType || 'h5', likes: 0 });
}

function updateIdea(id, data) {
  const sheetName = findIdeaSheetName(id);
  if (!sheetName) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  return updateRecord(sheetName, IDEAS_HEADERS, id, data);
}

function deleteIdea(id) {
  const sheetName = findIdeaSheetName(id);
  if (!sheetName) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  return deleteRecord(sheetName, IDEAS_HEADERS, id);
}

function likeIdea(id) {
  const sheetName = findIdeaSheetName(id);
  if (!sheetName) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  const sheet = getOrCreateSheet(sheetName, IDEAS_HEADERS);
  const actualHeaders = getActualHeaders(sheet);
  const rowIndex = findRowIndexById(sheet, id);
  const col = actualHeaders.indexOf('likes') + 1;
  const current = Number(sheet.getRange(rowIndex, col).getValue()) || 0;
  const next = current + 1;
  sheet.getRange(rowIndex, col).setValue(next);
  return { success: true, likes: next };
}

function unlikeIdea(id) {
  const sheetName = findIdeaSheetName(id);
  if (!sheetName) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  const sheet = getOrCreateSheet(sheetName, IDEAS_HEADERS);
  const actualHeaders = getActualHeaders(sheet);
  const rowIndex = findRowIndexById(sheet, id);
  const col = actualHeaders.indexOf('likes') + 1;
  const current = Number(sheet.getRange(rowIndex, col).getValue()) || 0;
  const next = Math.max(0, current - 1);
  sheet.getRange(rowIndex, col).setValue(next);
  return { success: true, likes: next };
}

// 取出某個 id 那一列目前的留言陣列，連同「這格在哪個分頁的哪一欄」一起回傳，
// 方便 addComment/updateComment/deleteComment 共用同一套讀寫邏輯。
function getCommentsCell(id) {
  const sheetName = findIdeaSheetName(id);
  if (!sheetName) return null;
  const sheet = getOrCreateSheet(sheetName, IDEAS_HEADERS);
  const actualHeaders = getActualHeaders(sheet);
  const rowIndex = findRowIndexById(sheet, id);
  const col = actualHeaders.indexOf('comments') + 1;
  const raw = sheet.getRange(rowIndex, col).getValue();
  let comments = [];
  try { comments = raw ? JSON.parse(raw) : []; } catch (e) { comments = []; }
  return { sheet: sheet, row: rowIndex, col: col, comments: comments };
}

function addComment(id, comment) {
  const cell = getCommentsCell(id);
  if (!cell) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  cell.comments.push({
    id: 'c_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1e6),
    author: comment.author || '匿名',
    text: comment.text || '',
    createdAt: new Date().toISOString(),
  });
  cell.sheet.getRange(cell.row, cell.col).setValue(JSON.stringify(cell.comments));
  return { success: true };
}

function updateComment(id, commentId, data) {
  const cell = getCommentsCell(id);
  if (!cell) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  const comments = cell.comments.map(function (c) {
    return c.id === commentId ? Object.assign({}, c, data) : c;
  });
  cell.sheet.getRange(cell.row, cell.col).setValue(JSON.stringify(comments));
  return { success: true };
}

function deleteComment(id, commentId) {
  const cell = getCommentsCell(id);
  if (!cell) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  const comments = cell.comments.filter(function (c) { return c.id !== commentId; });
  cell.sheet.getRange(cell.row, cell.col).setValue(JSON.stringify(comments));
  return { success: true };
}

// ---------- 過往歷史活動 ----------

function addActivity(data) {
  return addRecord(SHEET_ACTIVITIES, ACTIVITIES_HEADERS, 'activity', data, { createdBy: '匿名', status: 'draft' });
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
