if (CONFIG.USE_MOCK) {
  const notice = document.getElementById('modeNotice');
  notice.style.display = 'block';
  notice.textContent = '目前處於示範模式，尚未連接 AI 服務。請先依 apps-script/SETUP.md 設定共用資料庫與 Anthropic API 金鑰後再使用本頁。';
}

renderChipSelect(document.getElementById('purposeSelect'), PURPOSE_TAGS, []);
renderChipSelect(document.getElementById('specialSelect'), SPECIAL_TAG_SUGGESTIONS, []);

let lastSuggestions = [];
let lastPurposeTags = [];
let lastSpecialTags = [];

function suggestionCardHtml(s, index) {
  return `
    <div class="item-card" style="cursor:default;" data-index="${index}">
      <div class="title">💡 ${escapeHtml(s.title || '未命名主題')}</div>
      <div class="detail-section" style="margin-bottom:8px;">
        <div class="label">活動概念</div>
        <div class="value">${escapeHtml(s.concept || '')}</div>
      </div>
      <div class="detail-section" style="margin-bottom:8px;">
        <div class="label">玩法機制</div>
        <div class="value">${escapeHtml(s.mechanism || '')}</div>
      </div>
      <div class="detail-section" style="margin-bottom:8px;">
        <div class="label">時事／梗的連結</div>
        <div class="value">${escapeHtml(s.currentEventAngle || '（無）')}</div>
      </div>
      <div class="detail-section" style="margin-bottom:0;">
        <div class="label">呼應設計目的</div>
        <div class="value">${escapeHtml(s.purposeFit || '')}</div>
      </div>
      <div class="form-actions" style="margin-top:14px;">
        <button class="btn btn-outline btn-sm add-to-idea-btn" data-index="${index}">＋ 加入活動靈感</button>
      </div>
    </div>
  `;
}

function renderResults(suggestions) {
  const area = document.getElementById('resultArea');
  if (!suggestions.length) {
    area.innerHTML = `<div class="empty-state"><div class="big">🤔</div>AI 沒有生成任何建議，換個描述再試一次看看。</div>`;
    return;
  }
  area.innerHTML = `<div class="card-grid">${suggestions.map(suggestionCardHtml).join('')}</div>`;
  area.querySelectorAll('.add-to-idea-btn').forEach((btn) => {
    btn.addEventListener('click', () => addSuggestionToIdeaLibrary(Number(btn.dataset.index)));
  });
}

async function addSuggestionToIdeaLibrary(index) {
  const s = lastSuggestions[index];
  const submittedBy = document.getElementById('yourName').value.trim();
  if (!submittedBy) {
    toast('請先在上方填寫「你的名字」，才能加入活動靈感');
    document.getElementById('yourName').focus();
    return;
  }
  const description = [
    s.concept,
    s.mechanism ? '玩法機制：' + s.mechanism : '',
    s.currentEventAngle ? '時事／梗的連結：' + s.currentEventAngle : '',
  ].filter(Boolean).join('\n');

  const result = await submitIdea({
    title: s.title,
    description,
    submittedBy,
    purposeTags: lastPurposeTags,
    specialTags: lastSpecialTags,
    inspirationRef: '我要找活動（AI 發想）',
  });
  if (result && result.success) {
    toast('已加入活動靈感！' + (result.local ? '（示範模式，僅存在此瀏覽器）' : ''));
  } else {
    toast('加入失敗，請稍後再試');
  }
}

document.getElementById('generateBtn').addEventListener('click', async () => {
  const purposeTags = getSelectedChips(document.getElementById('purposeSelect'));
  const specialTags = getSelectedChips(document.getElementById('specialSelect'));
  const customRequirement = document.getElementById('customRequirement').value.trim();

  const area = document.getElementById('resultArea');
  area.innerHTML = `<div class="empty-state"><div class="big">✨</div>AI 生成中，請稍候……</div>`;

  const result = await generateSuggestions({ purposeTags, specialTags, customRequirement });

  if (result && result.error) {
    area.innerHTML = `<div class="metrics-box">⚠️ ${escapeHtml(result.error)}</div>`;
    return;
  }
  if (!result || !result.success) {
    area.innerHTML = `<div class="metrics-box">⚠️ 產生失敗，請稍後再試一次。</div>`;
    return;
  }

  lastSuggestions = result.suggestions || [];
  lastPurposeTags = purposeTags;
  lastSpecialTags = specialTags;
  renderResults(lastSuggestions);
});
