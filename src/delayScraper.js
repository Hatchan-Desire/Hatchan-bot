// 運行情報ページを取得してステータスを抜き出すモジュール。
//
// 抽出方法は信頼度の高い順に3段階で試す:
//   1. extractFromMeta        : meta description の「路線名 | ステータス | 詳細」形式（未確認・現状マッチしていない）
//   2. extractFromStatusBlock : 本文中の「路線を登録 <ステータス> <詳細文> 迂回ルート検索」という定型ブロックのみを見る（主にこれで判定される）
//   3. extractFromBodyText    : 上記が使えない場合の最終フォールバック。ページ全文からキーワード検索するため、
//                               関連ツイート欄などの無関係な文言に誤反応しやすく信頼度は低い。
//
// `npm run check-delay` を実行した際、result.source が "status-block" になっていれば
// 期待どおりの解析ができている可能性が高い。"body-fallback" の場合は raw フィールドを見て要確認。

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'ja,en;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTPステータス ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

// meta description(og:description / description)から
// 「路線名 | ステータス | 詳細」形式の文字列を抽出する（最も信頼度が高い方法）
function extractFromMeta(html) {
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["'](?:og:description|description)["']/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const desc = decodeEntities(m[1]).trim();
      const parts = desc
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);

      if (parts.length >= 2) {
        const [lineName, statusLabel, ...rest] = parts;
        return {
          lineName,
          statusLabel,
          detail: rest.join(' / ') || statusLabel,
          isNormal: /平常/.test(statusLabel),
          raw: desc,
          source: 'meta',
        };
      }
    }
  }
  return null;
}

// ページ内の「路線を登録 ステータス 詳細文 迂回ルート検索」という定型ブロックからステータスを抜き出す。
// 本文全体をキーワード検索すると、関連ツイート欄に表示される他路線の遅延情報や、
// 「事故・遅延に関する情報はありません」のような否定文中の語に誤反応してしまうため、
// 「路線を登録」～「迂回ルート検索」の間だけに絞って判定する。
const STATUS_LABELS = [
  '平常運転',
  '運転見合わせ',
  '運休',
  'ダイヤが乱れ',
  'ダイヤ乱れ',
  '直通運転中止',
  '大幅な遅延',
  '遅延',
];

function extractFromStatusBlock(html) {
  const text = htmlToText(html);
  const anchor = '路線を登録';
  const anchorIdx = text.indexOf(anchor);
  if (anchorIdx === -1) return null;

  const start = anchorIdx + anchor.length;
  const endMarkerIdx = text.indexOf('迂回ルート検索', start);
  const block = text.slice(start, endMarkerIdx === -1 ? start + 200 : endMarkerIdx).trim();

  let bestLabel = null;
  let bestIdx = Infinity;
  for (const label of STATUS_LABELS) {
    const idx = block.indexOf(label);
    if (idx !== -1 && idx < bestIdx) {
      bestIdx = idx;
      bestLabel = label;
    }
  }
  if (!bestLabel) return null;

  return {
    statusLabel: bestLabel,
    detail: block,
    isNormal: bestLabel === '平常運転',
    raw: block,
    source: 'status-block',
  };
}

// 上記2つの方法でも取得できなかった場合の最終フォールバック。本文全体からのキーワード検索のため信頼度は低い。
function extractFromBodyText(html) {
  const text = htmlToText(html);

  for (const label of STATUS_LABELS) {
    if (label === '平常運転') continue;
    const idx = text.indexOf(label);
    if (idx !== -1) {
      return {
        statusLabel: label,
        detail: text.slice(Math.max(0, idx - 10), idx + 100).trim(),
        isNormal: false,
        raw: text.slice(Math.max(0, idx - 30), idx + 150).trim(),
        source: 'body-fallback',
      };
    }
  }

  if (text.includes('平常運転')) {
    return {
      statusLabel: '平常運転',
      detail: '平常運転',
      isNormal: true,
      raw: text.slice(0, 200),
      source: 'body-fallback',
    };
  }

  return null;
}

async function fetchLineStatus(source) {
  const html = await fetchHtml(source.url);
  const result = extractFromMeta(html) || extractFromStatusBlock(html) || extractFromBodyText(html);

  if (!result) {
    return {
      key: source.key,
      label: source.label,
      ok: false,
      isNormal: null,
      detail: '',
      raw: htmlToText(html).slice(0, 200),
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    key: source.key,
    label: source.label,
    ok: true,
    isNormal: result.isNormal,
    statusLabel: result.statusLabel,
    detail: result.detail,
    raw: result.raw,
    source: result.source,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  fetchLineStatus,
  fetchHtml,
  htmlToText,
  extractFromMeta,
  extractFromStatusBlock,
  extractFromBodyText,
};
