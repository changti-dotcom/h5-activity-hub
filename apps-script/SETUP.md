# 部署正式共用版本（Google Sheets + Apps Script）

因為公司資安政策不開放 Apps Script 部署「所有人」都能存取，只能設「僅限公司網域內的人」。
這代表網站沒辦法像原本規劃的那樣「GitHub Pages 網站 + 背景呼叫 Apps Script API」——瀏覽器背景呼叫（`fetch()`）不會帶著你的 Google 登入狀態，網域限定的部署會把這種呼叫導向登入頁，抓不到資料。

**所以改成整個網站直接由 Apps Script 提供**：同事要先登入 Garena 的 Google 帳號才能打開網站，網站再透過 Google 官方的 `google.script.run` 機制讀寫資料（不是 `fetch()`，不會有登入導向的問題）。GitHub Pages 那組網址之後只當作示範／預覽版（資料是假的種子資料），正式共用版本的網址會是 `script.google.com/.../exec` 那組。

## 步驟

1. 開一個新的 Google Sheet（或用你已經建立的那份）。
2. 上方選單點 **擴充功能 → Apps Script**，會打開一個新分頁的程式碼編輯器。
3. 把編輯器裡預設的 `myFunction` 內容整個刪掉，貼上本目錄下 [`Code.gs`](./Code.gs) 的全部內容，存檔（Ctrl+S）。
4. 在左側「檔案」旁邊點 **＋ → HTML**，依序建立以下 5 個 HTML 檔案，檔名務必完全一致（不用加 `.html`，Apps Script 會自動加）：
   - `Shared`
   - `Index`
   - `Activities`
   - `Ideas`
   - `Generate`

   每個檔案的內容分別貼自本目錄下 [`webapp/Shared.html`](./webapp/Shared.html)、[`webapp/Index.html`](./webapp/Index.html)、[`webapp/Activities.html`](./webapp/Activities.html)、[`webapp/Ideas.html`](./webapp/Ideas.html)、[`webapp/Generate.html`](./webapp/Generate.html)（複製全部內容貼上，不用另外調整），每貼完一個記得存檔。

   完成後左側檔案列表應該有：`Code.gs`、`Shared`、`Index`、`Activities`、`Ideas`、`Generate`，共 6 個檔案。
5. 點右上角藍色的 **部署 → 新增部署作業**。
   - 類型選擇「網頁應用程式」（Web app）。
   - 「執行身分」選 **我**。
   - 「誰可以存取」選 **公司網域內的任何人**（Anyone within Garena，依貴公司網域顯示的名稱為準）。
   - 點「部署」，第一次會要求你**授權**，照畫面指示允許即可（會跳出「未驗證應用程式」的警告，這是正常的，因為是你自己寫的程式，點選「進階」→「前往（專案名稱）」繼續即可）。
6. 部署完成後會給你一組網址，格式類似：
   `https://script.google.com/a/macros/garena.com/s/xxxxx/exec`
   **這組網址就是正式版網站，之後同事都用這組網址打開**（需要先登入 Garena 的 Google 帳號）。
7. 之後同事新增的活動 / 點子都會直接寫進第 1 步那個 Google Sheet 裡的 `Activities` / `Ideas` 分頁（第一次有人新增資料時會自動建立分頁與欄位標題）。

## 之後修改網站內容怎麼更新到 Apps Script

`Code.gs` 跟 `webapp/` 裡的檔案之後如果又改版，需要手動把新內容複製貼上覆蓋到 Apps Script 編輯器對應的檔案裡再存檔，**不會自動同步**。網址不會變，同事不用重新打開新連結。

## 之後怎麼補真實成效數據

打開 Google Sheet 的 `Activities` 分頁，找到對應的列，把 `metrics` 欄位填上內容（建議填 JSON 格式的字串，例如 `{"summary":"參與人數 12.4 萬，付費轉換率 3.2%"}`，網站會自動解析並顯示成效摘要；如果只是先貼一段文字也可以，網站會直接顯示這段文字）。

## 之後怎麼補過往活動照片

過往歷史活動已經預留了照片欄位（卡片與詳情頁都會顯示，沒照片時會顯示「尚無照片／照片待補充」的預留位置），但目前沒有真正的檔案上傳功能，補照片的方式是**貼圖片連結**：

1. 把照片上傳到公司內部看得到的地方（例如 Google Drive，記得把分享權限改成「知道連結的人可查看」；或內部圖床、wiki 附件也可以），複製圖片的直接連結。
2. 新增活動時，在「新增活動紀錄」表單的「活動照片」欄位貼上連結，一行一張。
3. 要幫**既有**活動補照片的話，直接打開 Google Sheet 的 `Activities` 分頁，找到對應的列，在 `images` 欄位貼上連結（同樣一行一張，用 Alt+Enter / Option+Enter 換行），存檔後網站會自動顯示。

之後如果想做成真正的「上傳圖片」按鈕，需要額外串接 Google Drive API，屬於未來可以擴充的方向。

## 誰能新增/瀏覽資料？

只有登入 Garena Google 帳號的人才能打開網站、讀寫資料——這是部署時「誰可以存取」設定的效果，不需要額外開發登入機制。目前沒有記錄「是哪個帳號」新增資料，只會記錄使用者在表單裡自己填的姓名/暱稱。

## 啟用「我要找活動」（AI 發想功能）

網站的「我要找活動」頁面（選目的/需求 → AI 生成活動主題建議）需要額外設定一組 Anthropic API 金鑰，跟上面的共用資料庫是分開的步驟。

1. 到 [console.anthropic.com](https://console.anthropic.com) 申請一組 API 金鑰（需要公司內部負責窗口的 Anthropic 帳號，如果沒有請洽 IT 或找已有帳號的同事協助）。
2. 回到 Apps Script 編輯器，點左側齒輪圖示「**專案設定**」。
3. 往下捲到「**指令碼屬性**」，點「新增指令碼屬性」：
   - 屬性：`ANTHROPIC_API_KEY`
   - 值：貼上你申請到的金鑰（`sk-ant-...` 開頭）
   - 儲存
4. 不需要重新部署，設定完立刻生效——回到網站的「我要找活動」頁面測試看看。

**費用說明**：每次產生建議大約消耗 1,000～2,000 tokens，用預設模型（Opus）大約是幾分錢台幣等級的費用，會計入你申請金鑰所屬的 Anthropic 帳單。如果用量大、想降低成本，可以打開 [`Code.gs`](./Code.gs) 把 `CLAUDE_MODEL` 常數從 `'claude-opus-4-8'` 改成 `'claude-sonnet-5'`（品質接近、成本較低）或 `'claude-haiku-4-5'`（最便宜，發想品質會較陽春），改完存檔即生效。

**注意事項**：
- AI 的知識有訓練截止日期，「切中時事」的建議只能提供方向性發想，實際的時事細節、梗的正確性仍需要團隊自行核實與補充，不要照單全收直接發布。
- 如果 API 金鑰沒設定，網站會顯示提示訊息，不會出現不明錯誤。
- 金鑰只存在 Google 的「指令碼屬性」裡，不會出現在前端程式碼或網頁原始碼中，同事看不到你的金鑰。

## GitHub Pages 那組網址還有用嗎？

`changti-dotcom.github.io/h5-activity-hub/` 那組網址之後定位是**示範／預覽版**：資料是假的種子範例，不會跟 Apps Script 共用。適合用來單純展示介面長相，或給還沒被加進 Garena Google 網域權限的人先看看樣子。正式使用請一律走 Apps Script 那組網址。
