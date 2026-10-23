// 遅延情報スクレイピングの動作確認用スクリプト。
// 実際にデプロイする前に `npm run check-delay` を実行し、
// 取得・解析結果（特に raw / source フィールド）が正しいかを必ず確認すること。
require('dotenv').config();
const { LINE_SOURCES } = require('./delaySources');
const { fetchLineStatus } = require('./delayScraper');

(async () => {
  for (const source of LINE_SOURCES) {
    console.log(`\n=== ${source.label} (${source.url}) ===`);
    try {
      const status = await fetchLineStatus(source);
      console.log(JSON.stringify(status, null, 2));
    } catch (err) {
      console.error('取得エラー:', err);
    }
  }
})();
