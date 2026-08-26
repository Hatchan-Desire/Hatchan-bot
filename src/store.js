const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

// デフォルトの返信内容
const DEFAULT_REPLY = [
  '🚨冷笑を検知しました🚨',
  '👮冷笑警察👮です。',
  '時代は__**～熱笑～**__。',
  '笑いに温度を。笑いに魂を。',
  'もっと熱く笑いましょう。',
  'ガハハwWwwWwwww',
  'ガハハハハハハハハwwwwww',
].join('\n');

// デフォルトの反応文字列（すべて同じ返信文を割り当てる）
const DEFAULT_TRIGGERS = {
  うお: DEFAULT_REPLY,
  おお: DEFAULT_REPLY,
  どわ: DEFAULT_REPLY,
};

function defaultStore() {
  return {
    // 監視を有効化しているチャンネルID一覧
    activeChannels: [],
    // 反応する文字列 -> 返信内容 のマッピング
    triggers: { ...DEFAULT_TRIGGERS },
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    const initial = defaultStore();
    save(initial);
    return initial;
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      activeChannels: Array.isArray(parsed.activeChannels) ? parsed.activeChannels : [],
      triggers:
        parsed.triggers && typeof parsed.triggers === 'object' && !Array.isArray(parsed.triggers)
          ? parsed.triggers
          : {},
    };
  } catch (err) {
    console.error('[store] store.json の読み込みに失敗したためデフォルト値を使用します:', err);
    return defaultStore();
  }
}

function save(store) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

module.exports = {
  load,
  save,
  DEFAULT_REPLY,
};
