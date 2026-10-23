// 運行情報ページを取得してステータスを抜き出すモジュール。
//
// 注意: このスクレイピング対象（Yahoo!路線情報）のページ構造は、Web検索で得られた
// スニペット（「路線名 | 平常運転 | 事故・遅延情報はありません」形式）から推測して実装している。
// 実際のHTML構造をこの環境から直接確認できなかったため、運用前に `npm run check-delay`
// を実行し、出力されたJSON（特に raw / source フィールド）で正しく解析できているか必ず確認すること。

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

// メタタグから取得できなかった場合のフォールバック。本文テキストからキーワードで推測するため信頼度は低い。
function extractFromBodyText(html) {
  const text = htmlToText(html);

  const ABNORMAL_PATTERNS = [
    { statusLabel: '運転見合わせ', re: /運転見合わせ/ },
    { statusLabel: '運休', re: /(?<!情報なし)運休(?!情報)/ },
    { statusLabel: '遅延', re: /(?<!証明)遅延(?!証明)|列車に?\d+分(?:以上)?の?遅れ/ },
    { statusLabel: 'ダイヤ乱れ', re: /ダイヤが?乱れ/ },
    { statusLabel: '直通運転中止', re: /直通運転中止/ },
  ];

  for (const p of ABNORMAL_PATTERNS) {
    const m = text.match(p.re);
    if (m) {
      const idx = m.index ?? 0;
      return {
        statusLabel: p.statusLabel,
        detail: text.slice(Math.max(0, idx - 10), idx + 100).trim(),
        isNormal: false,
        raw: text.slice(Math.max(0, idx - 30), idx + 150).trim(),
        source: 'body-fallback',
      };
    }
  }

  if (/平常運転/.test(text)) {
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
  const result = extractFromMeta(html) || extractFromBodyText(html);

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
  extractFromBodyText,
};
