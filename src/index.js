require('dotenv').config();
const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
const store = require('./store');
const { createDelayWatcher, DEFAULT_INTERVAL_MS } = require('./delayWatcher');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('[bot] DISCORD_TOKEN が設定されていません（.env を確認してください）');
  process.exit(1);
}

// メモリ上のstate。起動時にファイルから読み込み、変更のたびに保存する。
let state = store.load();

function persist() {
  store.save(state);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const delayIntervalMs = process.env.DELAY_CHECK_INTERVAL_MS
  ? Number(process.env.DELAY_CHECK_INTERVAL_MS)
  : DEFAULT_INTERVAL_MS;
const delayWatcher = createDelayWatcher({ client, state, persist, intervalMs: delayIntervalMs });

client.once(Events.ClientReady, (c) => {
  console.log(`[bot] ログインしました: ${c.user.tag}`);
  delayWatcher.start();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'start') {
      await handleStart(interaction);
    } else if (interaction.commandName === 'stop') {
      await handleStop(interaction);
    } else if (interaction.commandName === 'trigger') {
      await handleTrigger(interaction);
    } else if (interaction.commandName === 'delay') {
      await handleDelay(interaction);
    }
  } catch (err) {
    console.error('[bot] インタラクション処理中にエラーが発生しました:', err);
    const payload = { content: '⚠️ 処理中にエラーが発生しました。', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

async function handleStart(interaction) {
  const channelId = interaction.channelId;
  if (state.activeChannels.includes(channelId)) {
    await interaction.reply({
      content: 'ℹ️ このチャンネルはすでに監視中です。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  state.activeChannels.push(channelId);
  persist();
  await interaction.reply({ content: '✅ このチャンネルの監視を開始しました。', flags: MessageFlags.Ephemeral });
}

async function handleStop(interaction) {
  const channelId = interaction.channelId;
  if (!state.activeChannels.includes(channelId)) {
    await interaction.reply({
      content: 'ℹ️ このチャンネルはまだ監視していません。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  state.activeChannels = state.activeChannels.filter((id) => id !== channelId);
  persist();
  await interaction.reply({ content: '🛑 このチャンネルの監視を停止しました。', flags: MessageFlags.Ephemeral });
}

async function handleTrigger(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const word = interaction.options.getString('word', true).trim();
    const reply = interaction.options.getString('reply') ?? store.DEFAULT_REPLY;

    if (!word) {
      await interaction.reply({ content: '⚠️ 文字列が空です。', flags: MessageFlags.Ephemeral });
      return;
    }

    const isUpdate = Object.prototype.hasOwnProperty.call(state.triggers, word);
    state.triggers[word] = reply;
    persist();

    await interaction.reply({
      content: `✅ 「${word}」を${isUpdate ? '更新' : '追加'}しました。`,
      flags: MessageFlags.Ephemeral,
    });
  } else if (sub === 'remove') {
    const word = interaction.options.getString('word', true).trim();

    if (!Object.prototype.hasOwnProperty.call(state.triggers, word)) {
      await interaction.reply({
        content: `ℹ️ 「${word}」は登録されていません。`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    delete state.triggers[word];
    persist();
    await interaction.reply({ content: `🗑️ 「${word}」を削除しました。`, flags: MessageFlags.Ephemeral });
  } else if (sub === 'list') {
    const words = Object.keys(state.triggers);
    if (words.length === 0) {
      await interaction.reply({ content: '登録済みの反応文字列はありません。', flags: MessageFlags.Ephemeral });
      return;
    }

    const lines = words.map((w) => {
      const reply = state.triggers[w];
      const preview = reply.length > 30 ? `${reply.slice(0, 30)}…` : reply;
      return `- **${w}** → ${preview.replace(/\n/g, ' ')}`;
    });

    await interaction.reply({
      content: `登録済みの反応文字列（${words.length}件）:\n${lines.join('\n')}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleDelay(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'start') {
    const channelId = interaction.channelId;
    if (state.delayNotifyChannels.includes(channelId)) {
      await interaction.reply({
        content: 'ℹ️ このチャンネルはすでに遅延通知が有効です。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    state.delayNotifyChannels.push(channelId);
    persist();
    await interaction.reply({
      content: '✅ このチャンネルで名鉄名古屋本線・JR東海道本線（豊橋～米原）の遅延通知を開始しました。',
      flags: MessageFlags.Ephemeral,
    });
  } else if (sub === 'stop') {
    const channelId = interaction.channelId;
    if (!state.delayNotifyChannels.includes(channelId)) {
      await interaction.reply({
        content: 'ℹ️ このチャンネルでは遅延通知は有効になっていません。',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    state.delayNotifyChannels = state.delayNotifyChannels.filter((id) => id !== channelId);
    persist();
    await interaction.reply({ content: '🛑 このチャンネルの遅延通知を停止しました。', flags: MessageFlags.Ephemeral });
  } else if (sub === 'status') {
    await interaction.deferReply();
    const results = await delayWatcher.checkOnce({ notify: false });
    const lines = results.map((r) => {
      if (!r.ok) {
        return `- ⚠️ **${r.label}**: 取得・解析に失敗しました（${r.error || 'ページ構造が想定と異なる可能性があります'}）`;
      }
      const emoji = r.isNormal ? '🟢' : '🔴';
      return `- ${emoji} **${r.label}**: ${r.detail || r.statusLabel}`;
    });
    await interaction.editReply({ content: lines.join('\n') });
  }
}

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guildId) return; // DMは対象外
    if (!state.activeChannels.includes(message.channelId)) return;

    const content = message.content;
    if (!content) return;

    const matchedWord = Object.keys(state.triggers).find((word) => word && content.includes(word));
    if (!matchedWord) return;

    const replyContent = state.triggers[matchedWord];
    await message.reply({
      content: replyContent,
      allowedMentions: { repliedUser: false }, // メンション無しで返信
    });
  } catch (err) {
    console.error('[bot] メッセージ処理中にエラーが発生しました:', err);
  }
});

client.login(token);
