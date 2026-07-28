// H5 活動資料庫 / 靈感庫 — 共用資料庫後端
// 部署方式請見同目錄下的 SETUP.md

const SHEET_ACTIVITIES = 'Activities';
const SHEET_IDEAS = 'Ideas';
const SHEET_HOT_IDEAS = 'HotIdeas';

const ACTIVITIES_HEADERS = [
  'id', 'name', 'dateText', 'dateStart', 'dateEnd', 'description', 'mechanism',
  'mechanismTags', 'purposeTags', 'specialTags', 'metrics', 'referenceLink', 'images',
  'createdBy', 'createdAt', 'status',
];

// 「我有H5活動靈感」與「我有熱點活動靈感」共用同一套欄位結構（各自存在獨立的 Sheet 分頁）。
// purposeTags 這裡實際存放的是「我要找活動靈感」頁面的目標選項（見 Shared.html 的 GOAL_TAGS），
// 不是過往活動用的 PURPOSE_TAGS（拉新/回流…），沿用 root 前端 js/mock-data.js 的既有欄位設計。
const IDEAS_HEADERS = [
  'id', 'title', 'description', 'submittedBy', 'images', 'demoUrl', 'attachments',
  'purposeTags', 'inspirationRef', 'createdAt',
];
const HOT_IDEAS_HEADERS = IDEAS_HEADERS;

// 頁面名稱 → HTML 樣板檔案名稱（樣板檔案放在 apps-script/webapp/ 底下，需另外貼進 Apps Script 編輯器）
const PAGE_TEMPLATES = {
  index: 'Index',
  generate: 'Generate',
  activities: 'Activities',
  ideas: 'Ideas',
  hotideas: 'HotIdeas',
};

function doGet(e) {
  const type = e.parameter.type;
  if (type === 'activities') return respond(getRows(SHEET_ACTIVITIES, ACTIVITIES_HEADERS));
  if (type === 'ideas') return respond(getRows(SHEET_IDEAS, IDEAS_HEADERS));
  if (type === 'hotIdeas') return respond(getRows(SHEET_HOT_IDEAS, HOT_IDEAS_HEADERS));
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
  return getRows(SHEET_IDEAS, IDEAS_HEADERS);
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

function getHotIdeasForClient() {
  return getRows(SHEET_HOT_IDEAS, HOT_IDEAS_HEADERS);
}

function addHotIdeaForClient(data) {
  return addHotIdea(data);
}

function updateHotIdeaForClient(payload) {
  const data = Object.assign({}, payload);
  const id = data.id;
  delete data.id;
  return updateHotIdea(id, data);
}

function deleteHotIdeaForClient(id) {
  return deleteHotIdea(id);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const data = body.data || {};
  if (body.action === 'addIdea') return respond(addIdea(data));
  if (body.action === 'updateIdea') return respond(updateIdea(data.id, data));
  if (body.action === 'deleteIdea') return respond(deleteIdea(data.id));
  if (body.action === 'addHotIdea') return respond(addHotIdea(data));
  if (body.action === 'updateHotIdea') return respond(updateHotIdea(data.id, data));
  if (body.action === 'deleteHotIdea') return respond(deleteHotIdea(data.id));
  if (body.action === 'addActivity') return respond(addActivity(data));
  return respond({ error: 'unknown action: ' + body.action });
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
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

// 陣列類欄位在 Sheet 裡以逗號分隔字串儲存，讀取時還原成陣列
const ARRAY_FIELDS = ['mechanismTags', 'purposeTags', 'specialTags'];
// 照片／附件連結陣列改用換行分隔（URL 本身可能含逗號），讀取時還原成陣列
const NEWLINE_ARRAY_FIELDS = ['images', 'attachments'];

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
  return value;
}

// 寫入 Sheet 前，把陣列/物件欄位序列化回純文字（parseCell 的反向操作）
function serializeField(header, value) {
  if (ARRAY_FIELDS.indexOf(header) !== -1) return (value || []).join(',');
  if (NEWLINE_ARRAY_FIELDS.indexOf(header) !== -1) return (value || []).join('\n');
  if (header === 'metrics') return value ? JSON.stringify(value) : '';
  return value || '';
}

function findRowIndexById(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) return i + 1; // 1-indexed sheet row number
  }
  return -1;
}

// ---------- 我有 H5 活動靈感 / 我有熱點活動靈感 共用的新增／編輯／刪除 ----------

function addIdeaRecord(sheetName, headers, idPrefix, data) {
  const sheet = getOrCreateSheet(sheetName, headers);
  const id = idPrefix + '_' + new Date().getTime();
  const row = headers.map((h) => {
    if (h === 'id') return id;
    if (h === 'createdAt') return new Date().toISOString();
    return serializeField(h, data[h]);
  });
  sheet.appendRow(row);
  return { success: true, id };
}

function updateRecord(sheetName, headers, id, data) {
  const sheet = getOrCreateSheet(sheetName, headers);
  const rowIndex = findRowIndexById(sheet, id);
  if (rowIndex === -1) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  const existing = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const newRow = headers.map((h, i) => (Object.prototype.hasOwnProperty.call(data, h) ? serializeField(h, data[h]) : existing[i]));
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([newRow]);
  return { success: true };
}

function deleteRecord(sheetName, headers, id) {
  const sheet = getOrCreateSheet(sheetName, headers);
  const rowIndex = findRowIndexById(sheet, id);
  if (rowIndex === -1) return { success: false, error: '找不到這筆資料（可能已被刪除）' };
  sheet.deleteRow(rowIndex);
  return { success: true };
}

function addIdea(data) {
  return addIdeaRecord(SHEET_IDEAS, IDEAS_HEADERS, 'idea', data);
}
function updateIdea(id, data) {
  return updateRecord(SHEET_IDEAS, IDEAS_HEADERS, id, data);
}
function deleteIdea(id) {
  return deleteRecord(SHEET_IDEAS, IDEAS_HEADERS, id);
}

function addHotIdea(data) {
  return addIdeaRecord(SHEET_HOT_IDEAS, HOT_IDEAS_HEADERS, 'hotidea', data);
}
function updateHotIdea(id, data) {
  return updateRecord(SHEET_HOT_IDEAS, HOT_IDEAS_HEADERS, id, data);
}
function deleteHotIdea(id) {
  return deleteRecord(SHEET_HOT_IDEAS, HOT_IDEAS_HEADERS, id);
}

function addActivity(data) {
  const sheet = getOrCreateSheet(SHEET_ACTIVITIES, ACTIVITIES_HEADERS);
  const id = 'activity_' + new Date().getTime();
  sheet.appendRow([
    id,
    data.name || '',
    data.dateText || '',
    data.dateStart || '',
    data.dateEnd || '',
    data.description || '',
    data.mechanism || '',
    (data.mechanismTags || []).join(','),
    (data.purposeTags || []).join(','),
    (data.specialTags || []).join(','),
    data.metrics ? JSON.stringify(data.metrics) : '',
    data.referenceLink || '',
    (data.images || []).join('\n'),
    data.createdBy || '匿名',
    new Date().toISOString(),
    'draft',
  ]);
  return { success: true, id };
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
