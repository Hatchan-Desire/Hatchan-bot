require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) {
  console.error('[deploy-commands] DISCORD_TOKEN が設定されていません（.env を確認してください）');
  process.exit(1);
}
if (!clientId) {
  console.error('[deploy-commands] DISCORD_CLIENT_ID が設定されていません（.env を確認してください）');
  process.exit(1);
}

const body = commands.map((c) => c.toJSON());
const rest = new REST().setToken(token);

(async () => {
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
      console.log(`[deploy-commands] ギルド(${guildId})に${body.length}個のコマンドを登録しました（即時反映）`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body });
      console.log(`[deploy-commands] グローバルに${body.length}個のコマンドを登録しました（反映まで時間がかかる場合があります）`);
    }
  } catch (err) {
    console.error('[deploy-commands] コマンド登録に失敗しました:', err);
    process.exit(1);
  }
})();
