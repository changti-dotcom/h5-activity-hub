// 部署好 Google Apps Script 網頁應用程式後，把網址貼在這裡，
// 網站就會自動從「示範模式」切換為「正式共用資料庫」模式。
// 部署步驟請見 apps-script/SETUP.md
const CONFIG = {
  API_URL: '', // 例：https://script.google.com/macros/s/xxxxx/exec
};

Object.defineProperty(CONFIG, 'USE_MOCK', {
  get() { return !this.API_URL; },
});
