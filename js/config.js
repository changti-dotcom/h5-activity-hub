// 這份 config.js 同時給兩種部署共用：
// - GitHub Pages 示範版（changti-dotcom.github.io）：沒有後端，API_URL 留空，資料存在瀏覽器 localStorage。
// - 公司 RUN 平台正式版（*.run.ingarena.net）：容器內跑了 server/server.js，
//   同源提供 /api，大家共用同一份伺服器端資料，不再各自存在瀏覽器裡。
// 用 hostname 自動判斷，不用手動維護兩份設定檔。
const CONFIG = {
  API_URL:
    typeof location !== 'undefined' && location.hostname.endsWith('run.ingarena.net') ? '/api' : '',
};

Object.defineProperty(CONFIG, 'USE_MOCK', {
  get() { return !this.API_URL; },
});
