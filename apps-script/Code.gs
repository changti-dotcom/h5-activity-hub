// H5 活動資料庫 / 靈感庫 — 共用資料庫後端
// 部署方式請見同目錄下的 SETUP.md

const SHEET_ACTIVITIES = 'Activities';
const SHEET_IDEAS = 'Ideas';

const ACTIVITIES_HEADERS = [
  'id', 'name', 'dateText', 'dateStart', 'dateEnd', 'description', 'mechanism',
  'mechanismTags', 'purposeTags', 'specialTags', 'metrics', 'referenceLink', 'images',
  'createdBy', 'createdAt', 'status',
];

const IDEAS_HEADERS = [
  'id', 'title', 'description', 'submittedBy', 'purposeTags', 'specialTags',
  'inspirationRef', 'createdAt',
];

function doGet(e) {
  const type = e.parameter.type;
  if (type === 'activities') return respond(getRows(SHEET_ACTIVITIES, ACTIVITIES_HEADERS));
  if (type === 'ideas') return respond(getRows(SHEET_IDEAS, IDEAS_HEADERS));
  return respond({ error: 'unknown type: ' + type });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.action === 'addIdea') return respond(addIdea(body.data));
  if (body.action === 'addActivity') return respond(addActivity(body.data));
  if (body.action === 'generateSuggestion') return respond(generateSuggestion(body.data));
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
// 照片連結陣列改用換行分隔（URL 本身可能含逗號），讀取時還原成陣列
const NEWLINE_ARRAY_FIELDS = ['images'];

function parseCell(header, value) {
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

function addIdea(data) {
  const sheet = getOrCreateSheet(SHEET_IDEAS, IDEAS_HEADERS);
  const id = 'idea_' + new Date().getTime();
  sheet.appendRow([
    id,
    data.title || '',
    data.description || '',
    data.submittedBy || '匿名',
    (data.purposeTags || []).join(','),
    (data.specialTags || []).join(','),
    data.inspirationRef || '',
    new Date().toISOString(),
  ]);
  return { success: true, id };
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

// ---------- AI 活動發想產生器 ----------
// 呼叫 Anthropic Claude API，依使用者選的目的/需求生成活動主題建議。
// API 金鑰請透過「指令碼屬性」設定，不要寫死在程式碼裡（設定步驟見 SETUP.md）。

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
// 預設用 Opus 4.8（最強但較貴）。若想降低成本，可改成 'claude-sonnet-5' 或 'claude-haiku-4-5'。
const CLAUDE_MODEL = 'claude-opus-4-8';

const SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          concept: { type: 'string' },
          mechanism: { type: 'string' },
          currentEventAngle: { type: 'string' },
          purposeFit: { type: 'string' },
        },
        required: ['title', 'concept', 'mechanism', 'currentEventAngle', 'purposeFit'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
};

function generateSuggestion(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return { error: '尚未設定 ANTHROPIC_API_KEY，請見 SETUP.md「啟用 AI 活動發想」章節設定指令碼屬性。' };
  }

  const activities = getRows(SHEET_ACTIVITIES, ACTIVITIES_HEADERS);
  const referenceContext = activities
    .slice(-20)
    .map((a) => `《${a.name}》：${a.mechanism || a.description || '（無說明）'}`)
    .join('\n') || '（目前資料庫尚無活動紀錄）';

  const purposeText = (data.purposeTags || []).join('、') || '未指定，請自行發想合適的目的';
  const specialText = (data.specialTags || []).join('、') || '無特別要求';
  const customText = data.customRequirement || '（無額外說明）';

  const systemPrompt = [
    '你是「傳說對決」營運團隊的 H5 小遊戲活動企劃顧問，任務是幫團隊發想全新的 H5 小遊戲活動主題。',
    '以下是團隊過去做過的部分 H5 活動，作為機制與風格參考，你可以延伸變化，但不要直接重複：',
    referenceContext,
    '',
    '請根據使用者提供的設計目的、特殊需求與客製化說明，發想 3 個風格互不相同的全新活動主題建議。',
    '每個建議都要包含具體的玩法機制、如何呼應指定的設計目的，以及（若使用者要求切中時事/梗）可以怎麼結合。',
    '注意：你的知識有訓練截止日期，對「最新時事」的建議只能提供方向性發想，實際內容需要團隊自行核實與補上最新細節。',
  ].join('\n');

  const userPrompt = [
    '設計目的：' + purposeText,
    '特殊需求：' + specialText,
    '客製化需求說明：' + customText,
    '請發想 3 個活動主題建議。',
  ].join('\n');

  const requestBody = {
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    output_config: { format: { type: 'json_schema', schema: SUGGESTION_SCHEMA } },
  };

  const response = UrlFetchApp.fetch(CLAUDE_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const bodyText = response.getContentText();
  if (status !== 200) {
    return { error: 'AI 服務呼叫失敗（狀態碼 ' + status + '）：' + bodyText };
  }

  const parsed = JSON.parse(bodyText);
  if (parsed.stop_reason === 'refusal') {
    return { error: 'AI 婉拒了這次請求（可能觸及安全政策），請調整需求描述後再試一次。' };
  }
  const textBlock = (parsed.content || []).filter((b) => b.type === 'text')[0];
  if (!textBlock) {
    return { error: 'AI 回應中找不到內容，請稍後再試一次。' };
  }
  const result = JSON.parse(textBlock.text);
  return { success: true, suggestions: result.suggestions || [] };
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
