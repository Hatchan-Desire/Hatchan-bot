const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('このチャンネルでの監視を開始します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('このチャンネルでの監視を停止します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('trigger')
    .setDescription('反応する文字列（トリガー）を管理します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('反応する文字列と返信内容を追加・更新します')
        .addStringOption((opt) =>
          opt.setName('word').setDescription('反応させたい文字列').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('reply')
            .setDescription('この文字列に反応したときの返信内容（省略時は標準の冷笑警察メッセージ）')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('登録済みの反応文字列を削除します')
        .addStringOption((opt) =>
          opt.setName('word').setDescription('削除したい文字列').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('登録済みの反応文字列一覧を表示します')),

  new SlashCommandBuilder()
    .setName('delay')
    .setDescription('名鉄名古屋本線・JR東海道本線の遅延情報通知を管理します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('start').setDescription('このチャンネルへの遅延情報通知を開始します')
    )
    .addSubcommand((sub) =>
      sub.setName('stop').setDescription('このチャンネルへの遅延情報通知を停止します')
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('現在の運行状況を今すぐ確認します')
    ),
];

module.exports = { commands };
