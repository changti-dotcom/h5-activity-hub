# H5 活躍活動知識庫

這個資料夾是「傳說對決 H5 活動規劃工具」的第二層核心——AI 從歷史工單與成效數據萃取出來的 Memory + Context，會隨著同事持續提供新工單而滾動累積，不是一次性產物。

## 資料夾結構（也是檢索邏輯本身）

- `index.md`：**所有案例的索引表**，欄位是活動名稱、案例卡檔案、機制類型、原始目的、關鍵字標籤。這是唯一預設每次都完整讀的檔案（本身很小），其餘檔案一律先用關鍵字/標籤篩過、Grep 命中後才 Read，不要每次把整個資料夾讀進對話。
- `cases/*.md`：依「機制引擎」分組的案例卡（同一套引擎的多次活動放在同一個檔案，因為未來查詢通常是「這種機制該怎麼做」而不是「某一次特定活動」）。每張案例卡固定欄位：活動名稱／上線時間／原始目的／機制設計重點（一句話）／阻礙與解法（教訓）／參與率／完成率／備註。
- `mechanism-insights.md`：跨案例的機制歸納——依機制類型統計參與率/完成率量級、可複用的設計技巧庫（例如保證可解演算法、連勝挑戰、里程碑四態視覺）。
- `kpi-and-qa-reference.md`：KPI 完整選單、公司標準 Data Request 模板、跨地區/合規/QA 檢查清單、通用 UI 細節提醒。

## 這份知識庫怎麼被使用

- **寫入**：由 `learn-insights` skill 負責（模式A）。同事丟一份新工單連結給它，它會讀完整份工單，萃取成案例卡，決定加進 `cases/` 裡的哪個引擎檔案（或新開一個），並更新 `index.md`；如果這份工單揭露了新的跨案例模式，也會更新 `mechanism-insights.md`。
- **讀取（RAG 檢索）**：由 `learn-insights` skill 負責（模式B），被 `plan-h5-activity` skill 呼叫。規劃新活動時，先讀 `index.md` 抓出目的/機制關鍵字，再篩出命中的 `cases/` 檔案與 `mechanism-insights.md` 段落，只 Read 真正相關的部分，不要整包塞進對話——這是避免 token 消耗爆炸的關鍵設計。
- 不要手動把案例卡改寫成長篇散文，這會破壞篩選效率；有新資料一律透過 `learn-insights` skill 處理，維持案例卡格式一致。

## 目前收錄的機制引擎

sport-fest／food-stand-engine／skin-review-engine／territory-war／clash-battle／candle-donation／find-your-soul-engine／travel-diary／shower-puzzle／summer-fest-streak／carnival-engine（完整清單與關鍵字見 `index.md`）。

## 重要提醒

**這整個資料夾（連同 `.claude/skills/`）務必要 git commit，不要只留在工作目錄裡。** 這套工具曾經因為改動沒有進 commit，在環境重置後整個消失過一次，靠對話記錄重建回來。之後每次更新這裡的內容，做完就順手 commit，避免重蹈覆轍。
