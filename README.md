# 傳說對決 H5 活動中心

給傳說對決營運團隊使用的內部工具，主打「急需活動點子時」快速使用，三大功能：

1. **我要找活動**（AI 發想，對應檔案 `generate.html`）：選好設計目的、特殊需求，補上想切中的時事或客製化條件，AI 會依團隊過去的活動風格生成新的主題建議，順手就能存成活動靈感。（首頁主打功能）
2. **過往歷史活動**（對應檔案 `activities.html`）：彙整過往刺激活躍的 H5 小遊戲活動——機制、設計目的、特殊需求、成效數據，可依目的／特殊需求／遊戲類型篩選。設計新活動前，先看看過去做過什麼、效果如何。
3. **我有活動靈感**（對應檔案 `ideas.html`）：同事自由上傳的 H5 小遊戲點子，每則點子都標註提供者，供大家瀏覽、互相激發靈感。

## 兩個版本：示範版 vs 正式共用版

這個專案其實有**兩份前端**，服務不同目的：

| | 示範／預覽版 | 正式共用版 |
|---|---|---|
| 網址 | `changti-dotcom.github.io/h5-activity-hub/`（GitHub Pages） | `script.google.com/.../exec`（部署後才有，見下方） |
| 檔案 | 根目錄的 `index.html` / `activities.html` / `ideas.html` / `generate.html` / `js/*.js` | `apps-script/webapp/` 底下的樣板，執行在 Google Apps Script 上 |
| 資料 | 種子範例資料，存在瀏覽器本機 localStorage，別人看不到你新增的內容 | 真的讀寫團隊共用的 Google Sheet |
| 存取限制 | 任何人都能開（公開網頁） | 僅限已登入 Garena Google 帳號的同事（公司資安政策要求） |
| 用途 | 快速看介面長怎樣、示範用 | 團隊實際使用 |

會有兩份的原因：公司政策不允許 Apps Script 部署開放「所有人」存取，只能「僅限公司網域」，而網域限定的部署沒辦法被外部網站（GitHub Pages）用背景 `fetch()` 呼叫（會被導向 Google 登入頁），所以正式版乾脆整個網站都跑在 Apps Script 上，同源讀寫沒有這個問題。詳見 [`apps-script/SETUP.md`](apps-script/SETUP.md)。

## 目前狀態

- 架構與介面已完成。
- **成效數據尚未整理**：過往歷史活動裡的「成效數據」欄位目前多數是空的（會顯示「待補充」），待營運數據整理好後再補上即可，不影響現在使用其他功能。
- **設計目的**多數活動也還沒分類（少數機制本身已明確指出目的的，如「回歸之路」「建造大作戰」已先標註），需要團隊之後陸續補齊。
- 正式共用版尚未部署完成——需要照 [`apps-script/SETUP.md`](apps-script/SETUP.md) 的步驟建立 Google Sheet、貼上 Apps Script 程式碼與樣板、部署，才會有同事能用的正式網址。

## 怎麼預覽示範版

示範版是純靜態網頁，不需要安裝任何東西：

- 直接用瀏覽器打開 `index.html` 即可（雙擊檔案，或右鍵→開啟檔案）。
- 或直接看已經上線的 GitHub Pages 版本：`changti-dotcom.github.io/h5-activity-hub/`。

## 部署正式共用版

詳細步驟（含建立 Google Sheet、貼上 Apps Script 程式碼與網頁樣板、部署）都在 [`apps-script/SETUP.md`](apps-script/SETUP.md)，10-15 分鐘可以做完，不需要工程師、不需要架伺服器。

## 檔案結構

```
index.html          首頁：總覽 + 三大功能入口
generate.html          我要找活動（AI 發想）頁面
js/generate.js         我要找活動頁面邏輯
activities.html      過往歷史活動頁面（篩選 / 列表 / 詳情 / 新增活動表單）
js/activities.js       過往歷史活動頁面邏輯
ideas.html            我有活動靈感頁面（篩選 / 列表 / 詳情 / 新增點子表單）
js/ideas.js            我有活動靈感頁面邏輯
css/style.css         全站樣式
js/config.js          共用資料庫網址設定（正式部署後填入）
js/api.js             資料讀寫邏輯（示範模式 / 正式模式自動切換）
js/common.js          共用標籤定義（設計目的／特殊需求／遊戲類型）與 UI 輔助函式
js/mock-data.js        種子資料：28 筆過往 H5 小遊戲活動（整理自內部試算表）+ 3 則範例點子
apps-script/Code.gs     正式共用版後端：共用資料庫 + AI 發想 API + 網頁樣板路由（部署到 Google Apps Script）
apps-script/SETUP.md    正式共用版部署步驟教學（含 AI 功能設定）
apps-script/webapp/       正式共用版的網頁樣板（Shared/Index/Activities/Ideas/Generate），需複製貼上到 Apps Script 編輯器
```

## 「我要找活動」（AI 發想）怎麼運作

這個功能會透過 [`apps-script/Code.gs`](apps-script/Code.gs) 呼叫 Anthropic 的 Claude API，依你選的設計目的、特殊需求、客製化說明，加上過往歷史活動裡近期的活動當參考風格，生成 3 個新的活動主題建議。除了「啟用共用資料庫」之外，這個功能還需要額外申請一組 Anthropic API 金鑰並設定到 Apps Script 裡，步驟見 [`apps-script/SETUP.md`](apps-script/SETUP.md) 的「啟用「我要找活動」（AI 發想功能）」章節（會產生少量 API 使用費用，說明裡有費用估算與如何換成更便宜的模型）。

AI 的知識有訓練截止日期，「切中時事」的建議只是方向性發想，實際時事細節與正確性仍需要團隊自行核實再使用。

## 標籤分類（可在 `js/common.js` 調整）

- **設計目的**：拉新 / 回流 / 留存 / 付費 / 版本導流 / 品牌口碑
- **特殊需求**：時事熱點 / 節慶檔期 / IP聯動 / 週年慶 / 新版本上市 / 電競賽事聯動 / 老玩家回歸 / 低開發成本 / 需搭配抽卡機制（此外，「我有活動靈感」的新增表單也支援自訂輸入額外標籤）
- **遊戲類型**：益智消除 / 反應操作 / 心理測驗 / 經營模擬 / 任務養成 / 抽獎機率 / 社交邀請 / 陣營競賽 / 劇情回顧 / 音樂節奏 / 其他

想調整或新增分類，直接編輯 `js/common.js` 裡對應的常數陣列即可，兩個頁面的篩選器與表單都會自動套用新的分類。

## 之後可以考慮擴充的方向（目前尚未實作）

- 編輯 / 刪除既有活動紀錄的介面（目前只有新增，修正錯誤資料需直接到 Google Sheet 改）。
- 「我有活動靈感」的「+1 共鳴」或留言功能，幫助團隊看出哪些點子最多人有共鳴。
- 記錄「是哪個 Garena 帳號」新增的資料（目前部署雖然限制僅 Garena 帳號能存取網站，但送出表單時的姓名/暱稱仍是手動輸入，沒有跟登入帳號綁定）。
