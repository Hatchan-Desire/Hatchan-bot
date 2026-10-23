const { LINE_SOURCES } = require('./delaySources');
const { fetchLineStatus } = require('./delayScraper');

const DEFAULT_INTERVAL_MS = 3 * 60 * 1000; // 3分

// 前回のステータスと比較し、通知すべきメッセージがあれば文字列を返す（なければnull）
function formatNotification(status, previous) {
  const becameAbnormal = status.isNormal === false && (!previous || previous.isNormal !== false);
  const recovered = status.isNormal === true && previous && previous.isNormal === false;

  if (becameAbnormal) {
    return `🚨 **${status.label}** に遅延・運転見合わせ等の情報があります\n> ${status.detail || status.statusLabel}`;
  }
  if (recovered) {
    return `✅ **${status.label}** は平常運転に戻りました`;
  }
  return null;
}

function createDelayWatcher({ client, state, persist, intervalMs = DEFAULT_INTERVAL_MS }) {
  let timer = null;

  async function checkOnce({ notify = true } = {}) {
    const results = [];

    for (const source of LINE_SOURCES) {
      try {
        const status = await fetchLineStatus(source);

        if (status.ok) {
          const previous = state.delayLastStatus[source.key];

          if (notify && state.delayNotifyChannels.length > 0) {
            const message = formatNotification(status, previous);
            if (message) {
              for (const channelId of state.delayNotifyChannels) {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                if (channel) {
                  await channel.send({ content: message }).catch((err) => {
                    console.error(`[delay] チャンネル(${channelId})への通知送信に失敗:`, err);
                  });
                } else {
                  console.warn(`[delay] チャンネル(${channelId})が見つかりません`);
                }
              }
            }
          }

          state.delayLastStatus[source.key] = {
            isNormal: status.isNormal,
            statusLabel: status.statusLabel,
            detail: status.detail,
            updatedAt: status.checkedAt,
          };
        } else {
          console.warn(`[delay] ${source.label} の運行情報を解析できませんでした。ページ構造が変わった可能性があります。`);
        }

        results.push(status);
      } catch (err) {
        console.error(`[delay] ${source.label} の取得中にエラーが発生しました:`, err.message);
        results.push({ key: source.key, label: source.label, ok: false, error: err.message });
      }
    }

    persist();
    return results;
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      checkOnce().catch((err) => console.error('[delay] 定期チェックでエラーが発生しました:', err));
    }, intervalMs);
    console.log(`[delay] 遅延監視を開始しました（${Math.round(intervalMs / 1000)}秒間隔）`);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { start, stop, checkOnce };
}

module.exports = { createDelayWatcher, DEFAULT_INTERVAL_MS };
