// 這份 config.js 只給「示範／預覽版」（GitHub Pages 版本）用，資料一律是種子範例。
// 因為公司 Apps Script 部署只能設「僅限網域內」，網域限定的部署沒辦法被這個示範版
// 用背景 fetch() 呼叫（會被導向 Google 登入頁），所以這裡的 API_URL 留空即可，不要填。
// 真正共用資料的「正式版」改成整個網站直接跑在 Apps Script 上，
// 部署步驟見 apps-script/SETUP.md，網址會是 script.google.com/.../exec。
const CONFIG = {
  API_URL: '', // 示範版請保持空字串
};

Object.defineProperty(CONFIG, 'USE_MOCK', {
  get() { return !this.API_URL; },
});
